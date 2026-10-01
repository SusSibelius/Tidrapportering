import type { TimeCode } from "./types";
import { isoWeekOf, workdays } from "./week";

/** En sparad vecka som den ligger i webbläsaren: timmar per "KOD|datum". */
export interface SavedWeek {
  week: string;
  hours: Record<string, number>;
  approved: boolean;
}

export interface FlexDay {
  datum: string;
  vecka: string;
  /** Timmar som räknas mot arbetstiden: arbete och frånvaro. */
  raknat: number;
  /** Timmar uttagen flex. */
  uttag: number;
  /** Plus eller minus mot arbetstiden den dagen. */
  flex: number;
}

const tenth = (h: number) => Math.round(h * 10) / 10;

/**
 * Flex per arbetsdag i de godkända veckorna. Mer än arbetstiden ger plus, mindre ger minus.
 * Flexuttag räknas inte som arbetad tid, så en dag med 7,7 h FLEX ger −7,7 h.
 */
export function flexDays(weeks: SavedWeek[], codes: Pick<TimeCode, "kod" | "typ">[], hoursPerDay: number): FlexDay[] {
  const typ = new Map(codes.map((c) => [c.kod, c.typ]));
  const days: FlexDay[] = [];
  for (const w of weeks) {
    if (!w.approved) continue;
    for (const datum of workdays(w.week)) {
      let raknat = 0;
      let uttag = 0;
      for (const [k, h] of Object.entries(w.hours)) {
        const [kod, d] = k.split("|");
        if (d !== datum || !h) continue;
        // Koder som tagits bort ur listan räknas som arbete, så att gammal tid inte försvinner.
        if (typ.get(kod) === "flexuttag") uttag += h;
        else raknat += h;
      }
      days.push({ datum, vecka: w.week, raknat: tenth(raknat), uttag: tenth(uttag), flex: tenth(raknat - hoursPerDay) });
    }
  }
  return days.sort((a, b) => a.datum.localeCompare(b.datum));
}

export interface FlexSum {
  flex: number;
  raknat: number;
  dagar: number;
}

export function sumFlex(days: FlexDay[]): FlexSum {
  return {
    flex: tenth(days.reduce((s, d) => s + d.flex, 0)),
    raknat: tenth(days.reduce((s, d) => s + d.raknat, 0)),
    dagar: days.length,
  };
}

export interface FlexOverview {
  saldo: number;
  idag: FlexSum;
  vecka: FlexSum;
  manad: FlexSum;
  ar: FlexSum;
}

/** Saldot totalt och för dagen, veckan, månaden och året som `today` ligger i. */
export function flexOverview(days: FlexDay[], today: string, opening = 0): FlexOverview {
  const week = isoWeekOf(new Date(`${today}T12:00:00`));
  return {
    saldo: tenth(opening + sumFlex(days).flex),
    idag: sumFlex(days.filter((d) => d.datum === today)),
    vecka: sumFlex(days.filter((d) => d.vecka === week)),
    manad: sumFlex(days.filter((d) => d.datum.slice(0, 7) === today.slice(0, 7))),
    ar: sumFlex(days.filter((d) => d.datum.slice(0, 4) === today.slice(0, 4))),
  };
}
