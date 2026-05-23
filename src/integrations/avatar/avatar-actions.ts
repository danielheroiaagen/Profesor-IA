export const AVATAR_LESSON_EVENT_TYPES = [
  "lesson.ready",
  "learner.speech_started",
  "learner.speech_completed",
  "tutor.speech_started",
  "tutor.speech_delta",
  "tutor.speech_completed",
  "feedback.detected",
  "lesson.completed",
  "connection.degraded",
] as const;

export type AvatarLessonEventType = (typeof AVATAR_LESSON_EVENT_TYPES)[number];

export type AvatarActionKind =
  | "idle"
  | "listen"
  | "think"
  | "speak"
  | "gesture"
  | "expression"
  | "celebrate"
  | "fallback";

export type AvatarActionIntensity = "low" | "medium" | "high";

export type AvatarFeedbackTone = "correction" | "praise" | "neutral";

export type AvatarLessonEvent = {
  type: AvatarLessonEventType;
  attemptId: string;
  lessonPlanSlug: string;
  occurredAt?: string;
  tutorText?: string;
  feedbackTone?: AvatarFeedbackTone;
};

export type AvatarAction = {
  kind: AvatarActionKind;
  intensity: AvatarActionIntensity;
  durationMs: number;
  emotion: string;
  text?: string;
};

export type AvatarActionEnvelope = {
  type: "avatar.action";
  attemptId: string;
  lessonPlanSlug: string;
  occurredAt: string;
  action: AvatarAction;
};

export function createAvatarActionEnvelope(
  event: AvatarLessonEvent,
  now: () => string = () => new Date().toISOString(),
): AvatarActionEnvelope {
  return {
    type: "avatar.action",
    attemptId: event.attemptId,
    lessonPlanSlug: event.lessonPlanSlug,
    occurredAt: event.occurredAt?.trim() || now(),
    action: createAvatarAction(event),
  };
}

function createAvatarAction(event: AvatarLessonEvent): AvatarAction {
  switch (event.type) {
    case "lesson.ready":
      return {
        kind: "gesture",
        intensity: "low",
        durationMs: 1200,
        emotion: "welcoming",
        text: "Ready to practice.",
      };
    case "learner.speech_started":
      return {
        kind: "listen",
        intensity: "low",
        durationMs: 0,
        emotion: "attentive",
      };
    case "learner.speech_completed":
      return {
        kind: "think",
        intensity: "low",
        durationMs: 900,
        emotion: "focused",
      };
    case "tutor.speech_started":
      return withOptionalText(
        {
          kind: "speak",
          intensity: "medium",
          durationMs: 1200,
          emotion: "supportive",
        },
        event.tutorText,
      );
    case "tutor.speech_delta":
      return withOptionalText(
        {
          kind: "speak",
          intensity: "low",
          durationMs: 300,
          emotion: "supportive",
        },
        event.tutorText,
      );
    case "tutor.speech_completed":
      return {
        kind: "idle",
        intensity: "low",
        durationMs: 600,
        emotion: "neutral",
      };
    case "feedback.detected":
      return createFeedbackAction(event.feedbackTone);
    case "lesson.completed":
      return {
        kind: "celebrate",
        intensity: "high",
        durationMs: 2000,
        emotion: "proud",
        text: "Lesson completed.",
      };
    case "connection.degraded":
      return {
        kind: "fallback",
        intensity: "high",
        durationMs: 500,
        emotion: "calm",
      };
  }
}

function createFeedbackAction(tone: AvatarFeedbackTone = "neutral"): AvatarAction {
  if (tone === "praise") {
    return {
      kind: "celebrate",
      intensity: "medium",
      durationMs: 1500,
      emotion: "encouraging",
    };
  }

  return {
    kind: "expression",
    intensity: "medium",
    durationMs: 1200,
    emotion: tone === "correction" ? "supportive" : "encouraging",
  };
}

function withOptionalText(action: AvatarAction, text: string | undefined) {
  const normalizedText = text?.trim();

  return normalizedText
    ? {
        ...action,
        text: normalizedText,
      }
    : action;
}
