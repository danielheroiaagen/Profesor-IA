export type LessonState = "idle" | "starting" | "active" | "feedback" | "completed" | "failed";
export type CompletionReason = "completed" | "insufficient-participation" | "unverified";
export type LessonFailureReason =
  | "start-failed"
  | "interrupted"
  | "insufficient-participation"
  | "unverified-completion";

export type LessonMetrics = {
  learnerTurns: number;
  feedbackEvents: number;
};

export type LessonSession = {
  id: string;
  state: LessonState;
  startedAt: string;
  metrics: LessonMetrics;
  completedAt?: string;
  failedAt?: string;
  failureReason?: LessonFailureReason;
  completionReason?: CompletionReason;
};

export type CompletionEvidence = Partial<LessonMetrics> & {
  canVerify?: boolean;
  interrupted?: boolean;
};

export type CompletionQualification =
  | { qualified: true; reason: "completed"; retryable: false }
  | { qualified: false; reason: Exclude<CompletionReason, "completed">; retryable: boolean };

const MIN_LEARNER_TURNS = 1;
const MIN_FEEDBACK_EVENTS = 1;

export function createLessonSession({
  lessonId,
  now = new Date(),
}: {
  lessonId: string;
  now?: Date;
}): LessonSession {
  return {
    id: lessonId,
    state: "active",
    startedAt: now.toISOString(),
    metrics: { learnerTurns: 0, feedbackEvents: 0 },
  };
}

export function recordLearnerTurn(lesson: LessonSession): LessonSession {
  if (isTerminalState(lesson.state)) return lesson;

  return {
    ...lesson,
    state: "active",
    metrics: { ...lesson.metrics, learnerTurns: lesson.metrics.learnerTurns + 1 },
  };
}

export function recordFeedback(lesson: LessonSession): LessonSession {
  if (isTerminalState(lesson.state)) return lesson;

  return {
    ...lesson,
    state: "feedback",
    metrics: { ...lesson.metrics, feedbackEvents: lesson.metrics.feedbackEvents + 1 },
  };
}

export function qualifyLessonCompletion(evidence: CompletionEvidence): CompletionQualification {
  if (evidence.interrupted || evidence.canVerify === false) {
    return { qualified: false, reason: "unverified", retryable: true };
  }

  const metrics = normalizeMetrics(evidence);
  const meaningful =
    metrics.learnerTurns >= MIN_LEARNER_TURNS &&
    metrics.feedbackEvents >= MIN_FEEDBACK_EVENTS;

  return meaningful
    ? { qualified: true, reason: "completed", retryable: false }
    : { qualified: false, reason: "insufficient-participation", retryable: false };
}

export function completeLesson(
  lesson: LessonSession,
  evidence: CompletionEvidence = {},
  now = new Date(),
) {
  const metrics = normalizeMetrics({
    learnerTurns: evidence.learnerTurns ?? lesson.metrics.learnerTurns,
    feedbackEvents: evidence.feedbackEvents ?? lesson.metrics.feedbackEvents,
  });
  const qualification = qualifyLessonCompletion({ ...evidence, ...metrics });

  if (qualification.qualified) {
    return {
      lesson: {
        ...lesson,
        state: "completed" as const,
        metrics,
        completedAt: now.toISOString(),
        completionReason: "completed" as const,
      },
      qualification,
    };
  }

  return {
    lesson: {
      ...lesson,
      state: "failed" as const,
      metrics,
      failedAt: now.toISOString(),
      failureReason: toFailureReason(qualification.reason, evidence),
      completionReason: qualification.reason,
    },
    qualification,
  };
}

export function failLesson(
  lesson: LessonSession,
  failureReason: LessonFailureReason,
  now = new Date(),
): LessonSession {
  return { ...lesson, state: "failed", failedAt: now.toISOString(), failureReason };
}

export function toSafeLessonResponse(lesson: LessonSession): LessonSession {
  return { ...lesson };
}

function normalizeMetrics(evidence: Partial<LessonMetrics>): LessonMetrics {
  return {
    learnerTurns: normalizeCount(evidence.learnerTurns),
    feedbackEvents: normalizeCount(evidence.feedbackEvents),
  };
}

function normalizeCount(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function toFailureReason(
  reason: Exclude<CompletionReason, "completed">,
  evidence: CompletionEvidence,
): LessonFailureReason {
  if (evidence.interrupted) return "interrupted";
  return reason === "unverified" ? "unverified-completion" : "insufficient-participation";
}

function isTerminalState(state: LessonState): boolean {
  return state === "completed" || state === "failed";
}
