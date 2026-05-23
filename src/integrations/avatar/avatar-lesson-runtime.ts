import type { AvatarRealtimeSignal } from "@/integrations/avatar/avatar-realtime-signals";
import { readAvatarRealtimeSignal } from "@/integrations/avatar/avatar-realtime-signals";
import type {
  AvatarRuntimeEventInput,
  AvatarRuntimeOptions,
  AvatarRuntimeState,
} from "@/integrations/avatar/avatar-runtime";
import {
  createAvatarRuntimeState,
  reduceAvatarRuntimeEvent,
} from "@/integrations/avatar/avatar-runtime";

export const DEFAULT_AVATAR_LESSON_PLAN_SLUG = "raio-a1-linking";

export type LessonAvatarRuntimeStart = {
  attemptId: string;
  lessonPlanSlug?: string;
};

export type LessonAvatarRealtimeResult = {
  state: AvatarRuntimeState;
  signal: AvatarRealtimeSignal | null;
};

export function startLessonAvatarRuntime(
  input: LessonAvatarRuntimeStart,
  options: AvatarRuntimeOptions = {},
): AvatarRuntimeState {
  const state = createAvatarRuntimeState({
    attemptId: input.attemptId,
    lessonPlanSlug: input.lessonPlanSlug ?? DEFAULT_AVATAR_LESSON_PLAN_SLUG,
  });

  return reduceAvatarRuntimeEvent(state, { type: "lesson.ready" }, options);
}

export function reduceLessonAvatarRealtimePayload(
  state: AvatarRuntimeState,
  payload: string,
  options: AvatarRuntimeOptions = {},
): LessonAvatarRealtimeResult {
  const signal = readAvatarRealtimeSignal(payload);

  if (!signal?.avatarEvent) {
    return { state, signal };
  }

  return {
    state: reduceAvatarRuntimeEvent(state, signal.avatarEvent, options),
    signal,
  };
}

export function reduceLessonAvatarManualEvent(
  state: AvatarRuntimeState,
  event: AvatarRuntimeEventInput,
  options: AvatarRuntimeOptions = {},
): AvatarRuntimeState {
  return reduceAvatarRuntimeEvent(state, event, options);
}

export function reduceLessonAvatarConnectionDegraded(
  state: AvatarRuntimeState,
  options: AvatarRuntimeOptions = {},
): AvatarRuntimeState {
  return reduceLessonAvatarManualEvent(
    state,
    { type: "connection.degraded" },
    options,
  );
}
