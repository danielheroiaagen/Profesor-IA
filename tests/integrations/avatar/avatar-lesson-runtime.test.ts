import { describe, expect, it } from "vitest";

import {
  DEFAULT_AVATAR_LESSON_PLAN_SLUG,
  reduceLessonAvatarConnectionDegraded,
  reduceLessonAvatarManualEvent,
  reduceLessonAvatarRealtimePayload,
  startLessonAvatarRuntime,
} from "@/integrations/avatar/avatar-lesson-runtime";

const ATTEMPT_ID = "attempt-1";
const NOW = () => "2026-05-23T00:00:00Z";

describe("lesson avatar runtime controller", () => {
  it("starts trusted lesson runtime with a ready action", () => {
    const state = startLessonAvatarRuntime(
      { attemptId: ATTEMPT_ID },
      { now: NOW },
    );

    expect(state).toMatchObject({
      attemptId: ATTEMPT_ID,
      lessonPlanSlug: DEFAULT_AVATAR_LESSON_PLAN_SLUG,
      status: "idle",
      lastAction: {
        type: "avatar.action",
        attemptId: ATTEMPT_ID,
        lessonPlanSlug: DEFAULT_AVATAR_LESSON_PLAN_SLUG,
        occurredAt: "2026-05-23T00:00:00Z",
        action: {
          kind: "gesture",
          emotion: "welcoming",
        },
      },
    });
    expect(state.actionHistory).toHaveLength(1);
  });

  it("reduces learner speech payloads into listening runtime state", () => {
    const initialState = startLessonAvatarRuntime({ attemptId: ATTEMPT_ID });
    const result = reduceLessonAvatarRealtimePayload(
      initialState,
      JSON.stringify({ type: "input_audio_buffer.speech_started" }),
    );

    expect(result.signal).toEqual({
      avatarEvent: { type: "learner.speech_started" },
    });
    expect(result.state.status).toBe("listening");
    expect(result.state.lastAction?.action.kind).toBe("listen");
  });

  it("returns evidence while reducing tutor feedback into runtime state", () => {
    const initialState = startLessonAvatarRuntime({
      attemptId: ATTEMPT_ID,
      lessonPlanSlug: "custom-lesson",
    });
    const result = reduceLessonAvatarRealtimePayload(
      initialState,
      JSON.stringify({
        type: "response.output_text.done",
        text: "Correction: say it with a clearer final sound.",
      }),
    );

    expect(result.signal).toMatchObject({
      evidence: "feedback",
      feedbackSummary: "Correction: say it with a clearer final sound.",
    });
    expect(result.state).toMatchObject({
      lessonPlanSlug: "custom-lesson",
      status: "feedback",
      lastAction: {
        lessonPlanSlug: "custom-lesson",
        action: {
          kind: "expression",
          emotion: "supportive",
        },
      },
    });
  });

  it("does not mutate state for malformed payloads", () => {
    const initialState = startLessonAvatarRuntime({ attemptId: ATTEMPT_ID });
    const result = reduceLessonAvatarRealtimePayload(initialState, "not-json");

    expect(result.signal).toBeNull();
    expect(result.state).toBe(initialState);
  });

  it("keeps raw learner audio out of reduced avatar actions", () => {
    const initialState = startLessonAvatarRuntime({ attemptId: ATTEMPT_ID });
    const result = reduceLessonAvatarRealtimePayload(
      initialState,
      JSON.stringify({
        type: "response.output_audio_transcript.delta",
        delta: "Nice pronunciation.",
        rawAudio: "raw-audio-secret",
      }),
    );

    expect(result.state.status).toBe("speaking");
    expect(JSON.stringify(result.state.lastAction)).not.toContain(
      "raw-audio-secret",
    );
  });

  it("reduces manual completion and degraded connection events", () => {
    const initialState = startLessonAvatarRuntime({ attemptId: ATTEMPT_ID });
    const completed = reduceLessonAvatarManualEvent(initialState, {
      type: "lesson.completed",
    });
    const fallback = reduceLessonAvatarConnectionDegraded(completed);

    expect(completed.status).toBe("celebrating");
    expect(completed.lastAction?.action.kind).toBe("celebrate");
    expect(fallback.status).toBe("fallback");
    expect(fallback.lastAction?.action.kind).toBe("fallback");
  });
});
