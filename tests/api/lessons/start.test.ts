import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/../app/api/lessons/start/route";

const HEYGEN_API_KEY = "heygen-secret-never-returned";

describe("POST /api/lessons/start", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
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

    const response = await POST();
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

  it("starts a voice-only lesson when the avatar provider is disabled", async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);

    const response = await POST();
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
});
