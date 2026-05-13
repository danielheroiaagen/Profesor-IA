import { describe, expect, it } from "vitest";

import { awardLessonXp, LESSON_COMPLETION_XP } from "@/domain/gamification";
import { completeLesson, createLessonSession, recordFeedback, recordLearnerTurn } from "@/domain/lesson";

describe("gamification domain", () => {
  it("denies unearned XP when the learner has not received feedback", () => {
    const lesson = recordLearnerTurn(createLessonSession({ lessonId: "lesson-3" }));
    const completion = completeLesson(lesson);

    expect(completion.qualification.reason).toBe("insufficient-participation");
    expect(awardLessonXp(completion.qualification)).toEqual({
      awarded: false,
      xp: 0,
      reason: "insufficient-participation",
    });
  });

  it("awards XP only after meaningful participation and feedback", () => {
    const lesson = recordFeedback(recordLearnerTurn(createLessonSession({ lessonId: "lesson-4" })));
    const completion = completeLesson(lesson);

    expect(awardLessonXp(completion.qualification)).toEqual({
      awarded: true,
      xp: LESSON_COMPLETION_XP,
      reason: "completed",
    });
  });

  it("denies XP when completion cannot be verified", () => {
    const lesson = recordFeedback(recordLearnerTurn(createLessonSession({ lessonId: "lesson-5" })));
    const completion = completeLesson(lesson, { canVerify: false });

    expect(awardLessonXp(completion.qualification)).toEqual({
      awarded: false,
      xp: 0,
      reason: "unverified",
    });
  });
});
