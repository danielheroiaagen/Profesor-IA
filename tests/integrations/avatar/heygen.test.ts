import { describe, expect, it, vi } from "vitest";

import { createHeyGenAvatarAdapter } from "@/integrations/avatar/heygen";

const HEYGEN_API_KEY = "heygen-secret-never-returned";

describe("HeyGen avatar adapter", () => {
  it("falls back to voice-only when the provider key is not configured", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    const status = await createHeyGenAvatarAdapter({
      avatarId: "avatar-1",
      fetchImpl,
    }).getStatus({ lessonId: "lesson-1" });

    expect(status).toEqual({
      mode: "voice-only",
      available: false,
      reason: "avatar-provider-not-configured",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("validates an avatar server-side without returning the primary key", async () => {
    const fetchImpl = vi.fn(
      async (url: string | URL | Request, init?: RequestInit) => {
        expect(String(url)).toBe(
          "https://api.heygen.com/v2/avatar/avatar-1/details",
        );
        expect(init?.headers).toMatchObject({
          "X-API-KEY": HEYGEN_API_KEY,
          Accept: "application/json",
        });

        return Response.json({ data: { avatar_id: "avatar-1" } });
      },
    ) as typeof fetch;

    const status = await createHeyGenAvatarAdapter({
      apiKey: HEYGEN_API_KEY,
      avatarId: "avatar-1",
      fetchImpl,
    }).getStatus({ lessonId: "lesson-1" });

    expect(status).toEqual({
      mode: "static",
      available: true,
      avatarId: "avatar-1",
      reason: "avatar-validated",
    });
    expect(JSON.stringify(status)).not.toContain(HEYGEN_API_KEY);
  });

  it("returns a static fallback when the configured avatar is not listed", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ data: { avatar_id: "different-avatar" } }),
    ) as typeof fetch;

    const status = await createHeyGenAvatarAdapter({
      apiKey: HEYGEN_API_KEY,
      avatarId: "avatar-1",
      fetchImpl,
    }).getStatus({ lessonId: "lesson-1" });

    expect(status).toEqual({
      mode: "static",
      available: false,
      avatarId: "avatar-1",
      reason: "avatar-provider-rejected",
    });
  });

  it("returns a static fallback when the provider rejects the avatar", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ error: "rejected" }, { status: 403 }),
    ) as typeof fetch;

    const status = await createHeyGenAvatarAdapter({
      apiKey: HEYGEN_API_KEY,
      avatarId: "avatar-1",
      fetchImpl,
    }).getStatus({ lessonId: "lesson-1" });

    expect(status).toEqual({
      mode: "static",
      available: false,
      avatarId: "avatar-1",
      reason: "avatar-provider-rejected",
    });
  });

  it("returns a static fallback when the provider is slow or unavailable", async () => {
    const fetchImpl = vi.fn(
      () => new Promise<Response>(() => undefined),
    ) as unknown as typeof fetch;

    const status = await createHeyGenAvatarAdapter({
      apiKey: HEYGEN_API_KEY,
      avatarId: "avatar-1",
      fetchImpl,
      timeoutMs: 1,
    }).getStatus({ lessonId: "lesson-1" });

    expect(status).toEqual({
      mode: "static",
      available: false,
      avatarId: "avatar-1",
      reason: "avatar-provider-unavailable",
    });
  });

  it("falls back safely when the avatar id is blank", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch;

    const status = await createHeyGenAvatarAdapter({
      apiKey: HEYGEN_API_KEY,
      avatarId: "   ",
      fetchImpl,
    }).getStatus({ lessonId: "lesson-1" });

    expect(status).toEqual({
      mode: "voice-only",
      available: false,
      reason: "avatar-id-not-configured",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
