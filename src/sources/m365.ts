import { externalDomains } from "../rules";
import type { Activity } from "../types";
import { localDate } from "../week";

const GRAPH = "https://graph.microsoft.com/v1.0";
export const GRAPH_SCOPES = ["Calendars.Read", "Mail.Read"];
const EXCERPT_LENGTH = 200;

/** Hämtar alla sidor för en Graph-fråga. */
async function getAll<T>(token: string, url: string, timeZone: string): Promise<T[]> {
  const items: T[] = [];
  let next: string | undefined = url;
  while (next) {
    const res = await fetch(next, {
      headers: { Authorization: `Bearer ${token}`, Prefer: `outlook.timezone="${timeZone}"` },
    });
    if (!res.ok) throw new Error(`Graph svarade ${res.status}: ${await res.text()}`);
    const body = (await res.json()) as { value: T[]; "@odata.nextLink"?: string };
    items.push(...body.value);
    next = body["@odata.nextLink"];
  }
  return items;
}

interface GraphEvent {
  subject: string | null;
  start: { dateTime: string };
  end: { dateTime: string };
  isAllDay: boolean;
  isCancelled: boolean;
  showAs: string;
  attendees: { emailAddress: { address: string } }[];
  organizer?: { emailAddress: { address: string } };
}

interface GraphMessage {
  subject: string | null;
  bodyPreview: string;
  receivedDateTime: string;
  sentDateTime: string;
  from?: { emailAddress: { address: string } };
  toRecipients: { emailAddress: { address: string } }[];
  ccRecipients: { emailAddress: { address: string } }[];
}

function excerpt(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > EXCERPT_LENGTH ? `${oneLine.slice(0, EXCERPT_LENGTH)}…` : oneLine;
}

function minutesBetween(start: string, end: string): number {
  return Math.round((Date.parse(end) - Date.parse(start)) / 60000);
}

/**
 * Hämtar veckans kalender och mail. Bara metadata och ett kort utdrag sparas,
 * aldrig hela mailkroppar.
 */
export async function loadM365Activities(
  token: string,
  days: string[],
  timeZone: string,
  ownDomain?: string,
): Promise<Activity[]> {
  const from = `${days[0]}T00:00:00`;
  const to = `${days[days.length - 1]}T23:59:59`;
  // Mail filtreras i UTC, så vi tar med marginal och sorterar bort andra dagar efteråt.
  const fromUtc = new Date(Date.parse(`${days[0]}T00:00:00Z`) - 86400000).toISOString();
  const toUtc = new Date(Date.parse(`${days[days.length - 1]}T00:00:00Z`) + 2 * 86400000).toISOString();

  const eventFields = "subject,start,end,isAllDay,isCancelled,showAs,attendees,organizer";
  const mailFields = "subject,bodyPreview,receivedDateTime,sentDateTime,from,toRecipients,ccRecipients";

  const [events, sent, received] = await Promise.all([
    getAll<GraphEvent>(
      token,
      `${GRAPH}/me/calendarView?startDateTime=${from}&endDateTime=${to}&$select=${eventFields}&$top=100`,
      timeZone,
    ),
    getAll<GraphMessage>(
      token,
      `${GRAPH}/me/mailFolders/sentitems/messages?$filter=sentDateTime ge ${fromUtc} and sentDateTime lt ${toUtc}&$select=${mailFields}&$top=100`,
      timeZone,
    ),
    getAll<GraphMessage>(
      token,
      `${GRAPH}/me/mailFolders/inbox/messages?$filter=receivedDateTime ge ${fromUtc} and receivedDateTime lt ${toUtc}&$select=${mailFields}&$top=100`,
      timeZone,
    ),
  ]);

  const activities: Activity[] = [];

  for (const e of events) {
    if (e.isCancelled || e.isAllDay || e.showAs === "free") continue;
    const people = [e.organizer?.emailAddress.address, ...e.attendees.map((a) => a.emailAddress.address)].filter(
      (x): x is string => Boolean(x),
    );
    activities.push({
      kalla: "kalender",
      datum: e.start.dateTime.slice(0, 10),
      minuter: minutesBetween(e.start.dateTime, e.end.dateTime),
      titel: e.subject ?? "(utan titel)",
      personer: people,
      domaner: externalDomains(people, ownDomain),
    });
  }

  const toActivity = (m: GraphMessage, kalla: Activity["kalla"], at: string): Activity => {
    const people = [
      m.from?.emailAddress.address,
      ...m.toRecipients.map((r) => r.emailAddress.address),
      ...m.ccRecipients.map((r) => r.emailAddress.address),
    ].filter((x): x is string => Boolean(x));
    return {
      kalla,
      datum: localDate(at, timeZone),
      titel: m.subject ?? "(utan ämne)",
      personer: people,
      domaner: externalDomains(people, ownDomain),
      utdrag: excerpt(m.bodyPreview),
    };
  };
  for (const m of sent) activities.push(toActivity(m, "mail-skickat", m.sentDateTime));
  for (const m of received) activities.push(toActivity(m, "mail-mottaget", m.receivedDateTime));

  return activities.filter((a) => days.includes(a.datum));
}
