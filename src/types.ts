import { z } from "zod";

/** En tidkod som konsulten kan rapportera på, speglar xLedgers projekt/aktivitet. */
export const TimeCodeSchema = z.object({
  kod: z.string(),
  namn: z.string(),
  kund: z.string().optional(),
  debiterbar: z.boolean(),
  /** Maildomäner som pekar på den här koden, t.ex. "kundab.se". */
  domaner: z.array(z.string()).default([]),
  /** Ord i mötestitlar/ämnesrader som pekar på den här koden. */
  nyckelord: z.array(z.string()).default([]),
  /**
   * Hur koden påverkar flexsaldot. "arbete" och "franvaro" (t.ex. semester) räknas mot
   * dagens arbetstid, "flexuttag" gör det inte och minskar alltså saldot.
   */
  typ: z.enum(["arbete", "franvaro", "flexuttag"]).default("arbete"),
});
export type TimeCode = z.infer<typeof TimeCodeSchema>;

export const ConfigSchema = z.object({
  timmarPerDag: z.number().default(7.7),
  tidszon: z.string().default("Europe/Stockholm"),
  egenDoman: z.string().optional(),
  tidkoder: z.array(TimeCodeSchema).min(1),
});
export type Config = z.infer<typeof ConfigSchema>;

/** En normaliserad händelse från valfri datakälla. */
export const ActivitySchema = z.object({
  kalla: z.enum(["kalender", "mail-skickat", "mail-mottaget"]),
  /** Lokalt datum, YYYY-MM-DD. */
  datum: z.string(),
  /** Längd i minuter, bara för kalenderhändelser. */
  minuter: z.number().optional(),
  titel: z.string(),
  personer: z.array(z.string()).default([]),
  domaner: z.array(z.string()).default([]),
  /** Kort utdrag, aldrig hela mailkroppen. */
  utdrag: z.string().optional(),
  /** Tidkod som en regel matchade, om någon. */
  regelkod: z.string().optional(),
});
export type Activity = z.infer<typeof ActivitySchema>;

export const Confidence = z.enum(["hog", "medel", "lag"]);

/** Det Claude ska returnera. */
export const SuggestionSchema = z.object({
  rader: z.array(
    z.object({
      datum: z.string().describe("YYYY-MM-DD, en av veckans arbetsdagar"),
      kod: z.string().describe("Exakt en av de givna tidkoderna"),
      timmar: z.number().describe("Timmar, med högst en decimal"),
      motivering: z.string().describe("Kort motivering på svenska"),
      sakerhet: Confidence,
    }),
  ),
  kommentar: z.string().describe("Kort sammanfattning av veckan och osäkerheter"),
});
export type Suggestion = z.infer<typeof SuggestionSchema>;
export type SuggestionRow = Suggestion["rader"][number];

/** En tidrad utan motivering, t.ex. från historik eller facit. */
export interface TimeEntry {
  datum: string;
  kod: string;
  timmar: number;
}
