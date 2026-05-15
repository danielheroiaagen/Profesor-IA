import { NextResponse } from "next/server";

import { awardLessonXp } from "@/domain/gamification";
import { toSafeLessonResponse } from "@/domain/lesson";
import {
  hasLessonAccess,
  parseLessonAccessRequest,
  type LessonAccessRequest,
} from "@/server/lesson-access";
import { completeTrackedLesson } from "@/server/lesson-store";
import { rateLimitPolicies } from "@/server/rate-limit";
import { checkRateLimitResponse } from "@/server/rate-limit-response";

type CompleteLessonRequest = LessonAccessRequest;

export async function POST(request: Request) {
  const parsed = await parseCompleteLessonRequest(request);

  if (!parsed.ok) {
    return NextResponse.json(
      {
        error: {
          code: "invalid-lesson-completion",
          message: "Completion evidence is invalid.",
        },
      },
      { status: 400 },
    );
  }

  if (!hasLessonAccess(parsed.value)) {
    return NextResponse.json(
      {
        error: {
          code: "lesson-access-denied",
          message: "Completion could not be verified from your lesson.",
        },
      },
      { status: 403 },
    );
  }

  const rateLimited = checkRateLimitResponse({
    request,
    policy: rateLimitPolicies.lessonCompletion,
    scope: parsed.value.lessonId,
  });

  if (rateLimited) {
    return rateLimited;
  }

  const completion = completeTrackedLesson(parsed.value.lessonId);

  if (!completion) {
    return NextResponse.json(
      {
        error: {
          code: "lesson-not-found",
          message: "Completion could not be verified from server lesson state.",
        },
      },
      { status: 404 },
    );
  }

  const xp = awardLessonXp(completion.qualification);

  return NextResponse.json({
    lesson: toSafeLessonResponse(completion.lesson),
    completion: completion.qualification,
    xp,
  });
}

type ParseResult =
  | {
      ok: true;
      value: CompleteLessonRequest;
    }
  | {
      ok: false;
    };

async function parseCompleteLessonRequest(
  request: Request,
): Promise<ParseResult> {
  return parseLessonAccessRequest(request);
}
