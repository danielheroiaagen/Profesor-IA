import "server-only";

import {
  completeLesson,
  createLessonSession,
  recordFeedback,
  recordLearnerTurn,
  type LessonSession,
} from "@/domain/lesson";

const lessons = new Map<string, LessonSession>();

export function createTrackedLesson({
  lessonId,
  now,
}: {
  lessonId: string;
  now?: Date;
}): LessonSession {
  const lesson = createLessonSession({ lessonId, now });
  lessons.set(lesson.id, lesson);

  return lesson;
}

export function getTrackedLesson(lessonId: string): LessonSession | null {
  return lessons.get(lessonId) ?? null;
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
  lessons.set(lessonId, completion.lesson);

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
  lessons.set(lessonId, updated);

  return updated;
}
