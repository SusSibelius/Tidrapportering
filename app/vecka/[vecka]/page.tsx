import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DEMO_WEEK, isDemo, loadWeek } from "../../../lib/week-data";
import { isoWeekOf, workdays } from "../../../src/week";
import WeekGrid from "./WeekGrid";

function shiftWeek(monday: string, weeks: number): string {
  const d = new Date(`${monday}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return isoWeekOf(d);
}

function heading(week: string, days: string[]): string {
  const fmt = (d: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("sv-SE", { ...opts, timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  const sameMonth = days[0].slice(5, 7) === days[4].slice(5, 7);
  const first = fmt(days[0], sameMonth ? { day: "numeric" } : { day: "numeric", month: "long" });
  const last = fmt(days[4], { day: "numeric", month: "long" });
  return `Vecka ${Number(week.slice(6))}, ${first}–${last}`;
}

// Ett förslag från Claude kan ta en stund.
export const maxDuration = 120;

export default async function WeekPage({ params }: { params: Promise<{ vecka: string }> }) {
  const { vecka } = await params;
  let days: string[];
  try {
    days = workdays(vecka);
  } catch {
    notFound();
  }
  const demo = await isDemo();
  if (demo && vecka !== DEMO_WEEK) redirect(`/vecka/${DEMO_WEEK}`);

  const prev = shiftWeek(days[0], -1);
  const next = shiftWeek(days[0], 1);

  let content: React.ReactNode;
  try {
    const { config, suggestion } = await loadWeek(days, demo);
    content = (
      <WeekGrid
        key={vecka}
        week={vecka}
        days={days}
        codes={config.tidkoder.map(({ kod, namn, debiterbar, typ }) => ({ kod, namn, debiterbar, typ }))}
        hoursPerDay={config.timmarPerDag}
        suggestion={suggestion}
      />
    );
  } catch (e) {
    content = (
      <div className="error">
        <strong>Kunde inte ta fram något förslag.</strong>
        <p>{e instanceof Error ? e.message : String(e)}</p>
      </div>
    );
  }

  return (
    <>
      {demo && (
        <p className="demo">
          Exempeldata. Logga in med ditt Microsoft-konto för att få förslag från din egen kalender och mail.
        </p>
      )}
      <header>
        <h1>{heading(vecka, days)}</h1>
        {!demo && (
          <nav className="weeknav" aria-label="Byt vecka">
            <Link className="btn" href={`/vecka/${prev}`}>
              ← v. {Number(prev.slice(6))}
            </Link>
            <Link className="btn" href={`/vecka/${next}`}>
              v. {Number(next.slice(6))} →
            </Link>
          </nav>
        )}
      </header>
      {content}
    </>
  );
}
