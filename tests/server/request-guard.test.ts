import { describe, expect, it } from "vitest";

import { enforceSameOriginRequest } from "@/server/request-guard";

describe("enforceSameOriginRequest", () => {
  it("allows same-origin requests even when local browser metadata is noisy", () => {
    const response = enforceSameOriginRequest(
      new Request("http://127.0.0.1:3000/api/lessons/start", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:3000",
          "sec-fetch-site": "cross-site",
        },
      }),
    );

    expect(response).toBeNull();
  });

  it("allows equivalent loopback origins used by local dev servers", () => {
    const response = enforceSameOriginRequest(
      new Request("http://localhost:3000/api/lessons/start", {
        method: "POST",
        headers: {
          origin: "http://127.0.0.1:3000",
          "sec-fetch-site": "cross-site",
        },
      }),
    );

    expect(response).toBeNull();
  });

  it("rejects cross-site requests before protected handlers run", async () => {
    const response = enforceSameOriginRequest(
      new Request("http://127.0.0.1:3000/api/lessons/start", {
        method: "POST",
        headers: {
          origin: "https://attacker.example",
          "sec-fetch-site": "cross-site",
        },
      }),
    );

    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: "cross-site-request-denied" },
    });
  });
});
