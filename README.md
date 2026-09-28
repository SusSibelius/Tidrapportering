# Tidrapportering

Föreslår veckans tidrapport utifrån det du faktiskt gjort: kalendermöten, mail och hur du brukar rapportera. Du granskar förslaget och får ut en CSV att föra in i xLedger.

Det här är prototypen (fas 1 i startplanen). Den kör från kommandoraden och är till för att testa hur bra förslagen blir innan vi bygger ett gränssnitt.

## Kom igång

Kräver Node 22 eller senare.

```bash
npm install
npm run forslag -- --utan-ai --historik data/exempel-historik.csv --facit data/exempel-facit.csv
```

Det kör exempelveckan (2026-W38) med bara regler och jämför med facit. För att låta Claude göra förslaget behövs en API-nyckel:

```bash
export ANTHROPIC_API_KEY=...
npm run forslag -- --historik data/exempel-historik.csv --facit data/exempel-facit.csv
```

## Hur ett förslag byggs

1. **Aktiviteter** hämtas från en källa och normaliseras till samma form (datum, titel, personer, domäner, längd, kort utdrag).
2. **Regler** i `tidkoder.json` kopplar maildomäner och nyckelord till tidkoder, t.ex. `kundab.se` → `KUNDAB-INT`.
3. **Historik** från tidigare veckor blir ett snitt per veckodag och tidkod.
4. **Claude** (`claude-opus-5`) får allt ovan och föreslår timmar per dag och tidkod, med motivering och säkerhet per rad. Med `--utan-ai` görs i stället en enkel regelbaserad fördelning, som är bra att jämföra mot.
5. **Normalisering** tar bort okända koder, avrundar till halvtimmar och varnar när en dag inte går ihop.

## Egna tidkoder

Kopiera `data/tidkoder.example.json` till `data/tidkoder.json` (som inte checkas in) och fyll i dina egna kunder, koder, domäner och nyckelord.

## Koppla in Microsoft 365

1. Registrera en app i [Microsoft Entra ID](https://entra.microsoft.com) under *App registrations*.
2. Under *Authentication*: lägg till plattformen *Mobile and desktop applications* och slå på *Allow public client flows*.
3. Under *API permissions*: lägg till de delegerade behörigheterna `Calendars.Read` och `Mail.Read` från Microsoft Graph.
4. Kör:

```bash
export MS_CLIENT_ID=<Application (client) ID>
export MS_TENANT_ID=<Directory (tenant) ID>   # valfritt, standard är "organizations"
npm run forslag -- --kalla m365 --vecka 2026-W39
```

Första gången visas en kod att logga in med i webbläsaren. Inloggningen sparas i `.token-cache.json` (checkas inte in).

Från mail sparas bara ämnesrad, adresser och de första 200 tecknen, aldrig hela mailet.

## Mät hur bra förslagen är

Exportera några veckors riktiga tidrapporter som CSV (`datum;kod;timmar`) och kör med `--facit`. Då skrivs träffsäkerheten ut: hur stor andel av dina timmar som hamnade på rätt dag och tidkod.

## Kommandon

| Kommando | Vad det gör |
|---|---|
| `npm run forslag -- --help` | Alla flaggor |
| `npm test` | Enhetstester |
| `npm run typecheck` | Typkontroll |
