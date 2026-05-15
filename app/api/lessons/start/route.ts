import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  failLesson,
  createLessonSession,
  toSafeLessonResponse,
} from "@/domain/lesson";
import { createHeyGenAvatarAdapterFromConfig } from "@/integrations/avatar/heygen";
import {
  createTrackedLesson,
  getTrackedLessonAccessToken,
} from "@/server/lesson-store";
import { rateLimitPolicies } from "@/server/rate-limit";
import { checkRateLimitResponse } from "@/server/rate-limit-response";

export async function POST(request: Request) {
  const rateLimited = checkRateLimitResponse({
    request,
    policy: rateLimitPolicies.lessonStart,
  });

  if (rateLimited) {
    return rateLimited;
  }

  try {
    const lesson = createTrackedLesson({ lessonId: randomUUID() });
    const avatar = await createHeyGenAvatarAdapterFromConfig().getStatus({
      lessonId: lesson.id,
    });

    return NextResponse.json(
      {
        lesson: toSafeLessonResponse(lesson),
        lessonAccessToken: getTrackedLessonAccessToken(lesson.id),
        avatar,
      },
      { status: 201 },
    );
  } catch {
    const failedLesson = failLesson(
      createLessonSession({ lessonId: "unavailable" }),
      "start-failed",
    );

    return NextResponse.json(
      {
        error: {
          code: "lesson-start-failed",
          message: "Lesson could not start. Please retry.",
        },
        lesson: toSafeLessonResponse(failedLesson),
      },
      { status: 500 },
    );
  }
}
