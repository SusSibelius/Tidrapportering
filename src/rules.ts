import type { Activity, TimeCode } from "./types.js";

/**
 * Enkla, förutsägbara mappningar: maildomän eller nyckelord → tidkod.
 * Första träffen vinner, domäner går före nyckelord.
 */
export function matchRule(activity: Activity, codes: TimeCode[]): string | undefined {
  const domains = activity.domaner.map((d) => d.toLowerCase());
  for (const code of codes) {
    if (code.domaner.some((d) => domains.includes(d.toLowerCase()))) return code.kod;
  }
  const title = activity.titel.toLowerCase();
  for (const code of codes) {
    if (code.nyckelord.some((k) => title.includes(k.toLowerCase()))) return code.kod;
  }
  return undefined;
}

export function applyRules(activities: Activity[], codes: TimeCode[]): Activity[] {
  return activities.map((a) => {
    const kod = matchRule(a, codes);
    return kod ? { ...a, regelkod: kod } : a;
  });
}

/** Domänen i en mailadress, t.ex. "anna@kundab.se" → "kundab.se". */
export function domainOf(email: string): string | undefined {
  const at = email.lastIndexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : undefined;
}

/** Unika externa domäner bland adresserna, utan den egna domänen. */
export function externalDomains(emails: string[], ownDomain?: string): string[] {
  const own = ownDomain?.toLowerCase();
  const set = new Set<string>();
  for (const e of emails) {
    const d = domainOf(e);
    if (d && d !== own) set.add(d);
  }
  return [...set];
}
