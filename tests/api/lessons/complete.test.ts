import { describe, expect, it } from "vitest";

import { POST } from "@/../app/api/lessons/complete/route";

describe("POST /api/lessons/complete", () => {
  it("awards XP after meaningful participation and feedback", async () => {
    const response = await POST(
      new Request("http://localhost/api/lessons/complete", {
        method: "POST",
        body: JSON.stringify({
          lessonId: "lesson-complete",
          learnerTurns: 1,
          feedbackEvents: 1,
          canVerify: true,
          startedAt: "2026-05-13T00:00:00.000Z",
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

  it("does not award XP before participation", async () => {
    const response = await POST(
      new Request("http://localhost/api/lessons/complete", {
        method: "POST",
        body: JSON.stringify({
          lessonId: "lesson-opened-only",
          learnerTurns: 0,
          feedbackEvents: 0,
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
