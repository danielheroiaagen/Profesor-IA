import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/../app/api/lessons/start/route";
import { resetRateLimitsForTests } from "@/server/rate-limit";

const HEYGEN_API_KEY = "heygen-secret-never-returned";

describe("POST /api/lessons/start", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetRateLimitsForTests();
  });

  it("starts a lesson with a server-validated avatar status and no key leakage", async () => {
    vi.stubEnv("HEYGEN_API_KEY", HEYGEN_API_KEY);
    vi.stubEnv("HEYGEN_AVATAR_ID", "avatar-route");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        expect(String(url)).toBe(
          "https://api.heygen.com/v2/avatar/avatar-route/details",
        );
        expect(init?.headers).toMatchObject({
          "X-API-KEY": HEYGEN_API_KEY,
          Accept: "application/json",
        });

        return Response.json({ data: { avatar_id: "avatar-route" } });
      }),
    );

    const response = await POST(startRequest());
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(201);
    expect(body.avatar).toEqual({
      mode: "static",
      available: true,
      avatarId: "avatar-route",
      reason: "avatar-validated",
    });
    expect(body.lesson.state).toBe("active");
    expect(body.lessonAccessToken).toEqual(expect.any(String));
    expect(body.lessonAccessToken).not.toHaveLength(0);
    expect(serialized).not.toContain(HEYGEN_API_KEY);
    expect(serialized).not.toContain("HEYGEN_API_KEY");
  });

  it("prefers a validated LiveAvatar session when the live provider is configured", async () => {
    vi.stubEnv("LIVEAVATAR_API_KEY", "liveavatar-secret-never-returned");
    vi.stubEnv("HEYGEN_AVATAR_ID", "avatar-live");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        expect(String(url)).toBe(
          "https://api.liveavatar.com/v1/avatars/avatar-live",
        );
        expect(init?.headers).toMatchObject({
          "X-API-KEY": "liveavatar-secret-never-returned",
          Accept: "application/json",
        });

        return Response.json({ data: { avatar_id: "avatar-live" } });
      }),
    );

    const response = await POST(startRequest());
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(201);
    expect(body.avatar).toEqual({
      mode: "live",
      available: true,
      avatarId: "avatar-live",
      reason: "avatar-live-validated",
    });
    expect(serialized).not.toContain("liveavatar-secret-never-returned");
    expect(serialized).not.toContain("LIVEAVATAR_API_KEY");
  });

  it("starts a voice-only lesson when the avatar provider is disabled", async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);

    const response = await POST(startRequest());
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(201);
    expect(body.avatar).toEqual({
      mode: "voice-only",
      available: false,
      reason: "avatar-provider-not-configured",
    });
    expect(body.lesson.state).toBe("active");
    expect(body.lessonAccessToken).toEqual(expect.any(String));
    expect(body.lessonAccessToken).not.toHaveLength(0);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(serialized).not.toContain("HEYGEN_API_KEY");
  });

  it("rejects cross-site lesson starts before provider calls", async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);

    const response = await POST(
      new Request("http://localhost/api/lessons/start", {
        method: "POST",
        headers: {
          origin: "https://attacker.example",
          "sec-fetch-site": "cross-site",
          "x-forwarded-for": "203.0.113.10",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("cross-site-request-denied");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rate limits excessive lesson starts before provider calls", async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);

    let response = await POST(startRequest());

    expect(response.status).toBe(201);

    for (let index = 0; index < 20; index += 1) {
      response = await POST(startRequest());
    }

    const body = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
    expect(body.error.code).toBe("rate-limit-exceeded");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

function startRequest() {
  return new Request("http://localhost/api/lessons/start", {
    method: "POST",
    headers: { "x-forwarded-for": "203.0.113.10" },
  });
}
