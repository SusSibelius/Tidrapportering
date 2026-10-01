import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BaselineRow } from "./baseline";
import { SuggestionSchema, type Activity, type Config, type Suggestion, type SuggestionRow } from "./types";
import { weekdayName } from "./week";

export const MODEL = "claude-opus-5";

const SYSTEM = `Du hjälper en konsult att fylla i veckans tidrapport.

Du får veckans arbetsdagar, konsultens giltiga tidkoder, hur konsulten brukar rapportera (historik) och veckans aktiviteter från kalender och mail. Föreslå hur många timmar som lagts på varje tidkod varje dag.

Så här resonerar du:
- Kalendermöten är den starkaste signalen: mötets längd går till den kod mötet hör till.
- Mail visar vad konsulten jobbat med mellan mötena. Skickade mail väger tyngre än mottagna. Fördela dagens resterande tid efter vilka kunder och projekt mailen handlar om.
- En regelkod på en aktivitet är en säker koppling som konsulten själv har satt upp. Följ den.
- Historiken visar konsultens normala vecka. Använd den när aktiviteterna inte räcker, till exempel för återkommande intern tid.
- Varje dag ska summera till konsultens arbetstid per dag. Ange timmar med högst en decimal.
- Använd bara de givna tidkoderna. Hitta aldrig på en kod.
- Motivera varje rad kort på svenska med vad den bygger på, till exempel "2 möten med Kund AB, 5 skickade mail om integrationen".
- Sätt säkerheten till "lag" när en rad mest bygger på gissning eller historik.`;

/** Aktiviteterna i en kompakt form, utan fält som inte hjälper förslaget. */
function compactActivities(activities: Activity[]) {
  return activities.map((a) => ({
    datum: a.datum,
    kalla: a.kalla,
    titel: a.titel,
    ...(a.minuter !== undefined && { minuter: a.minuter }),
    ...(a.domaner.length > 0 && { domaner: a.domaner }),
    ...(a.utdrag && { utdrag: a.utdrag }),
    ...(a.regelkod && { regelkod: a.regelkod }),
  }));
}

export async function suggestWithClaude(
  days: string[],
  activities: Activity[],
  config: Config,
  history: BaselineRow[],
): Promise<Suggestion> {
  const client = new Anthropic();
  const input = {
    arbetsdagar: days.map((d) => ({ datum: d, veckodag: weekdayName(d) })),
    timmarPerDag: config.timmarPerDag,
    // Flexuttag och frånvaro sätter konsulten själv, de går inte att utläsa ur kalender och mail.
    tidkoder: config.tidkoder
      .filter((c) => c.typ === "arbete")
      .map(({ kod, namn, kund, debiterbar }) => ({ kod, namn, kund, debiterbar })),
    historik: history,
    aktiviteter: compactActivities(activities),
  };

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [{ role: "user", content: JSON.stringify(input, null, 1) }],
    output_config: { format: betaZodOutputFormat(SuggestionSchema) },
  });

  if (response.stop_reason === "refusal") {
    throw new Error(`Claude avböjde förfrågan: ${response.stop_details?.explanation ?? "okänd anledning"}`);
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error(`Claude gav inget giltigt förslag (stop_reason: ${response.stop_reason})`);
  }
  return response.parsed_output;
}

/**
 * Förslag utan AI: möten med regelkod ger sina minuter, och resten av dagen fördelas
 * efter hur många mail per regelkod dagen hade. Bra som jämförelse mot Claude.
 */
export function suggestWithRules(days: string[], activities: Activity[], config: Config): Suggestion {
  const rows: SuggestionRow[] = [];
  for (const day of days) {
    const today = activities.filter((a) => a.datum === day && a.regelkod);
    const meetingHours = new Map<string, number>();
    const mailCount = new Map<string, number>();
    for (const a of today) {
      const kod = a.regelkod!;
      if (a.kalla === "kalender") meetingHours.set(kod, (meetingHours.get(kod) ?? 0) + (a.minuter ?? 0) / 60);
      else mailCount.set(kod, (mailCount.get(kod) ?? 0) + (a.kalla === "mail-skickat" ? 2 : 1));
    }
    const booked = [...meetingHours.values()].reduce((s, h) => s + h, 0);
    const rest = Math.max(0, config.timmarPerDag - booked);
    const mailTotal = [...mailCount.values()].reduce((s, n) => s + n, 0);

    const hours = new Map(meetingHours);
    for (const [kod, n] of mailCount) hours.set(kod, (hours.get(kod) ?? 0) + (rest * n) / mailTotal);
    for (const [kod, h] of hours) {
      const mails = today.filter((a) => a.regelkod === kod && a.kalla !== "kalender").length;
      const meetings = meetingHours.get(kod);
      const parts = [
        meetings && `${String(meetings).replace(".", ",")} h möten`,
        mails && `${mails} mail`,
      ].filter(Boolean);
      rows.push({
        datum: day,
        kod,
        timmar: h,
        motivering: `${parts.join(" och ")} som hör till koden.`.replace(/^./, (c) => c.toUpperCase()),
        sakerhet: meetings ? "medel" : "lag",
      });
    }
  }
  return { rader: rows, kommentar: "Möten har fått sin tid och resten av varje dag är fördelad efter mailen. Förslaget bygger bara på regler, så kontrollera de osäkra raderna." };
}
