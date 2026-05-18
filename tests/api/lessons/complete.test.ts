import { afterEach, describe, expect, it } from "vitest";

import { POST } from "@/../app/api/lessons/complete/route";
import {
  createTrackedLesson,
  getTrackedLessonAccessToken,
  recordTrustedFeedback,
  recordTrustedLearnerTurn,
  resetTrackedLessonsForTests,
} from "@/server/lesson-store";
import {
  PROGRESS_COOKIE_NAME,
  resetAnonymousProgressForTests,
} from "@/server/progress-store";

describe("POST /api/lessons/complete", () => {
  afterEach(() => {
    resetTrackedLessonsForTests();
    resetAnonymousProgressForTests();
  });

  it("awards XP after trusted server-side participation and feedback", async () => {
    createTrackedLesson({
      lessonId: "lesson-complete",
      now: new Date("2026-05-13T00:00:00.000Z"),
    });
    recordTrustedLearnerTurn("lesson-complete");
    recordTrustedFeedback("lesson-complete");

    const response = await POST(lessonAccessRequest("lesson-complete"));
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
    expect(body.progress).toEqual({
      totalXp: 50,
      completedLessons: 1,
      lastAwardedAt: expect.any(String),
    });
    const progressCookie = readCookiePair(response, PROGRESS_COOKIE_NAME);
    const duplicateResponse = await POST(
      lessonAccessRequest("lesson-complete", progressCookie),
    );
    const duplicateBody = await duplicateResponse.json();

    expect(duplicateResponse.status).toBe(200);
    expect(duplicateBody.progress).toEqual(body.progress);
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
          lessonAccessToken: getTrackedLessonAccessToken("lesson-opened-only"),
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
    expect(body.progress).toEqual({
      totalXp: 0,
      completedLessons: 0,
      lastAwardedAt: null,
    });
  });

  it("rejects completion when the lesson access token does not match", async () => {
    createTrackedLesson({ lessonId: "lesson-complete" });

    const response = await POST(
      new Request("http://localhost/api/lessons/complete", {
        method: "POST",
        body: JSON.stringify({
          lessonId: "lesson-complete",
          lessonAccessToken: "wrong-token",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("lesson-access-denied");
  });
});

function lessonAccessRequest(lessonId: string, cookie?: string) {
  return new Request("http://localhost/api/lessons/complete", {
    method: "POST",
    headers: cookie ? { cookie } : undefined,
    body: JSON.stringify({
      lessonId,
      lessonAccessToken: getTrackedLessonAccessToken(lessonId),
    }),
  });
}

function readCookiePair(response: Response, cookieName: string) {
  const setCookie = response.headers.get("set-cookie") ?? "";
  const [cookiePair] = setCookie.split(";");

  expect(cookiePair?.startsWith(`${cookieName}=`)).toBe(true);

  return cookiePair;
}
