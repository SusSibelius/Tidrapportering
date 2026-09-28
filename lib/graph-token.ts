import { headers } from "next/headers";
import { getToken } from "next-auth/jwt";

/** Den inloggades Graph-token, läst direkt ur sessionskakan på servern. */
export async function graphToken(): Promise<string | undefined> {
  const token = await getToken({
    req: { headers: await headers() },
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === "production",
  });
  if (!token || token.error) return undefined;
  return typeof token.accessToken === "string" ? token.accessToken : undefined;
}
