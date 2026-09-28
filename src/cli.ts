import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { baseline } from "./baseline";
import { compare } from "./compare";
import { parseEntries, toCsv } from "./csv";
import { readConfig } from "./config";
import { suggestWeek } from "./engine";
import { loadM365Activities } from "./sources/m365";
import { getCliToken } from "./sources/m365-cli-auth";
import { loadSampleActivities } from "./sources/sample";
import { previousWeek, workdays } from "./week";

const HELP = `Föreslår en tidrapport för en vecka.

Användning: npm run forslag -- [flaggor]

  --vecka <2026-W39>     Vecka att föreslå (standard: förra veckan)
  --kalla <exempel|m365> Varifrån aktiviteterna hämtas (standard: exempel)
  --aktiviteter <fil>    JSON med aktiviteter när källan är exempel
  --config <fil>         Tidkoder och arbetstid (standard: data/tidkoder.json, annars exempelfilen)
  --historik <fil>       CSV med tidigare tidrapporter (datum;kod;timmar)
  --facit <fil>          CSV med vad du faktiskt rapporterade, för jämförelse
  --ut <fil>             Skriv förslaget som CSV
  --utan-ai              Bara regler, inget anrop till Claude
  --help                 Visa den här texten`;

async function main() {
  const { values: args } = parseArgs({
    options: {
      vecka: { type: "string" },
      kalla: { type: "string", default: "exempel" },
      aktiviteter: { type: "string", default: "data/exempel-aktiviteter.json" },
      config: { type: "string" },
      historik: { type: "string" },
      facit: { type: "string" },
      ut: { type: "string" },
      "utan-ai": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
  });
  if (args.help) return console.log(HELP);

  const config = await readConfig(args.config);
  const week = args.vecka ?? (args.kalla === "exempel" ? "2026-W38" : previousWeek());
  const days = workdays(week);

  const raw =
    args.kalla === "m365"
      ? await loadM365Activities(await getCliToken(), days, config.tidszon, config.egenDoman)
      : await loadSampleActivities(args.aktiviteter!, days);
  const history = args.historik ? baseline(parseEntries(await readFile(args.historik, "utf8"))) : [];
  const { rader, varningar, kommentar, aktiviteter } = await suggestWeek(days, raw, config, history, !args["utan-ai"]);
  const matched = aktiviteter.filter((a) => a.regelkod).length;
  console.log(`Vecka ${week}: ${aktiviteter.length} aktiviteter, ${matched} matchade en regel.`);

  console.log(`\n${kommentar}\n`);
  console.table(rader.map((r) => ({ datum: r.datum, kod: r.kod, timmar: r.timmar, säkerhet: r.sakerhet, motivering: r.motivering })));
  for (const v of varningar) console.warn(`Varning: ${v}`);

  if (args.ut) {
    await writeFile(args.ut, toCsv(rader), "utf8");
    console.log(`\nSparade förslaget i ${args.ut}`);
  }

  if (args.facit) {
    const actual = parseEntries(await readFile(args.facit, "utf8")).filter((e) => days.includes(e.datum));
    const c = compare(rader, actual);
    console.log(`\nJämförelse mot facit:`);
    console.log(`  Förslag ${c.forslagTimmar} h, facit ${c.facitTimmar} h`);
    console.log(`  Träffsäkerhet ${(c.traffsakerhet * 100).toFixed(0)} % (timmar på rätt dag och kod)`);
    console.log(`  Total avvikelse ${c.avvikelseTimmar} h`);
    console.table(c.perKod);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
