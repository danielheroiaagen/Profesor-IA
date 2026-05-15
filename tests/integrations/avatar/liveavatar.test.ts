import { describe, expect, it, vi } from "vitest";

import { mintLiveAvatarSessionToken } from "@/integrations/avatar/liveavatar";

const HEYGEN_API_KEY = "heygen-secret-never-returned";

describe("LiveAvatar session token adapter", () => {
  it("mints a limited browser session token without returning the provider key", async () => {
    const fetchImpl = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        expect(String(url)).toBe("https://api.liveavatar.com/v1/sessions/token");
        expect(init?.headers).toMatchObject({
          "X-API-KEY": HEYGEN_API_KEY,
          Accept: "application/json",
          "Content-Type": "application/json",
        });
        expect(JSON.parse(String(init?.body))).toMatchObject({
          mode: "LITE",
          avatar_id: "552426f4e4584a24871c5ffad2a97f73",
        });

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
      apiKey: HEYGEN_API_KEY,
      avatarId: "552426f4e4584a24871c5ffad2a97f73",
      fetchImpl,
    });

    const serialized = JSON.stringify(liveAvatar);

    expect(liveAvatar).toEqual({
      provider: "liveavatar",
      mode: "live",
      avatarId: "552426f4e4584a24871c5ffad2a97f73",
      sessionId: "live-session-1",
      sessionToken: "live-token-limited",
    });
    expect(serialized).not.toContain(HEYGEN_API_KEY);
  });

  it("fails before calling the provider when the server key is missing", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    await expect(
      mintLiveAvatarSessionToken({
        avatarId: "552426f4e4584a24871c5ffad2a97f73",
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      reason: "avatar-live-provider-not-configured",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
