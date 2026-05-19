import { describe, expect, it, vi } from "vitest";

import {
  createLiveAvatarAdapter,
  mintLiveAvatarSessionToken,
} from "@/integrations/avatar/liveavatar";

const LIVEAVATAR_API_KEY = "test";
const AVATAR_ID = "e29e792a-41e7-4df0-84a8-349e099fb50f";

describe("LiveAvatar adapter", () => {
  it("validates a live avatar server-side without returning the provider key", async () => {
    const fetchImpl = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        expect(String(url)).toBe(
          `https://api.liveavatar.com/v1/avatars/${AVATAR_ID}`,
        );
        expect(init?.headers).toMatchObject({
          "X-API-KEY": LIVEAVATAR_API_KEY,
          Accept: "application/json",
        });

        return Response.json({ data: { id: AVATAR_ID, status: "ACTIVE" } });
      },
    ) as typeof fetch;

    const status = await createLiveAvatarAdapter({
      apiKey: LIVEAVATAR_API_KEY,
      avatarId: AVATAR_ID,
      fetchImpl,
    }).getStatus({ lessonId: "lesson-1" });

    expect(status).toEqual({
      mode: "live",
      available: true,
      avatarId: AVATAR_ID,
      reason: "avatar-live-validated",
    });
    expect(JSON.stringify(status)).not.toContain(LIVEAVATAR_API_KEY);
  });

  it("falls back safely when the live avatar key is missing", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    const status = await createLiveAvatarAdapter({
      avatarId: AVATAR_ID,
      fetchImpl,
    }).getStatus({ lessonId: "lesson-1" });

    expect(status).toEqual({
      mode: "voice-only",
      available: false,
      reason: "avatar-live-provider-not-configured",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("LiveAvatar session token adapter", () => {
  it("mints a LITE-mode visual browser session token without persona voice ownership", async () => {
    const fetchImpl = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        const value = String(url);

        expect(value).toBe("https://api.liveavatar.com/v1/sessions/token");
        expect(init?.headers).toMatchObject({
          "X-API-KEY": LIVEAVATAR_API_KEY,
          Accept: "application/json",
          "Content-Type": "application/json",
        });
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({
          mode: "LITE",
          avatar_id: AVATAR_ID,
          video_settings: {
            quality: "high",
            encoding: "VP8",
          },
        });
        expect(body).not.toHaveProperty("avatar_persona");
        expect(body).not.toHaveProperty("interactivity_type");
        expect(JSON.stringify(body)).not.toContain("voice_id");
        expect(JSON.stringify(body)).not.toContain("context_id");

        return Response.json({
          code: 1000,
          data: {
            session_id: "live-session-1",
            session_token: "live-token-limited",
          },
        });
      },
    ) as typeof fetch;

    const liveAvatar = await mintLiveAvatarSessionToken({
      apiKey: LIVEAVATAR_API_KEY,
      avatarId: AVATAR_ID,
      fetchImpl,
    });

    const serialized = JSON.stringify(liveAvatar);

    expect(liveAvatar).toEqual({
      provider: "liveavatar",
      mode: "live",
      avatarId: AVATAR_ID,
      sessionId: "live-session-1",
      sessionToken: "live-token-limited",
    });
    expect(serialized).not.toContain(LIVEAVATAR_API_KEY);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("fails before calling the provider when the server key is missing", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    await expect(
      mintLiveAvatarSessionToken({
        avatarId: AVATAR_ID,
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      reason: "avatar-live-provider-not-configured",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
