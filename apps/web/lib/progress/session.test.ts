import { afterEach, describe, expect, it, vi } from "vitest";
import { hasActiveSession } from "./session";

describe("hasActiveSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns false when the session endpoint reports no user", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: null }) }),
    );
    await expect(hasActiveSession()).resolves.toBe(false);
  });

  it("returns true when the session endpoint reports a real user", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: { id: "u1" } }) }),
    );
    await expect(hasActiveSession()).resolves.toBe(true);
  });

  it("returns false on a non-2xx response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(hasActiveSession()).resolves.toBe(false);
  });

  it("returns false on a network failure, never throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network error")));
    await expect(hasActiveSession()).resolves.toBe(false);
  });
});
