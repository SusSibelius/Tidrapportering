import type { TimeEntry } from "./types";

export interface Comparison {
  forslagTimmar: number;
  facitTimmar: number;
  /** Summan av |förslag − facit| per dag och kod. */
  avvikelseTimmar: number;
  /** Andel av facits timmar som hamnade på rätt dag och kod. */
  traffsakerhet: number;
  perKod: { kod: string; forslag: number; facit: number }[];
}

/** Jämför ett förslag mot vad konsulten faktiskt rapporterade. */
export function compare(suggested: TimeEntry[], actual: TimeEntry[]): Comparison {
  const byKey = (entries: TimeEntry[]) => {
    const m = new Map<string, number>();
    for (const e of entries) m.set(`${e.datum}|${e.kod}`, (m.get(`${e.datum}|${e.kod}`) ?? 0) + e.timmar);
    return m;
  };
  const s = byKey(suggested);
  const a = byKey(actual);
  let deviation = 0;
  let matched = 0;
  for (const key of new Set([...s.keys(), ...a.keys()])) {
    const sv = s.get(key) ?? 0;
    const av = a.get(key) ?? 0;
    deviation += Math.abs(sv - av);
    matched += Math.min(sv, av);
  }
  const sum = (entries: TimeEntry[]) => entries.reduce((t, e) => t + e.timmar, 0);
  const codes = [...new Set([...suggested, ...actual].map((e) => e.kod))].sort();
  const perCode = (entries: TimeEntry[], kod: string) => sum(entries.filter((e) => e.kod === kod));
  const facitTimmar = sum(actual);
  return {
    forslagTimmar: sum(suggested),
    facitTimmar,
    avvikelseTimmar: deviation,
    traffsakerhet: facitTimmar === 0 ? 0 : matched / facitTimmar,
    perKod: codes.map((kod) => ({ kod, forslag: perCode(suggested, kod), facit: perCode(actual, kod) })),
  };
}
