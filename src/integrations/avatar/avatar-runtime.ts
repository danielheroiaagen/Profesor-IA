import type {
  AvatarActionEnvelope,
  AvatarLessonEvent,
  AvatarLessonEventType,
} from "@/integrations/avatar/avatar-actions";
import { createAvatarActionEnvelope } from "@/integrations/avatar/avatar-actions";

const DEFAULT_MAX_HISTORY = 12;

export type AvatarRuntimeStatus =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "feedback"
  | "celebrating"
  | "fallback";

export type AvatarRuntimeState = {
  attemptId: string;
  lessonPlanSlug: string;
  status: AvatarRuntimeStatus;
  lastAction: AvatarActionEnvelope | null;
  actionHistory: AvatarActionEnvelope[];
};

export type AvatarRuntimeEventInput = {
  type: AvatarLessonEventType;
  occurredAt?: string;
  tutorText?: string;
  feedbackTone?: AvatarLessonEvent["feedbackTone"];
};

export type AvatarRuntimeOptions = {
  now?: () => string;
  maxHistory?: number;
};

export function createAvatarRuntimeState({
  attemptId,
  lessonPlanSlug,
}: {
  attemptId: string;
  lessonPlanSlug: string;
}): AvatarRuntimeState {
  return {
    attemptId: requireNonEmpty(attemptId, "attemptId"),
    lessonPlanSlug: requireNonEmpty(lessonPlanSlug, "lessonPlanSlug"),
    status: "idle",
    lastAction: null,
    actionHistory: [],
  };
}

export function reduceAvatarRuntimeEvent(
  state: AvatarRuntimeState,
  event: AvatarRuntimeEventInput,
  options: AvatarRuntimeOptions = {},
): AvatarRuntimeState {
  const avatarEvent = readTrustedAvatarEvent(state, event);
  const action = createAvatarActionEnvelope(avatarEvent, options.now);
  const maxHistory = Math.max(1, options.maxHistory ?? DEFAULT_MAX_HISTORY);
  const actionHistory = [...state.actionHistory, action].slice(-maxHistory);

  return {
    ...state,
    status: readStatusForEvent(event.type),
    lastAction: action,
    actionHistory,
  };
}

function readTrustedAvatarEvent(
  state: AvatarRuntimeState,
  event: AvatarRuntimeEventInput,
): AvatarLessonEvent {
  return {
    type: event.type,
    attemptId: state.attemptId,
    lessonPlanSlug: state.lessonPlanSlug,
    occurredAt: event.occurredAt,
    tutorText: event.tutorText,
    feedbackTone: event.feedbackTone,
  };
}

function readStatusForEvent(type: AvatarLessonEventType): AvatarRuntimeStatus {
  switch (type) {
    case "learner.speech_started":
      return "listening";
    case "learner.speech_completed":
      return "thinking";
    case "tutor.speech_started":
    case "tutor.speech_delta":
      return "speaking";
    case "feedback.detected":
      return "feedback";
    case "lesson.completed":
      return "celebrating";
    case "connection.degraded":
      return "fallback";
    case "lesson.ready":
    case "tutor.speech_completed":
      return "idle";
  }
}

function requireNonEmpty(value: string, field: string) {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${field} is required for avatar runtime state.`);
  }

  return normalized;
}
