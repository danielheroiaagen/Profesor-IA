import { describe, expect, it } from "vitest";

import {
  completeLesson,
  createLessonSession,
  recordFeedback,
  recordLearnerTurn,
} from "@/domain/lesson";

describe("lesson domain", () => {
  it("transitions from active practice to verified completion", () => {
    const started = createLessonSession({
      lessonId: "lesson-1",
      now: new Date("2026-05-12T10:00:00.000Z"),
    });

    expect(started.state).toBe("active");

    const withSpeech = recordLearnerTurn(started);
    expect(withSpeech.state).toBe("active");
    expect(withSpeech.metrics.learnerTurns).toBe(1);

    const withFeedback = recordFeedback(withSpeech);
    expect(withFeedback.state).toBe("feedback");
    expect(withFeedback.metrics.feedbackEvents).toBe(1);

    const completion = completeLesson(
      withFeedback,
      {},
      new Date("2026-05-12T10:05:00.000Z"),
    );

    expect(completion.qualification).toEqual({
      qualified: true,
      reason: "completed",
      retryable: false,
    });
    expect(completion.lesson.state).toBe("completed");
    expect(completion.lesson.completedAt).toBe("2026-05-12T10:05:00.000Z");
  });

  it("marks interrupted completion as failed and retryable without verifying progress", () => {
    const started = createLessonSession({ lessonId: "lesson-2" });

    const completion = completeLesson(
      started,
      {
        learnerTurns: 1,
        feedbackEvents: 1,
        interrupted: true,
      },
      new Date("2026-05-12T10:10:00.000Z"),
    );

    expect(completion.qualification).toEqual({
      qualified: false,
      reason: "unverified",
      retryable: true,
    });
    expect(completion.lesson.state).toBe("failed");
    expect(completion.lesson.failureReason).toBe("interrupted");
    expect(completion.lesson.failedAt).toBe("2026-05-12T10:10:00.000Z");
  });
});
