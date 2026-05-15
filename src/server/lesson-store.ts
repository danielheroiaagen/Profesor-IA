import "server-only";

import { randomUUID } from "node:crypto";

import {
  completeLesson,
  createLessonSession,
  recordFeedback,
  recordLearnerTurn,
  type LessonSession,
} from "@/domain/lesson";

const lessonStoreKey = "__profesorIaLessonStore";

type TrackedLessonRecord = {
  lesson: LessonSession;
  accessToken: string;
};

const lessons = getProcessLessonStore();

export function createTrackedLesson({
  lessonId,
  now,
}: {
  lessonId: string;
  now?: Date;
}): LessonSession {
  const lesson = createLessonSession({ lessonId, now });
  lessons.set(lesson.id, {
    lesson,
    accessToken: randomUUID(),
  });

  return lesson;
}

export function getTrackedLesson(lessonId: string): LessonSession | null {
  return lessons.get(lessonId)?.lesson ?? null;
}

export function getTrackedLessonAccessToken(lessonId: string): string | null {
  return lessons.get(lessonId)?.accessToken ?? null;
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
  const accessToken = getTrackedLessonAccessToken(lessonId) ?? randomUUID();
  lessons.set(lessonId, { lesson: completion.lesson, accessToken });

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
  const accessToken = getTrackedLessonAccessToken(lessonId) ?? randomUUID();
  lessons.set(lessonId, { lesson: updated, accessToken });

  return updated;
}

function getProcessLessonStore(): Map<string, TrackedLessonRecord> {
  const processGlobal = globalThis as typeof globalThis & {
    [lessonStoreKey]?: Map<string, TrackedLessonRecord>;
  };

  processGlobal[lessonStoreKey] ??= new Map<string, TrackedLessonRecord>();

  return processGlobal[lessonStoreKey];
}
