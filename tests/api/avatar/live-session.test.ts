import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/../app/api/avatar/live-session/route";

const HEYGEN_API_KEY = "heygen-secret-never-returned";

describe("POST /api/avatar/live-session", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns a limited live avatar session and no primary key", async () => {
    vi.stubEnv("HEYGEN_API_KEY", HEYGEN_API_KEY);
    vi.stubEnv("HEYGEN_AVATAR_ID", "552426f4e4584a24871c5ffad2a97f73");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          code: 1000,
          data: {
            session_id: "live-session-route",
            session_token: "live-token-limited",
          },
        }),
      ),
    );

    const response = await POST();
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(201);
    expect(body.liveAvatar).toMatchObject({
      provider: "liveavatar",
      mode: "live",
      avatarId: "552426f4e4584a24871c5ffad2a97f73",
      sessionId: "live-session-route",
    });
    expect(serialized).not.toContain(HEYGEN_API_KEY);
    expect(serialized).not.toContain("HEYGEN_API_KEY");
  });

  it("fails safely without a configured provider key", async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);

    const response = await POST();
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(502);
    expect(body.error.code).toBe("avatar-live-provider-not-configured");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(serialized).not.toContain("HEYGEN_API_KEY");
    expect(serialized).not.toContain(".env");
  });
});
