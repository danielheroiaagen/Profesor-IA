import { describe, expect, it } from "vitest";

import nextConfig from "@/../next.config";

describe("security headers", () => {
  it("allows the controlled LiveAvatar SDK without weakening secret boundaries", async () => {
    const headers = await nextConfig.headers?.();
    const rootHeaders = headers?.[0]?.headers ?? [];
    const contentSecurityPolicy = rootHeaders.find(
      (header) => header.key === "Content-Security-Policy",
    )?.value;
    const permissionsPolicy = rootHeaders.find(
      (header) => header.key === "Permissions-Policy",
    )?.value;

    expect(contentSecurityPolicy).toContain(
      "connect-src 'self' https://api.openai.com https://api.heygen.com https://api.liveavatar.com https://*.livekit.cloud wss://*.livekit.cloud",
    );
    expect(contentSecurityPolicy).toContain("frame-src 'self'");
    expect(contentSecurityPolicy).not.toContain("https://app.liveavatar.com");
    expect(contentSecurityPolicy).not.toContain("OPENAI_API_KEY");
    expect(contentSecurityPolicy).not.toContain("LIVEAVATAR_API_KEY");
    expect(permissionsPolicy).toBe(
      "camera=(), microphone=(self), geolocation=()",
    );
  });
});
