import { describe, expect, it } from "vitest";

import {
  createAvatarRuntimeState,
  reduceAvatarRuntimeEvent,
} from "@/integrations/avatar/avatar-runtime";

const BASE_STATE = {
  attemptId: "attempt-1",
  lessonPlanSlug: "raio-a1-linking",
};

describe("avatar runtime dispatcher", () => {
  it("creates trusted idle runtime state", () => {
    expect(createAvatarRuntimeState(BASE_STATE)).toEqual({
      attemptId: "attempt-1",
      lessonPlanSlug: "raio-a1-linking",
      status: "idle",
      lastAction: null,
      actionHistory: [],
    });
  });

  it("dispatches learner speech events into listening and thinking states", () => {
    const listening = reduceAvatarRuntimeEvent(
      createAvatarRuntimeState(BASE_STATE),
      {
        type: "learner.speech_started",
        occurredAt: "2026-05-23T00:00:00Z",
      },
    );
    const thinking = reduceAvatarRuntimeEvent(listening, {
      type: "learner.speech_completed",
      occurredAt: "2026-05-23T00:00:01Z",
    });

    expect(listening.status).toBe("listening");
    expect(listening.lastAction?.action.kind).toBe("listen");
    expect(thinking.status).toBe("thinking");
    expect(thinking.lastAction?.action.kind).toBe("think");
    expect(thinking.actionHistory).toHaveLength(2);
  });

  it("dispatches tutor text into a speaking action", () => {
    const state = reduceAvatarRuntimeEvent(
      createAvatarRuntimeState(BASE_STATE),
      {
        type: "tutor.speech_delta",
        tutorText: "Nice pronunciation.",
        occurredAt: "2026-05-23T00:00:02Z",
      },
    );

    expect(state.status).toBe("speaking");
    expect(state.lastAction).toMatchObject({
      type: "avatar.action",
      attemptId: "attempt-1",
      lessonPlanSlug: "raio-a1-linking",
      action: {
        kind: "speak",
        text: "Nice pronunciation.",
      },
    });
  });

  it(
    "keeps runtime identity trusted even if event input contains spoofed fields",
    () => {
      const unsafeEvent = {
        type: "tutor.speech_delta" as const,
        attemptId: "spoofed-attempt",
        lessonPlanSlug: "spoofed-lesson",
        rawAudio: "raw-audio-secret",
        tutorText: "Approved tutor text.",
        occurredAt: "2026-05-23T00:00:03Z",
      };

      const state = reduceAvatarRuntimeEvent(
        createAvatarRuntimeState(BASE_STATE),
        unsafeEvent,
      );
      const serialized = JSON.stringify(state.lastAction);

      expect(state.lastAction?.attemptId).toBe("attempt-1");
      expect(state.lastAction?.lessonPlanSlug).toBe("raio-a1-linking");
      expect(serialized).not.toContain("spoofed-attempt");
      expect(serialized).not.toContain("spoofed-lesson");
      expect(serialized).not.toContain("raw-audio-secret");
    },
  );

  it("preserves fallback status for degraded connections", () => {
    const state = reduceAvatarRuntimeEvent(
      createAvatarRuntimeState(BASE_STATE),
      {
        type: "connection.degraded",
        occurredAt: "2026-05-23T00:00:04Z",
      },
    );

    expect(state.status).toBe("fallback");
    expect(state.lastAction?.action).toEqual({
      kind: "fallback",
      intensity: "high",
      durationMs: 500,
      emotion: "calm",
    });
  });

  it("limits action history for browser runtime state", () => {
    let state = createAvatarRuntimeState(BASE_STATE);

    for (let index = 0; index < 5; index += 1) {
      state = reduceAvatarRuntimeEvent(
        state,
        {
          type: "lesson.ready",
          occurredAt: `2026-05-23T00:00:0${index}Z`,
        },
        { maxHistory: 3 },
      );
    }

    expect(state.actionHistory).toHaveLength(3);
    expect(state.actionHistory[0]?.occurredAt).toBe("2026-05-23T00:00:02Z");
  });
});
