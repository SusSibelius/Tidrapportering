import type { SuggestionRow, TimeCode } from "./types.js";

export function roundToHalf(h: number): number {
  return Math.round(h * 2) / 2;
}

/**
 * Avrundar en dags rader till halvtimmar utan att dagens summa glider:
 * summan avrundas en gång och halvtimmarna fördelas efter största rest.
 */
function roundDay(rows: SuggestionRow[]): SuggestionRow[] {
  const units = rows.map((r) => r.timmar * 2);
  const floors = units.map(Math.floor);
  let left = Math.round(units.reduce((s, u) => s + u, 0)) - floors.reduce((s, u) => s + u, 0);
  const byRemainder = units.map((u, i) => i).sort((a, b) => units[b] - floors[b] - (units[a] - floors[a]));
  for (const i of byRemainder) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return rows.map((r, i) => ({ ...r, timmar: floors[i] / 2 }));
}

export interface Normalized {
  rader: SuggestionRow[];
  varningar: string[];
}

/**
 * Sista steget efter förslagsmotorn: bara giltiga koder och datum, halvtimmar,
 * en rad per dag och kod, och varningar när en dag inte går ihop.
 */
export function normalize(rows: SuggestionRow[], days: string[], codes: TimeCode[], hoursPerDay: number): Normalized {
  const valid = new Set(codes.map((c) => c.kod));
  const varningar: string[] = [];
  const merged = new Map<string, SuggestionRow>();

  for (const r of rows) {
    if (!valid.has(r.kod)) {
      varningar.push(`Okänd tidkod "${r.kod}" (${r.datum}, ${r.timmar} h) togs bort`);
      continue;
    }
    if (!days.includes(r.datum)) {
      varningar.push(`Datum ${r.datum} ligger utanför veckan och togs bort`);
      continue;
    }
    const key = `${r.datum}|${r.kod}`;
    const prev = merged.get(key);
    merged.set(
      key,
      prev
        ? { ...prev, timmar: prev.timmar + r.timmar, motivering: `${prev.motivering}; ${r.motivering}` }
        : { ...r },
    );
  }

  const rader = days
    .flatMap((day) => roundDay([...merged.values()].filter((r) => r.datum === day)))
    .filter((r) => r.timmar > 0)
    .sort((a, b) => a.datum.localeCompare(b.datum) || a.kod.localeCompare(b.kod));

  for (const day of days) {
    const total = rader.filter((r) => r.datum === day).reduce((s, r) => s + r.timmar, 0);
    if (total !== hoursPerDay) varningar.push(`${day}: ${total} h rapporterat, förväntat ${hoursPerDay} h`);
  }

  return { rader, varningar };
}
