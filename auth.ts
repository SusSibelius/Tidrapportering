import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import { GRAPH_SCOPES } from "./src/sources/m365";

const tenant = process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT ?? "organizations";
const scope = ["openid", "profile", "email", "offline_access", ...GRAPH_SCOPES].join(" ");

/** Hämtar en ny åtkomsttoken för Graph när den gamla har gått ut. */
async function refresh(token: JWT): Promise<JWT> {
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      client_secret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      refresh_token: token.refreshToken as string,
      scope,
    }),
  });
  if (!res.ok) return { ...token, error: "RefreshFailed" };
  const body = (await res.json()) as { access_token: string; expires_in: number; refresh_token?: string };
  return {
    ...token,
    accessToken: body.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + body.expires_in,
    refreshToken: body.refresh_token ?? token.refreshToken,
    error: undefined,
  };
}

export const microsoftConfigured = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: microsoftConfigured
    ? [
        MicrosoftEntraID({
          issuer: `https://login.microsoftonline.com/${tenant}/v2.0`,
          authorization: { params: { scope } },
        }),
      ]
    : [],
  callbacks: {
    // Graph-token sparas bara i den krypterade sessionskakan och skickas aldrig till webbläsaren.
    async jwt({ token, account }) {
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at,
        };
      }
      if (typeof token.expiresAt === "number" && Date.now() / 1000 > token.expiresAt - 60 && token.refreshToken) {
        return refresh(token);
      }
      return token;
    },
  },
});
