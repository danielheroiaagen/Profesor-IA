import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/../app/api/readiness/route";

const OPENAI_SECRET = "sk-test-primary-key-never-returned";
const HEYGEN_SECRET = "heygen-test-secret-never-returned";
const LIVEAVATAR_SECRET = "liveavatar-test-secret-never-returned";

describe("GET /api/readiness", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns ready status without leaking configured secrets", async () => {
    vi.stubEnv("OPENAI_API_KEY", OPENAI_SECRET);
    vi.stubEnv("OPENAI_REALTIME_MODEL", "gpt-realtime-2");
    vi.stubEnv("LIVEAVATAR_API_KEY", LIVEAVATAR_SECRET);
    vi.stubEnv("HEYGEN_AVATAR_ID", "avatar-test-id");

    const response = GET();
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body).toEqual({
      status: "ready",
      checks: {
        openaiApiKeyConfigured: true,
        heygenApiKeyConfigured: false,
        liveAvatarApiKeyConfigured: true,
      },
      realtime: {
        model: "gpt-realtime-2",
      },
      avatar: {
        configured: true,
        providerConfigured: true,
        liveProviderConfigured: true,
      },
    });
    expect(serialized).not.toContain(OPENAI_SECRET);
    expect(serialized).not.toContain(HEYGEN_SECRET);
    expect(serialized).not.toContain(LIVEAVATAR_SECRET);
    expect(serialized).not.toContain("OPENAI_API_KEY");
    expect(serialized).not.toContain("HEYGEN_API_KEY");
    expect(serialized).not.toContain("LIVEAVATAR_API_KEY");
    expect(serialized).not.toContain("avatar-test-id");
  });

  it("returns degraded status when required voice configuration is missing", async () => {
    const response = GET();
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      status: "degraded",
      checks: {
        openaiApiKeyConfigured: false,
        heygenApiKeyConfigured: false,
        liveAvatarApiKeyConfigured: false,
      },
      realtime: {
        model: "gpt-realtime-2",
      },
      avatar: {
        configured: true,
        providerConfigured: false,
        liveProviderConfigured: false,
      },
    });
    expect(serialized).not.toContain(".env");
    expect(serialized).not.toContain("sk-");
  });
});
