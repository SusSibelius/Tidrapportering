import type { SuggestionRow, TimeEntry } from "./types.js";

const SEP = ";";

function formatHours(h: number): string {
  return String(h).replace(".", ",");
}

function escape(field: string): string {
  return /[;"\n]/.test(field) ? `"${field.replace(/"/g, '""')}"` : field;
}

/**
 * Semikolonseparerad CSV med decimalkomma, så att den öppnas rätt i svensk Excel.
 * Kolumnerna är en platshållare tills vi vet exakt vilket importformat xLedger vill ha.
 */
export function toCsv(rows: SuggestionRow[]): string {
  const header = ["datum", "kod", "timmar", "sakerhet", "motivering"].join(SEP);
  const lines = rows.map((r) =>
    [r.datum, escape(r.kod), formatHours(r.timmar), r.sakerhet, escape(r.motivering)].join(SEP),
  );
  return [header, ...lines].join("\n") + "\n";
}

/** Läser tidrader (datum;kod;timmar) från t.ex. en gammal export. Tål komma eller semikolon. */
export function parseEntries(csv: string): TimeEntry[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].split(sep).map((h) => h.trim().toLowerCase());
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`Kolumnen "${name}" saknas i CSV-filen`);
    return i;
  };
  const [iDate, iCode, iHours] = [col("datum"), col("kod"), col("timmar")];
  return lines.slice(1).map((line) => {
    const f = line.split(sep).map((x) => x.trim());
    return { datum: f[iDate], kod: f[iCode], timmar: Number(f[iHours].replace(",", ".")) };
  });
}
