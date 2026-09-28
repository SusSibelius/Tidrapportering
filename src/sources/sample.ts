import { readFile } from "node:fs/promises";
import { z } from "zod";
import { ActivitySchema, type Activity } from "../types";

/** Läser aktiviteter från en JSON-fil, så att prototypen går att köra utan Microsoft 365. */
export async function loadSampleActivities(path: string, days: string[]): Promise<Activity[]> {
  const raw = JSON.parse(await readFile(path, "utf8"));
  const activities = z.array(ActivitySchema).parse(raw);
  return activities.filter((a) => days.includes(a.datum));
}
