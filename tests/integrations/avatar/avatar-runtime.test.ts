import { describe, expect, it } from "vitest";

import {
  createAvatarRuntimeState,
  reduceAvatarRuntimeEvent,
} from "@/integrations/avatar/avatar-runtime";
import type { AvatarRuntimeEventInput } from "@/integrations/avatar/avatar-runtime";

const BASE_STATE = {
  attemptId: "attempt-1",
  lessonPlanSlug: "raio-a1-linking",
};
const OCCURRED_AT = "2026-05-23T00:00:00Z";

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

  it("dispatches learner speech states", () => {
    const initialState = createAvatarRuntimeState(BASE_STATE);
    const listening = reduceAvatarRuntimeEvent(
      initialState,
      event("learner.speech_started"),
    );
    const thinking = reduceAvatarRuntimeEvent(
      listening,
      event("learner.speech_completed"),
    );

    expect(listening.status).toBe("listening");
    expect(listening.lastAction?.action.kind).toBe("listen");
    expect(thinking.status).toBe("thinking");
    expect(thinking.lastAction?.action.kind).toBe("think");
    expect(thinking.actionHistory).toHaveLength(2);
  });

  it("dispatches tutor text into speaking", () => {
    const state = reduceAvatarRuntimeEvent(
      createAvatarRuntimeState(BASE_STATE),
      event("tutor.speech_delta", { tutorText: "Nice pronunciation." }),
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

  it("keeps trusted identity against spoofed fields", () => {
    const unsafeEvent = {
      ...event("tutor.speech_delta", { tutorText: "Approved tutor text." }),
      attemptId: "spoofed-attempt",
      lessonPlanSlug: "spoofed-lesson",
      rawAudio: "raw-audio-secret",
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
  });

  it("preserves fallback for degraded connections", () => {
    const state = reduceAvatarRuntimeEvent(
      createAvatarRuntimeState(BASE_STATE),
      event("connection.degraded"),
    );

    expect(state.status).toBe("fallback");
    expect(state.lastAction?.action).toEqual({
      kind: "fallback",
      intensity: "high",
      durationMs: 500,
      emotion: "calm",
    });
  });

  it("limits action history", () => {
    let state = createAvatarRuntimeState(BASE_STATE);

    for (let index = 0; index < 5; index += 1) {
      state = reduceAvatarRuntimeEvent(
        state,
        event("lesson.ready", {
          occurredAt: `2026-05-23T00:00:0${index}Z`,
        }),
        { maxHistory: 3 },
      );
    }

    expect(state.actionHistory).toHaveLength(3);
    expect(state.actionHistory[0]?.occurredAt).toBe("2026-05-23T00:00:02Z");
  });
});

function event(
  type: AvatarRuntimeEventInput["type"],
  overrides: Partial<AvatarRuntimeEventInput> = {},
): AvatarRuntimeEventInput {
  return {
    type,
    occurredAt: OCCURRED_AT,
    ...overrides,
  };
}
