"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { flexClass, fmtFlex, fmtHours, tenth } from "../../lib/hours";
import { loadAllWeeks, loadOpeningFlex, saveOpeningFlex } from "../../lib/saved-weeks";
import { flexDays, flexOverview, sumFlex, type SavedWeek } from "../../src/flex";
import type { TimeCode } from "../../src/types";
import { isoWeekOf } from "../../src/week";

interface Props {
  codes: Pick<TimeCode, "kod" | "typ">[];
  hoursPerDay: number;
  flexCodes: string[];
}

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Intl.DateTimeFormat("sv-SE", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, i, 15))),
);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const weekNo = (week: string) => Number(week.slice(6));

/** Dagens datum i webbläsarens tidszon, YYYY-MM-DD. */
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function FlexView({ codes, hoursPerDay, flexCodes }: Props) {
  // Allt ligger i webbläsaren, så sidan läser in efter första renderingen.
  const [weeks, setWeeks] = useState<SavedWeek[] | null>(null);
  const [opening, setOpening] = useState(0);
  const [today, setToday] = useState("");
  const [year, setYear] = useState(0);

  useEffect(() => {
    const t = localToday();
    setWeeks(loadAllWeeks());
    setOpening(loadOpeningFlex());
    setToday(t);
    setYear(Number(t.slice(0, 4)));
  }, []);

  const days = useMemo(() => (weeks ? flexDays(weeks, codes, hoursPerDay) : []), [weeks, codes, hoursPerDay]);

  if (!weeks) {
    return (
      <header>
        <h1>Flexsaldo</h1>
      </header>
    );
  }

  const o = flexOverview(days, today, opening);
  const pending = weeks.filter((w) => !w.approved);
  const thisWeek = isoWeekOf(new Date(`${today}T12:00:00`));
  const years = [...new Set([...days.map((d) => Number(d.datum.slice(0, 4))), Number(today.slice(0, 4))])].sort();

  // Saldot vid årets början: ingående saldo plus allt före året.
  const before = tenth(opening + sumFlex(days.filter((d) => Number(d.datum.slice(0, 4)) < year)).flex);
  let running = before;
  const months = MONTHS.map((name, i) => {
    const prefix = `${year}-${String(i + 1).padStart(2, "0")}`;
    const s = sumFlex(days.filter((d) => d.datum.startsWith(prefix)));
    running = tenth(running + s.flex);
    return { name, ...s, saldo: running };
  });

  running = before;
  const yearWeeks = [...new Set(days.filter((d) => d.datum.startsWith(String(year))).map((d) => d.vecka))].map(
    (vecka) => {
      const inWeek = days.filter((d) => d.vecka === vecka && d.datum.startsWith(String(year)));
      const s = sumFlex(inWeek);
      const uttag = tenth(inWeek.reduce((sum, d) => sum + d.uttag, 0));
      running = tenth(running + s.flex);
      return { vecka, ...s, uttag, saldo: running };
    },
  );

  const changeOpening = (raw: string) => {
    const n = tenth(Number(raw.replace(",", ".").replace("−", "-")));
    if (!Number.isFinite(n)) return;
    setOpening(n);
    saveOpeningFlex(n);
  };

  const period = (label: string, s: { flex: number; raknat: number; dagar: number }) => (
    <div className="period">
      <span className="eyebrow">{label}</span>
      <b className={flexClass(s.flex)}>{s.dagar ? `${fmtFlex(s.flex)} h` : "–"}</b>
      <small>{s.dagar ? `${fmtHours(s.raknat)} h på ${s.dagar} ${s.dagar === 1 ? "dag" : "dagar"}` : "Ingen godkänd tid"}</small>
    </div>
  );

  const flexDaysLeft = Math.abs(o.saldo) / hoursPerDay;

  return (
    <>
      <header>
        <h1>Flexsaldo</h1>
      </header>

      <section className="flexhero" aria-label="Totalt flexsaldo">
        <span className="eyebrow">Ditt saldo just nu</span>
        <b className={flexClass(o.saldo)}>{fmtFlex(o.saldo)} h</b>
        <p>
          {o.saldo > 0
            ? `Motsvarar ${String(Math.round(flexDaysLeft * 10) / 10).replace(".", ",")} arbetsdagar som du kan ta ut som ledighet.`
            : o.saldo < 0
              ? `Motsvarar ${String(Math.round(flexDaysLeft * 10) / 10).replace(".", ",")} arbetsdagar som behöver arbetas in.`
              : "Du ligger precis på din arbetstid."}
        </p>
      </section>

      <div className="periods">
        {period("Idag", o.idag)}
        {period(`Vecka ${weekNo(thisWeek)}`, o.vecka)}
        {period(capitalize(MONTHS[Number(today.slice(5, 7)) - 1]), o.manad)}
        {period(today.slice(0, 4), o.ar)}
      </div>

      {pending.length > 0 && (
        <p className="note">
          Räknas inte än, eftersom {pending.length === 1 ? "veckan inte är godkänd" : "veckorna inte är godkända"}:{" "}
          {pending.map((w, i) => (
            <span key={w.week}>
              {i > 0 && ", "}
              <Link href={`/vecka/${w.week}`}>v. {weekNo(w.week)}</Link>
            </span>
          ))}
          .
        </p>
      )}

      <section className="section">
        <div className="sectionhead">
          <h2>Per månad {year}</h2>
          {years.length > 1 && (
            <div className="yearnav">
              <button
                className="btn"
                type="button"
                disabled={year <= years[0]}
                onClick={() => setYear(year - 1)}
                aria-label="Föregående år"
              >
                ←
              </button>
              <b>{year}</b>
              <button
                className="btn"
                type="button"
                disabled={year >= years[years.length - 1]}
                onClick={() => setYear(year + 1)}
                aria-label="Nästa år"
              >
                →
              </button>
            </div>
          )}
        </div>
        <div className="sheet">
          <table className="flextable">
            <thead>
              <tr>
                <th>Månad</th>
                <th className="num">Rapporterat</th>
                <th className="num">Flex</th>
                <th className="num">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.name} className={m.dagar ? "" : "nodata"}>
                  <th scope="row">{capitalize(m.name)}</th>
                  <td className="num">{m.dagar ? `${fmtHours(m.raknat)} h` : "–"}</td>
                  <td className={`num ${flexClass(m.flex)}`}>{m.dagar ? fmtFlex(m.flex) : "–"}</td>
                  <td className="num">{m.dagar ? fmtFlex(m.saldo) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2>Godkända veckor {year}</h2>
        {yearWeeks.length ? (
          <div className="sheet">
            <table className="flextable">
              <thead>
                <tr>
                  <th>Vecka</th>
                  <th className="num">Rapporterat</th>
                  <th className="num">Flexuttag</th>
                  <th className="num">Flex</th>
                  <th className="num">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {yearWeeks.map((w) => (
                  <tr key={w.vecka}>
                    <th scope="row">
                      <Link href={`/vecka/${w.vecka}`}>v. {weekNo(w.vecka)}</Link>
                    </th>
                    <td className="num">{fmtHours(w.raknat)} h</td>
                    <td className="num">{w.uttag ? `${fmtHours(w.uttag)} h` : "–"}</td>
                    <td className={`num ${flexClass(w.flex)}`}>{fmtFlex(w.flex)}</td>
                    <td className="num">{fmtFlex(w.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="note">Inga godkända veckor ännu. Godkänn en vecka under Tidrapport så räknas den in här.</p>
        )}
      </section>

      <section className="section">
        <h2>Ingående saldo</h2>
        <label className="opening">
          Flex från innan du började använda appen, till exempel det som står i xLedger:
          <input
            key={opening}
            inputMode="decimal"
            defaultValue={String(opening).replace(".", ",")}
            onBlur={(e) => changeOpening(e.target.value)}
          />
          h
        </label>
      </section>

      <p className="note">
        Varje arbetsdag är {fmtHours(hoursPerDay)} h. Rapporterar du mer blir det plus, mindre blir det minus. Semester
        räknas som vanlig tid. Vill du ta ut flex rapporterar du ledigheten på{" "}
        {flexCodes.length ? flexCodes.join(" eller ") : "en flexkod"}, så minskar saldot med de timmarna. Saldot räknar
        bara godkända veckor och sparas än så länge bara i den här webbläsaren.
      </p>
    </>
  );
}
