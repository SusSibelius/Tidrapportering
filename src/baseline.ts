import type { TimeEntry } from "./types";
import { isoWeekOf, weekdayName } from "./week";

export interface BaselineRow {
  veckodag: string;
  kod: string;
  snittTimmar: number;
}

/** Genomsnittliga timmar per veckodag och tidkod över historikens veckor. */
export function baseline(history: TimeEntry[]): BaselineRow[] {
  const weeks = new Set(history.map((e) => isoWeekOf(new Date(`${e.datum}T12:00:00Z`))));
  if (weeks.size === 0) return [];
  const sums = new Map<string, number>();
  for (const e of history) {
    const key = `${weekdayName(e.datum)}|${e.kod}`;
    sums.set(key, (sums.get(key) ?? 0) + e.timmar);
  }
  return [...sums].map(([key, total]) => {
    const [veckodag, kod] = key.split("|");
    return { veckodag, kod, snittTimmar: Math.round((total / weeks.size) * 10) / 10 };
  });
}
