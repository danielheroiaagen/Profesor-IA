import "server-only";

import { randomUUID } from "node:crypto";

import {
  completeLesson,
  createLessonSession,
  recordFeedback,
  recordLearnerTurn,
  type LessonSession,
} from "@/domain/lesson";
import {
  getDefaultRaioSpeakingLesson,
  type RaioSpeakingLesson,
} from "@/domain/raio-curriculum";

const lessonStoreKey = "__profesorIaLessonStore";

type TrackedLessonRecord = {
  lesson: LessonSession;
  accessToken: string;
  lessonPlan: RaioSpeakingLesson;
};

const lessons = getProcessLessonStore();

export function createTrackedLesson({
  lessonId,
  lessonPlan = getDefaultRaioSpeakingLesson(),
  now,
}: {
  lessonId: string;
  lessonPlan?: RaioSpeakingLesson;
  now?: Date;
}): LessonSession {
  const lesson = createLessonSession({ lessonId, now });
  lessons.set(lesson.id, {
    lesson,
    accessToken: randomUUID(),
    lessonPlan,
  });

  return lesson;
}

export function getTrackedLesson(lessonId: string): LessonSession | null {
  return lessons.get(lessonId)?.lesson ?? null;
}

export function getTrackedLessonAccessToken(lessonId: string): string | null {
  return lessons.get(lessonId)?.accessToken ?? null;
}

export function getTrackedLessonPlan(
  lessonId: string,
): RaioSpeakingLesson | null {
  return lessons.get(lessonId)?.lessonPlan ?? null;
}

export function canAccessTrackedLesson({
  lessonId,
  accessToken,
}: {
  lessonId: string;
  accessToken: string;
}): boolean {
  const tracked = lessons.get(lessonId);

  return Boolean(tracked && tracked.accessToken === accessToken);
}

export function recordTrustedLearnerTurn(
  lessonId: string,
): LessonSession | null {
  return updateTrackedLesson(lessonId, recordLearnerTurn);
}

export function recordTrustedFeedback(lessonId: string): LessonSession | null {
  return updateTrackedLesson(lessonId, recordFeedback);
}

export function completeTrackedLesson(lessonId: string, now = new Date()) {
  const lesson = getTrackedLesson(lessonId);

  if (!lesson) {
    return null;
  }

  const completion = completeLesson(lesson, { canVerify: true }, now);
  const tracked = lessons.get(lessonId);
  const accessToken = tracked?.accessToken ?? randomUUID();
  const lessonPlan = tracked?.lessonPlan ?? getDefaultRaioSpeakingLesson();
  lessons.set(lessonId, {
    lesson: completion.lesson,
    accessToken,
    lessonPlan,
  });

  return completion;
}

export function resetTrackedLessonsForTests() {
  lessons.clear();
}

function updateTrackedLesson(
  lessonId: string,
  update: (lesson: LessonSession) => LessonSession,
): LessonSession | null {
  const lesson = getTrackedLesson(lessonId);

  if (!lesson) {
    return null;
  }

  const updated = update(lesson);
  const tracked = lessons.get(lessonId);
  const accessToken = tracked?.accessToken ?? randomUUID();
  const lessonPlan = tracked?.lessonPlan ?? getDefaultRaioSpeakingLesson();
  lessons.set(lessonId, { lesson: updated, accessToken, lessonPlan });

  return updated;
}

function getProcessLessonStore(): Map<string, TrackedLessonRecord> {
  const processGlobal = globalThis as typeof globalThis & {
    [lessonStoreKey]?: Map<string, TrackedLessonRecord>;
  };

  processGlobal[lessonStoreKey] ??= new Map<string, TrackedLessonRecord>();

  return processGlobal[lessonStoreKey];
}
