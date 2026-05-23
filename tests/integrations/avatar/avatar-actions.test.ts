import { describe, expect, it } from "vitest";

import { createAvatarActionEnvelope } from "@/integrations/avatar/avatar-actions";

const BASE_EVENT = {
  attemptId: "attempt-1",
  lessonPlanSlug: "raio-a1-linking",
  occurredAt: "2026-05-23T00:00:00Z",
} as const;

describe("avatar action reducer", () => {
  it("maps lesson readiness to a welcoming gesture", () => {
    expect(
      createAvatarActionEnvelope({
        ...BASE_EVENT,
        type: "lesson.ready",
      }),
    ).toEqual({
      type: "avatar.action",
      attemptId: "attempt-1",
      lessonPlanSlug: "raio-a1-linking",
      occurredAt: "2026-05-23T00:00:00Z",
      action: {
        kind: "gesture",
        intensity: "low",
        durationMs: 1200,
        emotion: "welcoming",
        text: "Ready to practice.",
      },
    });
  });

  it("maps learner speech to a listening state", () => {
    const action = createAvatarActionEnvelope({
      ...BASE_EVENT,
      type: "learner.speech_started",
    }).action;

    expect(action).toMatchObject({
      kind: "listen",
      intensity: "low",
      emotion: "attentive",
    });
  });

  it("uses tutor-approved text for speech deltas", () => {
    const action = createAvatarActionEnvelope({
      ...BASE_EVENT,
      type: "tutor.speech_delta",
      tutorText: "Great linking.",
    }).action;

    expect(action).toEqual({
      kind: "speak",
      intensity: "low",
      durationMs: 300,
      emotion: "supportive",
      text: "Great linking.",
    });
  });

  it("does not copy raw learner audio into avatar actions", () => {
    const eventWithRawAudio = {
      ...BASE_EVENT,
      type: "tutor.speech_delta" as const,
      tutorText: "Approved tutor text.",
      rawAudio: "raw-audio-secret",
    };

    const envelope = createAvatarActionEnvelope(eventWithRawAudio);

    expect(JSON.stringify(envelope)).not.toContain("raw-audio-secret");
    expect(envelope.action.text).toBe("Approved tutor text.");
  });

  it("maps degraded connections to a non-blocking fallback", () => {
    const action = createAvatarActionEnvelope({
      ...BASE_EVENT,
      type: "connection.degraded",
    }).action;

    expect(action).toEqual({
      kind: "fallback",
      intensity: "high",
      durationMs: 500,
      emotion: "calm",
    });
  });
});
