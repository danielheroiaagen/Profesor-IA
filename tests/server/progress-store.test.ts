import { afterEach, describe, expect, it } from "vitest";

import {
  getOrCreateAnonymousProgressId,
  PROGRESS_COOKIE_NAME,
  readAnonymousProgress,
  recordLessonProgress,
  resetAnonymousProgressForTests,
} from "@/server/progress-store";

describe("anonymous progress store", () => {
  afterEach(resetAnonymousProgressForTests);

  it("creates and reuses an opaque anonymous progress id", () => {
    const id = getOrCreateAnonymousProgressId(
      new Request("http://localhost/api/progress"),
    );
    const reused = getOrCreateAnonymousProgressId(
      new Request("http://localhost/api/progress", {
        headers: { cookie: `${PROGRESS_COOKIE_NAME}=${id}` },
      }),
    );

    expect(id).toEqual(expect.any(String));
    expect(reused).toBe(id);
    expect(readAnonymousProgress(id)).toEqual({
      totalXp: 0,
      completedLessons: 0,
      lastAwardedAt: null,
    });
  });

  it("records awarded XP once per lesson and ignores non-awards", () => {
    const progressId = getOrCreateAnonymousProgressId(
      new Request("http://localhost/api/progress"),
    );
    const first = recordLessonProgress({
      progressId,
      lessonId: "lesson-progress",
      xp: { awarded: true, xp: 50, reason: "completed" },
      now: new Date("2026-05-13T00:00:00.000Z"),
    });
    const duplicate = recordLessonProgress({
      progressId,
      lessonId: "lesson-progress",
      xp: { awarded: true, xp: 50, reason: "completed" },
    });
    const ignored = recordLessonProgress({
      progressId,
      lessonId: "lesson-no-award",
      xp: { awarded: false, xp: 0, reason: "insufficient-participation" },
    });

    expect(first).toEqual({
      totalXp: 50,
      completedLessons: 1,
      lastAwardedAt: "2026-05-13T00:00:00.000Z",
    });
    expect(duplicate).toEqual(first);
    expect(ignored).toEqual(first);
  });
});
