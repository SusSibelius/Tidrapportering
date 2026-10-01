import { headers } from "next/headers";
import { getToken, type JWT } from "next-auth/jwt";
import { refreshGraphToken } from "../auth";

/** Förnyade token per refresh-token, så att inte varje sidvisning frågar Microsoft på nytt. */
const renewed = new Map<string, { accessToken: string; expiresAt: number }>();

const valid = (expiresAt: unknown, now: number) => typeof expiresAt === "number" && now < expiresAt - 60;

/**
 * En giltig Graph-token ur sessionen. Microsoft-token gäller bara en timme, och sessionskakan
 * kan inte skrivas om när en sida renderas, så en utgången token förnyas här och sparas i minnet.
 */
export async function freshAccessToken(
  token: JWT,
  refresh: (token: JWT) => Promise<JWT> = refreshGraphToken,
  now = Date.now() / 1000,
): Promise<string | undefined> {
  if (token.error) return undefined;
  if (typeof token.accessToken === "string" && valid(token.expiresAt, now)) return token.accessToken;
  if (typeof token.refreshToken !== "string") return undefined;

  const cached = renewed.get(token.refreshToken);
  if (cached && valid(cached.expiresAt, now)) return cached.accessToken;

  const next = await refresh(token);
  if (next.error || typeof next.accessToken !== "string" || typeof next.expiresAt !== "number") return undefined;
  renewed.set(token.refreshToken, { accessToken: next.accessToken, expiresAt: next.expiresAt });
  return next.accessToken;
}

/** Den inloggades Graph-token, läst direkt ur sessionskakan på servern. */
export async function graphToken(): Promise<string | undefined> {
  const token = await getToken({
    req: { headers: await headers() },
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });
  return token ? freshAccessToken(token) : undefined;
}
