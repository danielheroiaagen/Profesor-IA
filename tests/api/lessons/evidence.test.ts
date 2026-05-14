import { describe, expect, it, afterEach } from "vitest";

import { POST as completeLesson } from "@/../app/api/lessons/complete/route";
import { POST as recordEvidence } from "@/../app/api/lessons/evidence/route";
import {
  createTrackedLesson,
  resetTrackedLessonsForTests,
} from "@/server/lesson-store";

describe("POST /api/lessons/evidence", () => {
  afterEach(() => {
    resetTrackedLessonsForTests();
  });

  it("records realtime participation and feedback evidence for XP", async () => {
    createTrackedLesson({
      lessonId: "lesson-realtime-evidence",
      now: new Date("2026-05-15T00:00:00.000Z"),
    });

    const learnerTurn = await recordEvidence(
      evidenceRequest({
        lessonId: "lesson-realtime-evidence",
        evidence: "learner-turn",
      }),
    );
    const learnerTurnBody = await learnerTurn.json();

    expect(learnerTurn.status).toBe(200);
    expect(learnerTurnBody.lesson.metrics).toMatchObject({
      learnerTurns: 1,
      feedbackEvents: 0,
    });

    const feedback = await recordEvidence(
      evidenceRequest({
        lessonId: "lesson-realtime-evidence",
        evidence: "feedback",
      }),
    );
    const feedbackBody = await feedback.json();

    expect(feedback.status).toBe(200);
    expect(feedbackBody.lesson.metrics).toMatchObject({
      learnerTurns: 1,
      feedbackEvents: 1,
    });

    const completion = await completeLesson(
      new Request("http://localhost/api/lessons/complete", {
        method: "POST",
        body: JSON.stringify({
          lessonId: "lesson-realtime-evidence",
        }),
      }),
    );
    const completionBody = await completion.json();

    expect(completion.status).toBe(200);
    expect(completionBody.xp).toEqual({
      awarded: true,
      xp: 50,
      reason: "completed",
    });
  });
});

function evidenceRequest(body: { lessonId: string; evidence: string }) {
  return new Request("http://localhost/api/lessons/evidence", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
