/** Arbetsdagarna (mån–fre) i en ISO-vecka, t.ex. "2026-W39", som YYYY-MM-DD. */
export function workdays(isoWeek: string): string[] {
  const m = /^(\d{4})-W(\d{2})$/.exec(isoWeek);
  if (!m) throw new Error(`Ogiltig vecka "${isoWeek}", använd formatet 2026-W39`);
  const year = Number(m[1]);
  const week = Number(m[2]);
  // 4 januari ligger alltid i vecka 1.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (week - 1) * 7);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/** ISO-veckan för ett datum. */
export function isoWeekOf(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // Veckan hör till det år dess torsdag ligger i.
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Förra veckan relativt idag. */
export function previousWeek(now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - 7);
  return isoWeekOf(d);
}

/** Lokalt datum (YYYY-MM-DD) för en tidpunkt i en viss tidszon. */
export function localDate(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}

/** Veckodagens namn på svenska. */
export function weekdayName(date: string): string {
  return new Intl.DateTimeFormat("sv-SE", { weekday: "long", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}
