import { describe, expect, it, vi } from "vitest";

import {
  mintRealtimeSession,
  RealtimeSessionError,
} from "@/integrations/openai/realtime";

describe("OpenAI realtime integration", () => {
  it("mints an ephemeral client secret without exposing the primary API key", async () => {
    const primaryApiKey = "sk-test-primary-key-never-returned";
    const fetchImpl = vi.fn(
      async (_url: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body));

        expect(init?.headers).toMatchObject({
          Authorization: `Bearer ${primaryApiKey}`,
          "Content-Type": "application/json",
        });
        expect(body.session).toMatchObject({
          type: "realtime",
          model: "gpt-realtime-2",
          audio: {
            input: {
              transcription: {
                model: "gpt-4o-mini-transcribe",
                language: "en",
              },
            },
            output: {
              voice: "marin",
            },
          },
        });

        return Response.json({
          expires_at: 1_800_000_000,
          session: {
            type: "realtime",
            model: "gpt-realtime-2",
            client_secret: {
              value: "ek_test_ephemeral",
              expires_at: 1_800_000_000,
            },
          },
        });
      },
    ) as typeof fetch;

    const session = await mintRealtimeSession({
      apiKey: primaryApiKey,
      model: "gpt-realtime-2",
      lessonId: "lesson-1",
      fetchImpl,
    });

    expect(session).toEqual({
      clientSecret: "ek_test_ephemeral",
      model: "gpt-realtime-2",
      expiresAt: "2027-01-15T08:00:00.000Z",
      lessonId: "lesson-1",
      connectUrl: "https://api.openai.com/v1/realtime/calls",
    });
    expect(JSON.stringify(session)).not.toContain(primaryApiKey);
  });

  it("throws a safe error when OpenAI rejects client secret creation", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ error: { message: "bad key" } }, { status: 401 }),
    ) as typeof fetch;

    await expect(
      mintRealtimeSession({
        apiKey: "sk-test-primary-key-never-returned",
        model: "gpt-realtime-2",
        lessonId: "lesson-2",
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(RealtimeSessionError);
  });
});
