import { describe, expect, it } from "vitest";

import {
  getSafeConfigStatus,
  getServerConfig,
  SafeConfigError,
} from "@/config/server";

describe("server config", () => {
  it("fails safely with variable names only when required secrets are missing", () => {
    expect(() => getServerConfig({})).toThrow(SafeConfigError);

    try {
      getServerConfig({});
    } catch (error) {
      const message = (error as Error).message;

      expect(message).toContain("OPENAI_API_KEY");
      expect(message).not.toContain("HEYGEN_API_KEY");
      expect(message).not.toContain("LIVEAVATAR_API_KEY");
      expect(message).not.toContain("sk-");
      expect(message).not.toContain(".env=");
    }
  });

  it("uses safe defaults for model and avatar while keeping secrets server-side", () => {
    const config = getServerConfig({ OPENAI_API_KEY: "sk-test-secret" });

    expect(config.openai.realtimeModel).toBe("gpt-realtime-2");
    expect(config.heygen.avatarId).toBe("e29e792a-41e7-4df0-84a8-349e099fb50f");
    expect(config.liveAvatar.avatarId).toBe(
      "e29e792a-41e7-4df0-84a8-349e099fb50f",
    );
    expect(config.openai.apiKey).toBe("sk-test-secret");
  });

  it("reports safe configuration status without exposing secret values", () => {
    const status = getSafeConfigStatus({
      OPENAI_API_KEY: "sk-test-secret",
      HEYGEN_API_KEY: "heygen-secret",
      LIVEAVATAR_API_KEY: "liveavatar-secret",
    });

    expect(status).toEqual({
      openaiApiKeyConfigured: true,
      heygenApiKeyConfigured: true,
      liveAvatarApiKeyConfigured: true,
      openaiRealtimeModel: "gpt-realtime-2",
      heygenAvatarId: "e29e792a-41e7-4df0-84a8-349e099fb50f",
    });
    expect(JSON.stringify(status)).not.toContain("sk-test-secret");
    expect(JSON.stringify(status)).not.toContain("heygen-secret");
    expect(JSON.stringify(status)).not.toContain("liveavatar-secret");
  });
});
