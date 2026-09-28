# Tidrapportering

Föreslår veckans tidrapport utifrån det du faktiskt gjort: kalendermöten, mail och hur du brukar rapportera. Du granskar förslaget i en veckovy, justerar och godkänner, och får ut ett underlag att föra in i xLedger.

Projektet består av två delar som delar samma förslagsmotor (`src/`):

- **Webbappen** (`app/`), byggd med Next.js. Du loggar in med ditt Microsoft-konto och ser veckans förslag.
- **Kommandoraden** (`npm run forslag`), för att snabbt testa och mäta förslagen mot gamla veckor.

Kräver Node 22 eller senare.

## Webbappen

```bash
npm install
npm run dev
```

Öppna http://localhost:3000. Utan inloggning visas exempelveckan. För att använda din egen kalender och mail kopierar du `.env.example` till `.env.local` och fyller i värdena (se *Koppla in Microsoft 365* nedan).

Godkända veckor sparas än så länge bara i webbläsaren. En databas kommer i nästa steg.

### Lägga ut sajten på Vercel

1. Logga in på [vercel.com](https://vercel.com) med ditt GitHub-konto och välj *Add New → Project*.
2. Importera repot `tidrapportering`. Vercel känner igen Next.js själv.
3. Lägg in miljövariablerna från `.env.example` under *Environment Variables*.
4. Lägg till sajtens adress som omdirigerings-URI i Entra ID-appen: `https://<din-adress>/api/auth/callback/microsoft-entra-id`.

Utan miljövariabler fungerar sajten ändå, men visar bara exempeldata.

## Kommandoraden

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

Registrera en app i [Microsoft Entra ID](https://entra.microsoft.com) under *App registrations*. Under *API permissions* lägger du till de delegerade behörigheterna `Calendars.Read` och `Mail.Read` från Microsoft Graph.

Vilket konto ska logga in?

- **Jobbkonto** (företagets Microsoft 365): registrera appen i företagets katalog och välj *Accounts in this organizational directory only*. Sätt `AUTH_MICROSOFT_ENTRA_ID_TENANT` till katalogens ID. Kan du inte registrera appar själv behöver en administratör göra det.
- **Privat konto** (outlook.com, hotmail.com, live.se): ett privat konto har ingen egen katalog. Skapa ett gratis Azure-konto på [portal.azure.com](https://portal.azure.com), så skapas en katalog, och registrera appen där. Välj *Personal Microsoft accounts only* och sätt `AUTH_MICROSOFT_ENTRA_ID_TENANT=consumers`.

**För webbappen:**

1. Under *Authentication*: lägg till plattformen *Web* med omdirigerings-URI `http://localhost:3000/api/auth/callback/microsoft-entra-id` (och sajtens riktiga adress när den finns).
2. Under *Certificates & secrets*: skapa en klienthemlighet.
3. Fyll i `.env.local`: `AUTH_MICROSOFT_ENTRA_ID_ID` (Application ID), `AUTH_MICROSOFT_ENTRA_ID_SECRET` (hemligheten), `AUTH_MICROSOFT_ENTRA_ID_TENANT` (katalogens ID eller `consumers`, se ovan) och `AUTH_SECRET` (kör `npx auth secret`).

**För kommandoraden:**

1. Under *Authentication*: lägg till plattformen *Mobile and desktop applications* och slå på *Allow public client flows*.
2. Kör:

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
| `npm run dev` | Startar webbappen lokalt |
| `npm run build` | Bygger webbappen |
| `npm run forslag -- --help` | Alla flaggor för kommandoraden |
| `npm test` | Enhetstester |
| `npm run typecheck` | Typkontroll |
