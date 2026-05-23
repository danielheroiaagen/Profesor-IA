import { describe, expect, it } from "vitest";

import { readAvatarRealtimeSignal } from "@/integrations/avatar/avatar-realtime-signals";
import {
  createAvatarRuntimeState,
  reduceAvatarRuntimeEvent,
} from "@/integrations/avatar/avatar-runtime";

const RUNTIME_BASE = {
  attemptId: "attempt-1",
  lessonPlanSlug: "raio-a1-linking",
};

describe("avatar realtime signal adapter", () => {
  it("maps learner speech start and stop events", () => {
    expect(
      readAvatarRealtimeSignal(
        JSON.stringify({ type: "input_audio_buffer.speech_started" }),
      ),
    ).toEqual({ avatarEvent: { type: "learner.speech_started" } });
    expect(
      readAvatarRealtimeSignal(
        JSON.stringify({ type: "input_audio_buffer.speech_stopped" }),
      ),
    ).toEqual({ avatarEvent: { type: "learner.speech_completed" } });
  });

  it("records learner transcript evidence without copying learner text", () => {
    const signal = readAvatarRealtimeSignal(
      JSON.stringify({
        type: "conversation.item.input_audio_transcription.completed",
        transcript: "I am practicing English today.",
      }),
    );

    expect(signal).toEqual({
      avatarEvent: { type: "learner.speech_completed" },
      evidence: "learner-turn",
    });
    expect(JSON.stringify(signal)).not.toContain("I am practicing");
  });

  it("maps tutor text deltas into speaking runtime events", () => {
    const signal = readAvatarRealtimeSignal(
      JSON.stringify({
        type: "response.output_audio_transcript.delta",
        delta: "Nice pronunciation.",
        rawAudio: "raw-audio-secret",
      }),
    );

    expect(signal).toEqual({
      avatarEvent: {
        type: "tutor.speech_delta",
        tutorText: "Nice pronunciation.",
      },
    });

    const state = reduceAvatarRuntimeEvent(
      createAvatarRuntimeState(RUNTIME_BASE),
      signal?.avatarEvent ?? { type: "connection.degraded" },
    );
    const serializedAction = JSON.stringify(state.lastAction);

    expect(state.status).toBe("speaking");
    expect(state.lastAction?.action.text).toBe("Nice pronunciation.");
    expect(serializedAction).not.toContain("raw-audio-secret");
  });

  it("maps tutor feedback into evidence and feedback runtime events", () => {
    expect(
      readAvatarRealtimeSignal(
        JSON.stringify({
          type: "response.output_text.done",
          response: {
            output_text:
              "Correction: say 'I am practicing English today' instead of 'I practicing English today'.",
          },
        }),
      ),
    ).toEqual({
      avatarEvent: {
        type: "feedback.detected",
        tutorText:
          "Correction: say 'I am practicing English today' instead of 'I practicing English today'.",
        feedbackTone: "correction",
      },
      evidence: "feedback",
      feedbackSummary:
        "Correction: say 'I am practicing English today' instead of 'I practicing English today'.",
    });
  });

  it("ignores malformed and raw-audio-only payloads safely", () => {
    expect(readAvatarRealtimeSignal("not-json")).toBeNull();
    expect(
      readAvatarRealtimeSignal(
        JSON.stringify({
          type: "response.audio.delta",
          delta: "base64-audio-payload",
        }),
      ),
    ).toBeNull();
  });
});
