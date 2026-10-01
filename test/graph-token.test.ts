import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("../auth", () => ({ refreshGraphToken: vi.fn() }));

const { freshAccessToken } = await import("../lib/graph-token");

describe("Graph-token", () => {
  const now = 1_000_000;

  it("använder token som fortfarande gäller", async () => {
    const refresh = vi.fn();
    expect(await freshAccessToken({ accessToken: "a", expiresAt: now + 600, refreshToken: "r1" }, refresh, now)).toBe("a");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("förnyar en utgången token och återanvänder den nya", async () => {
    const refresh = vi.fn().mockResolvedValue({ accessToken: "ny", expiresAt: now + 3600 });
    const old = { accessToken: "gammal", expiresAt: now - 10, refreshToken: "r2" };
    expect(await freshAccessToken(old, refresh, now)).toBe("ny");
    expect(await freshAccessToken(old, refresh, now + 60)).toBe("ny");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("ger ingen token när förnyelsen misslyckas", async () => {
    const refresh = vi.fn().mockResolvedValue({ error: "RefreshFailed" });
    expect(await freshAccessToken({ accessToken: "x", expiresAt: now - 10, refreshToken: "r3" }, refresh, now)).toBeUndefined();
  });
});
