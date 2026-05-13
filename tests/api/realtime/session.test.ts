import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/../app/api/realtime/session/route";

const PRIMARY_API_KEY = "sk-test-primary-key-never-returned";

describe("POST /api/realtime/session", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns only an ephemeral realtime credential", async () => {
    vi.stubEnv("OPENAI_API_KEY", PRIMARY_API_KEY);
    vi.stubEnv("OPENAI_REALTIME_MODEL", "gpt-realtime-2");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          expires_at: 1_800_000_000,
          session: {
            client_secret: {
              value: "ek_test_ephemeral",
              expires_at: 1_800_000_000,
            },
          },
        }),
      ),
    );

    const response = await POST(
      new Request("http://localhost/api/realtime/session", {
        method: "POST",
        body: JSON.stringify({ lessonId: "lesson-route" }),
      }),
    );
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(201);
    expect(body.realtime).toMatchObject({
      clientSecret: "ek_test_ephemeral",
      model: "gpt-realtime-2",
      lessonId: "lesson-route",
    });
    expect(serialized).not.toContain(PRIMARY_API_KEY);
    expect(serialized).not.toContain("OPENAI_API_KEY");
  });

  it("fails safely without leaking server secrets", async () => {
    vi.stubEnv("OPENAI_API_KEY", PRIMARY_API_KEY);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "upstream" }, { status: 500 })),
    );

    const response = await POST(
      new Request("http://localhost/api/realtime/session", {
        method: "POST",
        body: JSON.stringify({ lessonId: "lesson-route" }),
      }),
    );
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(502);
    expect(body.error).toEqual({
      code: "realtime-session-unavailable",
      message: "Voice session could not start. Please retry.",
    });
    expect(serialized).not.toContain(PRIMARY_API_KEY);
    expect(serialized).not.toContain("OPENAI_API_KEY");
  });

  it("fails safely when server OpenAI configuration is missing", async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);

    const response = await POST(
      new Request("http://localhost/api/realtime/session", {
        method: "POST",
        body: JSON.stringify({ lessonId: "lesson-route" }),
      }),
    );
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(502);
    expect(body.error).toEqual({
      code: "realtime-session-failed",
      message: "Voice session could not start. Please retry.",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(serialized).not.toContain("OPENAI_API_KEY");
    expect(serialized).not.toContain(".env");
  });
});
