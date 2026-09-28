import { readFile } from "node:fs/promises";
import { auth, microsoftConfigured } from "../auth";
import { baseline } from "../src/baseline";
import { readConfig } from "../src/config";
import { parseEntries } from "../src/csv";
import { suggestWeek } from "../src/engine";
import { loadM365Activities } from "../src/sources/m365";
import { loadSampleActivities } from "../src/sources/sample";
import { graphToken } from "./graph-token";

/** Veckan som exempeldatan gäller. */
export const DEMO_WEEK = "2026-W38";

/** Utan inloggning visas exempeldata. */
export async function isDemo(): Promise<boolean> {
  if (!microsoftConfigured || !(await auth())) return true;
  return !(await graphToken());
}

async function readHistory(path: string) {
  try {
    return baseline(parseEntries(await readFile(path, "utf8")));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
}

export async function loadWeek(days: string[], demo: boolean) {
  const config = await readConfig();
  const token = demo ? undefined : await graphToken();
  const raw = token
    ? await loadM365Activities(token, days, config.tidszon, config.egenDoman)
    : await loadSampleActivities("data/exempel-aktiviteter.json", days);
  const history = await readHistory(demo ? "data/exempel-historik.csv" : "data/historik.csv");
  const useClaude = Boolean(process.env.ANTHROPIC_API_KEY);
  const suggestion = await suggestWeek(days, raw, config, history, useClaude);
  return { config, suggestion };
}
