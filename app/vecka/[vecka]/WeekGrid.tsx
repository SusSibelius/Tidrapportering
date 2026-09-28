"use client";

import { useEffect, useMemo, useState } from "react";
import type { WeekSuggestion } from "../../../src/engine";
import type { SuggestionRow } from "../../../src/types";

interface Code {
  kod: string;
  namn: string;
  debiterbar: boolean;
}

interface Props {
  week: string;
  days: string[];
  codes: Code[];
  hoursPerDay: number;
  suggestion: WeekSuggestion;
}

type Hours = Record<string, number>;

const CONFIDENCE = { hog: "Säkert", medel: "Troligt", lag: "Osäkert" } as const;
const SOURCE = { kalender: ["▦", "Möte"], "mail-skickat": ["↗", "Skickat"], "mail-mottaget": ["↙", "Mottaget"] } as const;

const key = (kod: string, day: string) => `${kod}|${day}`;
const fmt = (h: number) => (h === 0 ? "–" : String(h).replace(".", ","));
const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("sv-SE", { ...opts, timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

/** Godkända veckor sparas tills vidare bara i webbläsaren. */
const storageKey = (week: string) => `tidrapport:${week}`;
function loadSaved(week: string): { hours: Hours; approved: boolean } | null {
  try {
    const raw = localStorage.getItem(storageKey(week));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function save(week: string, hours: Hours, approved: boolean) {
  try {
    localStorage.setItem(storageKey(week), JSON.stringify({ hours, approved }));
  } catch {
    // Privat läge eller blockerad lagring: förslaget fungerar ändå, det sparas bara inte.
  }
}

export default function WeekGrid({ week, days, codes, hoursPerDay, suggestion }: Props) {
  const rowByKey = useMemo(() => {
    const m = new Map<string, SuggestionRow>();
    for (const r of suggestion.rader) m.set(key(r.kod, r.datum), r);
    return m;
  }, [suggestion]);

  const original = useMemo(() => {
    const h: Hours = {};
    for (const c of codes) for (const d of days) h[key(c.kod, d)] = rowByKey.get(key(c.kod, d))?.timmar ?? 0;
    return h;
  }, [codes, days, rowByKey]);

  const [hours, setHours] = useState<Hours>(original);
  const [approved, setApproved] = useState(false);
  const firstLow = suggestion.rader.find((r) => r.sakerhet === "lag") ?? suggestion.rader[0];
  const [sel, setSel] = useState({ kod: firstLow?.kod ?? codes[0].kod, day: firstLow?.datum ?? days[0] });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const saved = loadSaved(week);
    if (saved) {
      setHours({ ...original, ...saved.hours });
      setApproved(saved.approved);
    }
  }, [week, original]);

  const update = (next: Hours, nextApproved: boolean) => {
    setHours(next);
    setApproved(nextApproved);
    save(week, next, nextApproved);
  };
  const setCell = (k: string, v: number) => {
    const clean = Number.isFinite(v) ? Math.min(24, Math.max(0, Math.round(v * 2) / 2)) : 0;
    update({ ...hours, [k]: clean }, false);
  };

  const dayTotal = (d: string) => codes.reduce((s, c) => s + hours[key(c.kod, d)], 0);
  const codeTotal = (kod: string) => days.reduce((s, d) => s + hours[key(kod, d)], 0);
  const weekTotal = days.reduce((s, d) => s + dayTotal(d), 0);
  const billable = codes.filter((c) => c.debiterbar).reduce((s, c) => s + codeTotal(c.kod), 0);
  const unsure = suggestion.rader.filter((r) => r.sakerhet === "lag").length;
  const offDays = days.filter((d) => dayTotal(d) !== hoursPerDay).length;
  const target = hoursPerDay * days.length;

  const csv = [
    "datum;kod;timmar",
    ...days.flatMap((d) =>
      codes.filter((c) => hours[key(c.kod, d)] > 0).map((c) => `${d};${c.kod};${fmt(hours[key(c.kod, d)])}`),
    ),
  ].join("\n");

  const selKey = key(sel.kod, sel.day);
  const selRow = rowByKey.get(selKey);
  const selCode = codes.find((c) => c.kod === sel.kod)!;
  const evidence = suggestion.aktiviteter.filter((a) => a.datum === sel.day && a.regelkod === sel.kod);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(csv);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Webbläsaren nekade urklipp; texten går att markera i rutan.
    }
  };

  return (
    <>
      <div className="summary">
        <div className={`stat ${weekTotal !== target ? "warn" : ""}`}>
          <b>
            {fmt(weekTotal)} / {target} h
          </b>
          <span>Rapporterat</span>
        </div>
        <div className="stat">
          <b>{fmt(billable)} h</b>
          <span>Debiterbart, {Math.round((billable / Math.max(weekTotal, 1)) * 100)} %</span>
        </div>
        <div className={`stat ${unsure ? "warn" : ""}`}>
          <b>{unsure}</b>
          <span>Osäkra rader att kontrollera</span>
        </div>
        <div className={`stat ${offDays ? "warn" : ""}`}>
          <b>{offDays}</b>
          <span>Dagar som inte går ihop</span>
        </div>
      </div>

      <div className="comment">
        <span className="eyebrow">
          Förslagets sammanfattning{suggestion.metod === "regler" ? ", bara regler utan AI" : ""}
        </span>
        <p>{suggestion.kommentar}</p>
      </div>

      <div className="layout">
        <div className="sheet">
          <table>
            <thead>
              <tr>
                <th className="code">Tidkod</th>
                {days.map((d) => (
                  <th key={d} style={{ textAlign: "right", paddingRight: 12 }}>
                    {dayLabel(d, { weekday: "short" })}
                    <small>{dayLabel(d, { day: "numeric", month: "numeric" })}</small>
                  </th>
                ))}
                <th className="sum">Summa</th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.kod}>
                  <th className="code" scope="row">
                    <b>
                      {c.kod}
                      <span className={`tag ${c.debiterbar ? "" : "int"}`}>{c.debiterbar ? "Debiterbar" : "Intern"}</span>
                    </b>
                    <span>{c.namn}</span>
                  </th>
                  {days.map((d) => {
                    const k = key(c.kod, d);
                    const h = hours[k];
                    const row = rowByKey.get(k);
                    const isSel = selKey === k;
                    const cls = [
                      "cellbtn",
                      h === 0 && "empty",
                      isSel && "sel",
                      h !== original[k] && "edited",
                      row?.sakerhet === "lag" && !isSel && "lagcell",
                    ]
                      .filter(Boolean)
                      .join(" ");
                    return (
                      <td className="cell" key={d}>
                        <button
                          type="button"
                          className={cls}
                          onClick={() => setSel({ kod: c.kod, day: d })}
                          aria-label={`${c.kod} ${dayLabel(d, { weekday: "long" })}: ${h} timmar`}
                        >
                          {row && <i className={`dot ${row.sakerhet}`} />}
                          <span className="h">{fmt(h)}</span>
                        </button>
                      </td>
                    );
                  })}
                  <td className="sum">{fmt(codeTotal(c.kod))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="label">Per dag, mål {hoursPerDay} h</td>
                {days.map((d) => (
                  <td key={d} className={dayTotal(d) !== hoursPerDay ? "off" : ""}>
                    {fmt(dayTotal(d))}
                  </td>
                ))}
                <td>{fmt(weekTotal)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="legend">
            <span>
              <i className="dot hog" /> Säkert
            </span>
            <span>
              <i className="dot medel" /> Troligt
            </span>
            <span>
              <i className="dot lag" /> Osäkert, kontrollera
            </span>
            <span>
              <u>Understruken</u> siffra har du ändrat
            </span>
          </div>
        </div>

        <aside aria-live="polite">
          <div>
            <div className="eyebrow">{dayLabel(sel.day, { weekday: "long", day: "numeric", month: "long" })}</div>
            <h2>{selCode.namn}</h2>
          </div>
          <div className="hours">
            <label htmlFor="hin">Timmar</label>
            <div className="stepper">
              <button type="button" aria-label="Minska en halvtimme" onClick={() => setCell(selKey, hours[selKey] - 0.5)}>
                −
              </button>
              <input
                id="hin"
                key={`${selKey}-${hours[selKey]}`}
                inputMode="decimal"
                defaultValue={String(hours[selKey]).replace(".", ",")}
                onBlur={(e) => setCell(selKey, Number(e.target.value.replace(",", ".")))}
              />
              <button type="button" aria-label="Öka en halvtimme" onClick={() => setCell(selKey, hours[selKey] + 0.5)}>
                +
              </button>
            </div>
            {hours[selKey] !== original[selKey] && (
              <button type="button" className="btn" onClick={() => setCell(selKey, original[selKey])}>
                Återställ
              </button>
            )}
          </div>
          {selRow ? (
            <>
              <span className="conf">
                <i className={`dot ${selRow.sakerhet}`} />
                {CONFIDENCE[selRow.sakerhet]}
              </span>
              <p className="why">{selRow.motivering}</p>
            </>
          ) : (
            <p className="empty-note">Inget förslag för den här dagen.</p>
          )}
          {evidence.length > 0 && (
            <>
              <div className="eyebrow">Underlag</div>
              <ul className="acts">
                {evidence.map((a, i) => (
                  <li key={i}>
                    <span className="src">{SOURCE[a.kalla][0]}</span>
                    <span>{a.titel}</span>
                    <small>
                      {SOURCE[a.kalla][1]}
                      {a.minuter ? ` · ${a.minuter} min` : a.domaner.length ? ` · ${a.domaner.join(", ")}` : ""}
                    </small>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>

      {suggestion.varningar.length > 0 && (
        <ul className="warnlist">
          {suggestion.varningar.map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
      )}

      <div className="actions">
        <button className="btn primary" type="button" disabled={approved} onClick={() => update(hours, true)}>
          {approved ? "Godkänd" : "Godkänn veckan"}
        </button>
        {approved && <span className="approved">✓ Godkänd. Klar att föra över till xLedger.</span>}
      </div>

      {approved && (
        <section className="csv">
          <div className="actions">
            <span className="eyebrow">Underlag för import till xLedger</span>
            <button className="btn" type="button" onClick={copy}>
              Kopiera
            </button>
            {copied && <span className="empty-note">Kopierat</span>}
          </div>
          <pre>{csv}</pre>
        </section>
      )}
    </>
  );
}
