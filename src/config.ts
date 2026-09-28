import { readFile } from "node:fs/promises";
import { ConfigSchema, type Config } from "./types";

/** Läser tidkoderna: den angivna filen, annars data/tidkoder.json, annars exempelfilen. */
export async function readConfig(path?: string): Promise<Config> {
  const candidates = path ? [path] : ["data/tidkoder.json", "data/tidkoder.example.json"];
  for (const p of candidates) {
    try {
      return ConfigSchema.parse(JSON.parse(await readFile(p, "utf8")));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
  throw new Error(`Hittade ingen konfiguration (${candidates.join(", ")})`);
}
