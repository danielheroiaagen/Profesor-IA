import { afterEach, describe, expect, it } from "vitest";

import { POST } from "@/../app/api/lessons/complete/route";
import {
  createTrackedLesson,
  recordTrustedFeedback,
  recordTrustedLearnerTurn,
  resetTrackedLessonsForTests,
} from "@/server/lesson-store";

describe("POST /api/lessons/complete", () => {
  afterEach(() => {
    resetTrackedLessonsForTests();
  });

  it("awards XP after trusted server-side participation and feedback", async () => {
    createTrackedLesson({
      lessonId: "lesson-complete",
      now: new Date("2026-05-13T00:00:00.000Z"),
    });
    recordTrustedLearnerTurn("lesson-complete");
    recordTrustedFeedback("lesson-complete");

    const response = await POST(
      new Request("http://localhost/api/lessons/complete", {
        method: "POST",
        body: JSON.stringify({
          lessonId: "lesson-complete",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.lesson).toMatchObject({
      id: "lesson-complete",
      state: "completed",
      completionReason: "completed",
    });
    expect(body.completion).toEqual({
      qualified: true,
      reason: "completed",
      retryable: false,
    });
    expect(body.xp).toEqual({
      awarded: true,
      xp: 50,
      reason: "completed",
    });
  });

  it("does not award XP from fabricated client completion evidence", async () => {
    createTrackedLesson({
      lessonId: "lesson-opened-only",
      now: new Date("2026-05-13T00:00:00.000Z"),
    });

    const response = await POST(
      new Request("http://localhost/api/lessons/complete", {
        method: "POST",
        body: JSON.stringify({
          lessonId: "lesson-opened-only",
          learnerTurns: 1,
          feedbackEvents: 1,
          canVerify: true,
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.lesson).toMatchObject({
      id: "lesson-opened-only",
      state: "failed",
      failureReason: "insufficient-participation",
      completionReason: "insufficient-participation",
    });
    expect(body.completion).toEqual({
      qualified: false,
      reason: "insufficient-participation",
      retryable: false,
    });
    expect(body.xp).toEqual({
      awarded: false,
      xp: 0,
      reason: "insufficient-participation",
    });
  });
});
