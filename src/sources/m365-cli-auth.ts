import { readFile, writeFile } from "node:fs/promises";
import { PublicClientApplication, type ICachePlugin } from "@azure/msal-node";
import { GRAPH_SCOPES } from "./m365";

const TOKEN_CACHE = ".token-cache.json";

/** Sparar inloggningen lokalt så att enhetskoden bara behövs första gången. */
const cachePlugin: ICachePlugin = {
  async beforeCacheAccess(ctx) {
    try {
      ctx.tokenCache.deserialize(await readFile(TOKEN_CACHE, "utf8"));
    } catch {
      // Ingen cache än.
    }
  },
  async afterCacheAccess(ctx) {
    if (ctx.cacheHasChanged) await writeFile(TOKEN_CACHE, ctx.tokenCache.serialize(), { mode: 0o600 });
  },
};

/** Inloggning för kommandoraden: enhetskod första gången, sedan sparad token. */
export async function getCliToken(): Promise<string> {
  const clientId = process.env.MS_CLIENT_ID;
  if (!clientId) throw new Error("MS_CLIENT_ID saknas, se README för hur appen registreras i Entra ID");
  const tenant = process.env.MS_TENANT_ID ?? "organizations";
  const app = new PublicClientApplication({
    auth: { clientId, authority: `https://login.microsoftonline.com/${tenant}` },
    cache: { cachePlugin },
  });

  const [account] = await app.getTokenCache().getAllAccounts();
  if (account) {
    try {
      return (await app.acquireTokenSilent({ account, scopes: GRAPH_SCOPES })).accessToken;
    } catch {
      // Faller tillbaka på enhetskod nedan.
    }
  }
  const result = await app.acquireTokenByDeviceCode({
    scopes: GRAPH_SCOPES,
    deviceCodeCallback: (r) => console.error(r.message),
  });
  if (!result) throw new Error("Inloggningen mot Microsoft 365 avbröts");
  return result.accessToken;
}
