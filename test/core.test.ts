import { describe, expect, it } from "vitest";
import { baseline } from "../src/baseline.js";
import { compare } from "../src/compare.js";
import { parseEntries, toCsv } from "../src/csv.js";
import { normalize, roundToHalf } from "../src/normalize.js";
import { applyRules, externalDomains } from "../src/rules.js";
import { suggestWithRules } from "../src/suggest.js";
import { ConfigSchema, type Activity } from "../src/types.js";
import { isoWeekOf, localDate, workdays } from "../src/week.js";

const config = ConfigSchema.parse({
  timmarPerDag: 8,
  tidkoder: [
    { kod: "KUND", namn: "Kund", debiterbar: true, domaner: ["kund.se"] },
    { kod: "INTERN", namn: "Intern", debiterbar: false, nyckelord: ["veckomöte"] },
  ],
});

const activity = (a: Partial<Activity>): Activity => ({
  kalla: "kalender",
  datum: "2026-09-14",
  titel: "",
  personer: [],
  domaner: [],
  ...a,
});

describe("veckor", () => {
  it("ger måndag–fredag för en ISO-vecka", () => {
    expect(workdays("2026-W38")).toEqual(["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"]);
  });
  it("hanterar årsskiften", () => {
    expect(workdays("2026-W53")[0]).toBe("2026-12-28");
    expect(isoWeekOf(new Date(2027, 0, 1))).toBe("2026-W53");
    expect(isoWeekOf(new Date(2026, 8, 18))).toBe("2026-W38");
  });
  it("räknar lokalt datum i Stockholm", () => {
    expect(localDate("2026-09-14T22:30:00Z", "Europe/Stockholm")).toBe("2026-09-15");
  });
});

describe("regler", () => {
  it("matchar domän före nyckelord", () => {
    const [a, b, c] = applyRules(
      [
        activity({ titel: "Veckomöte", domaner: ["kund.se"] }),
        activity({ titel: "Veckomöte avdelningen" }),
        activity({ titel: "Lunch" }),
      ],
      config.tidkoder,
    );
    expect(a.regelkod).toBe("KUND");
    expect(b.regelkod).toBe("INTERN");
    expect(c.regelkod).toBeUndefined();
  });
  it("tar bort den egna domänen", () => {
    expect(externalDomains(["a@eget.se", "b@Kund.se", "c@kund.se"], "eget.se")).toEqual(["kund.se"]);
  });
});

describe("normalisering", () => {
  const days = ["2026-09-14"];
  it("avrundar till halvtimmar och slår ihop dubbletter", () => {
    expect(roundToHalf(1.26)).toBe(1.5);
    const { rader, varningar } = normalize(
      [
        { datum: "2026-09-14", kod: "KUND", timmar: 3.2, motivering: "a", sakerhet: "hog" },
        { datum: "2026-09-14", kod: "KUND", timmar: 3.3, motivering: "b", sakerhet: "hog" },
        { datum: "2026-09-14", kod: "INTERN", timmar: 1.5, motivering: "c", sakerhet: "lag" },
      ],
      days,
      config.tidkoder,
      8,
    );
    expect(rader.map((r) => [r.kod, r.timmar])).toEqual([
      ["INTERN", 1.5],
      ["KUND", 6.5],
    ]);
    expect(varningar).toEqual([]);
  });
  it("behåller dagens summa när raderna avrundas", () => {
    const { rader, varningar } = normalize(
      [
        { datum: "2026-09-14", kod: "KUND", timmar: 5.25, motivering: "", sakerhet: "hog" },
        { datum: "2026-09-14", kod: "INTERN", timmar: 2.75, motivering: "", sakerhet: "lag" },
      ],
      days,
      config.tidkoder,
      8,
    );
    expect(rader.reduce((s, r) => s + r.timmar, 0)).toBe(8);
    expect(varningar).toEqual([]);
  });
  it("tar bort okända koder och varnar när dagen inte går ihop", () => {
    const { rader, varningar } = normalize(
      [{ datum: "2026-09-14", kod: "PÅHITTAD", timmar: 8, motivering: "", sakerhet: "lag" }],
      days,
      config.tidkoder,
      8,
    );
    expect(rader).toEqual([]);
    expect(varningar).toHaveLength(2);
  });
});

describe("regelbaserat förslag", () => {
  it("ger möten sin tid och fördelar resten efter mail", () => {
    const activities = applyRules(
      [
        activity({ titel: "Veckomöte", minuter: 60 }),
        activity({ kalla: "mail-skickat", titel: "Fråga", domaner: ["kund.se"] }),
      ],
      config.tidkoder,
    );
    const { rader } = suggestWithRules(["2026-09-14"], activities, config);
    expect(rader.map((r) => [r.kod, r.timmar])).toEqual([
      ["INTERN", 1],
      ["KUND", 7],
    ]);
  });
});

describe("CSV, historik och jämförelse", () => {
  it("läser tillbaka det den skriver", () => {
    const csv = toCsv([{ datum: "2026-09-14", kod: "KUND", timmar: 2.5, motivering: "möte; mail", sakerhet: "hog" }]);
    expect(csv).toContain("2,5");
    expect(parseEntries(csv)).toEqual([{ datum: "2026-09-14", kod: "KUND", timmar: 2.5 }]);
  });
  it("räknar snitt per veckodag över veckorna", () => {
    const rows = baseline([
      { datum: "2026-09-07", kod: "KUND", timmar: 6 },
      { datum: "2026-09-14", kod: "KUND", timmar: 8 },
    ]);
    expect(rows).toEqual([{ veckodag: "måndag", kod: "KUND", snittTimmar: 7 }]);
  });
  it("mäter träffsäkerhet mot facit", () => {
    const c = compare(
      [
        { datum: "d", kod: "KUND", timmar: 6 },
        { datum: "d", kod: "INTERN", timmar: 2 },
      ],
      [{ datum: "d", kod: "KUND", timmar: 8 }],
    );
    expect(c.traffsakerhet).toBe(0.75);
    expect(c.avvikelseTimmar).toBe(4);
  });
});
