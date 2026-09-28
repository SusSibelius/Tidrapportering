import type { BaselineRow } from "./baseline";
import { normalize } from "./normalize";
import { applyRules } from "./rules";
import { suggestWithClaude, suggestWithRules } from "./suggest";
import type { Activity, Config, SuggestionRow } from "./types";

export interface WeekSuggestion {
  rader: SuggestionRow[];
  varningar: string[];
  kommentar: string;
  /** Aktiviteterna efter att reglerna körts, så att gränssnittet kan visa underlaget. */
  aktiviteter: Activity[];
  metod: "claude" | "regler";
}

/** Hela kedjan: regler, förslag (Claude eller bara regler) och normalisering. */
export async function suggestWeek(
  days: string[],
  rawActivities: Activity[],
  config: Config,
  history: BaselineRow[],
  useClaude: boolean,
): Promise<WeekSuggestion> {
  const aktiviteter = applyRules(rawActivities, config.tidkoder);
  const suggestion = useClaude
    ? await suggestWithClaude(days, aktiviteter, config, history)
    : suggestWithRules(days, aktiviteter, config);
  const { rader, varningar } = normalize(suggestion.rader, days, config.tidkoder, config.timmarPerDag);
  return { rader, varningar, kommentar: suggestion.kommentar, aktiviteter, metod: useClaude ? "claude" : "regler" };
}
