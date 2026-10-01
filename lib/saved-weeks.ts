import type { SavedWeek } from "../src/flex";

// Godkända veckor sparas tills vidare bara i webbläsaren. Alla läsningar och skrivningar
// tål att lagringen saknas (privat läge, blockerad lagring): sidorna fungerar ändå.

const PREFIX = "tidrapport:";
const OPENING_KEY = `${PREFIX}ingaende-flex`;
const WEEK_KEY = /^tidrapport:(\d{4}-W\d{2})$/;

const weekKey = (week: string) => `${PREFIX}${week}`;

export function loadWeek(week: string): Omit<SavedWeek, "week"> | null {
  try {
    const raw = localStorage.getItem(weekKey(week));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveWeek(week: string, hours: SavedWeek["hours"], approved: boolean) {
  try {
    localStorage.setItem(weekKey(week), JSON.stringify({ hours, approved }));
  } catch {
    // Förslaget fungerar ändå, det sparas bara inte.
  }
}

/** Alla sparade veckor, godkända eller inte. */
export function loadAllWeeks(): SavedWeek[] {
  const weeks: SavedWeek[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const week = WEEK_KEY.exec(localStorage.key(i) ?? "")?.[1];
      const saved = week && loadWeek(week);
      if (week && saved) weeks.push({ week, hours: saved.hours ?? {}, approved: Boolean(saved.approved) });
    }
  } catch {
    // Ingen lagring, inga sparade veckor.
  }
  return weeks.sort((a, b) => a.week.localeCompare(b.week));
}

/** Flexsaldo från tiden innan appen, t.ex. det som står i xLedger. */
export function loadOpeningFlex(): number {
  try {
    const n = Number(localStorage.getItem(OPENING_KEY));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function saveOpeningFlex(hours: number) {
  try {
    localStorage.setItem(OPENING_KEY, String(hours));
  } catch {
    // Saldot visas ändå för stunden.
  }
}
