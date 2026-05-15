import { describe, expect, it, vi } from "vitest";

import { mintLiveAvatarSessionToken } from "@/integrations/avatar/liveavatar";

const LIVEAVATAR_API_KEY = "liveavatar-secret-never-returned";

describe("LiveAvatar session token adapter", () => {
  it("mints a limited browser session token without returning the provider key", async () => {
    const fetchImpl = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        expect(String(url)).toBe(
          "https://api.liveavatar.com/v1/sessions/token",
        );
        expect(init?.headers).toMatchObject({
          "X-API-KEY": LIVEAVATAR_API_KEY,
          Accept: "application/json",
          "Content-Type": "application/json",
        });
        expect(JSON.parse(String(init?.body))).toMatchObject({
          mode: "LITE",
          avatar_id: "e29e792a-41e7-4df0-84a8-349e099fb50f",
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
      apiKey: LIVEAVATAR_API_KEY,
      avatarId: "e29e792a-41e7-4df0-84a8-349e099fb50f",
      fetchImpl,
    });

    const serialized = JSON.stringify(liveAvatar);

    expect(liveAvatar).toEqual({
      provider: "liveavatar",
      mode: "live",
      avatarId: "e29e792a-41e7-4df0-84a8-349e099fb50f",
      sessionId: "live-session-1",
      sessionToken: "live-token-limited",
    });
    expect(serialized).not.toContain(LIVEAVATAR_API_KEY);
  });

  it("fails before calling the provider when the server key is missing", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    await expect(
      mintLiveAvatarSessionToken({
        avatarId: "e29e792a-41e7-4df0-84a8-349e099fb50f",
        fetchImpl,
      }),
    ).rejects.toMatchObject({
      reason: "avatar-live-provider-not-configured",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
