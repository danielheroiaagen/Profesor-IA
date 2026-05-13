import { NextResponse } from "next/server";

import { awardLessonXp } from "@/domain/gamification";
import { toSafeLessonResponse } from "@/domain/lesson";
import { completeTrackedLesson } from "@/server/lesson-store";

type CompleteLessonRequest = {
  lessonId: string;
};

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
  try {
    const body: unknown = await request.json();

    if (!isRecord(body)) {
      return { ok: false };
    }

    const lessonId = readString(body.lessonId);

    if (!lessonId) {
      return { ok: false };
    }

    return {
      ok: true,
      value: {
        lessonId,
      },
    };
  } catch {
    return { ok: false };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
