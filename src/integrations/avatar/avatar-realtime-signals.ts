import type { AvatarRuntimeEventInput } from "@/integrations/avatar/avatar-runtime";

export type AvatarRealtimeEvidence = "learner-turn" | "feedback";

export type AvatarRealtimeSignal = {
  avatarEvent?: AvatarRuntimeEventInput;
  evidence?: AvatarRealtimeEvidence;
  feedbackSummary?: string;
};

type RealtimePayload = {
  type?: string;
  text?: unknown;
  delta?: unknown;
  transcript?: unknown;
  response?: {
    output_text?: unknown;
  };
};

const LEARNER_SPEECH_STARTED_EVENT = "input_audio_buffer.speech_started";
const LEARNER_SPEECH_STOPPED_EVENT = "input_audio_buffer.speech_stopped";
const LEARNER_TRANSCRIPT_DONE_EVENT =
  "conversation.item.input_audio_transcription.completed";
const TUTOR_TEXT_DELTA_EVENTS = new Set([
  "response.output_audio_transcript.delta",
  "response.output_text.delta",
]);
const TUTOR_TEXT_DONE_EVENTS = new Set([
  "response.output_audio_transcript.done",
  "response.output_text.done",
]);

export function readAvatarRealtimeSignal(
  payload: string,
): AvatarRealtimeSignal | null {
  try {
    const event = JSON.parse(payload) as RealtimePayload;

    return readAvatarRealtimeSignalFromEvent(event);
  } catch {
    return null;
  }
}

function readAvatarRealtimeSignalFromEvent(
  event: RealtimePayload,
): AvatarRealtimeSignal | null {
  if (event.type === LEARNER_SPEECH_STARTED_EVENT) {
    return { avatarEvent: { type: "learner.speech_started" } };
  }

  if (event.type === LEARNER_SPEECH_STOPPED_EVENT) {
    return { avatarEvent: { type: "learner.speech_completed" } };
  }

  const text = readRealtimeText(event);

  if (event.type === LEARNER_TRANSCRIPT_DONE_EVENT && text) {
    return {
      avatarEvent: { type: "learner.speech_completed" },
      evidence: "learner-turn",
    };
  }

  if (event.type && TUTOR_TEXT_DELTA_EVENTS.has(event.type) && text) {
    return {
      avatarEvent: {
        type: "tutor.speech_delta",
        tutorText: text,
      },
    };
  }

  if (event.type && TUTOR_TEXT_DONE_EVENTS.has(event.type) && text) {
    return {
      avatarEvent: {
        type: "feedback.detected",
        tutorText: text,
        feedbackTone: readFeedbackTone(text),
      },
      evidence: "feedback",
      feedbackSummary: text,
    };
  }

  if (event.type === "response.done") {
    return { avatarEvent: { type: "tutor.speech_completed" } };
  }

  return null;
}

function readRealtimeText(event: RealtimePayload) {
  for (const candidate of [
    event.text,
    event.delta,
    event.transcript,
    event.response?.output_text,
  ]) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function readFeedbackTone(
  text: string,
): NonNullable<AvatarRuntimeEventInput["feedbackTone"]> {
  const normalized = text.toLocaleLowerCase();

  if (
    normalized.includes("correction") ||
    normalized.includes("corrección") ||
    normalized.includes("instead of") ||
    normalized.includes("en lugar de") ||
    normalized.includes("error")
  ) {
    return "correction";
  }

  if (
    normalized.includes("great") ||
    normalized.includes("excellent") ||
    normalized.includes("well done") ||
    normalized.includes("nice")
  ) {
    return "praise";
  }

  return "neutral";
}
