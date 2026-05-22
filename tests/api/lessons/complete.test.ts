import { afterEach, describe, expect, it, vi } from "vitest";

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

const originalGoApiInternalUrl = process.env.GO_API_INTERNAL_URL;

describe("POST /api/lessons/complete", () => {
  afterEach(() => {
    resetTrackedLessonsForTests();
    resetAnonymousProgressForTests();
    restoreGoApiInternalUrl();
    vi.unstubAllGlobals();
  });

  it("awards XP after trusted server-side participation and feedback", async () => {
    createCompletableLesson("lesson-complete");

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

  it("sends trusted completion evidence to the Go progress award endpoint", async () => {
    process.env.GO_API_INTERNAL_URL = "http://go-api.test";
    createCompletableLesson("lesson-go-award");
    const fetchMock = vi.fn(async () =>
      Response.json({
        awarded: true,
        xp: 50,
        reason: "lesson_completed",
        inserted: true,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(lessonAccessRequest("lesson-go-award"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.progress).toMatchObject({ totalXp: 50, completedLessons: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    const payload = JSON.parse(String(init?.body));

    expect(String(url)).toBe("http://go-api.test/v1/progress/awards");
    expect(init?.method).toBe("POST");
    expect(payload).toMatchObject({
      attemptId: "lesson-go-award",
      anonymousProgressId: expect.any(String),
      evidence: {
        verified: true,
        learnerTurns: 1,
        feedbacks: 1,
        interrupted: false,
      },
    });
  });

  it("keeps the in-memory progress fallback when the Go endpoint is unavailable", async () => {
    process.env.GO_API_INTERNAL_URL = "http://go-api.test";
    createCompletableLesson("lesson-go-fallback");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("unavailable", { status: 503 })),
    );

    const response = await POST(lessonAccessRequest("lesson-go-fallback"));
    const body = await response.json();

    expect(response.status).toBe(200);
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

function createCompletableLesson(lessonId: string) {
  createTrackedLesson({
    lessonId,
    now: new Date("2026-05-13T00:00:00.000Z"),
  });
  recordTrustedLearnerTurn(lessonId);
  recordTrustedFeedback(lessonId);
}

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

function restoreGoApiInternalUrl() {
  if (originalGoApiInternalUrl === undefined) {
    delete process.env.GO_API_INTERNAL_URL;
    return;
  }

  process.env.GO_API_INTERNAL_URL = originalGoApiInternalUrl;
}
