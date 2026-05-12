import { NextResponse } from "next/server";

import { awardLessonXp } from "@/domain/gamification";
import { completeLesson, createLessonSession, toSafeLessonResponse } from "@/domain/lesson";

type CompleteLessonRequest = {
  lessonId: string;
  learnerTurns: number;
  feedbackEvents: number;
  canVerify?: boolean;
  interrupted?: boolean;
  startedAt?: Date;
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

  const lesson = createLessonSession({
    lessonId: parsed.value.lessonId,
    now: parsed.value.startedAt,
  });
  const completion = completeLesson(lesson, {
    learnerTurns: parsed.value.learnerTurns,
    feedbackEvents: parsed.value.feedbackEvents,
    canVerify: parsed.value.canVerify,
    interrupted: parsed.value.interrupted,
  });
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

async function parseCompleteLessonRequest(request: Request): Promise<ParseResult> {
  try {
    const body: unknown = await request.json();

    if (!isRecord(body)) {
      return { ok: false };
    }

    const lessonId = readString(body.lessonId);
    const learnerTurns = readNonNegativeInteger(body.learnerTurns);
    const feedbackEvents = readNonNegativeInteger(body.feedbackEvents);
    const startedAt = readOptionalDate(body.startedAt);

    if (!lessonId || learnerTurns === null || feedbackEvents === null || startedAt === null) {
      return { ok: false };
    }

    return {
      ok: true,
      value: {
        lessonId,
        learnerTurns,
        feedbackEvents,
        startedAt,
        canVerify: readOptionalBoolean(body.canVerify),
        interrupted: readOptionalBoolean(body.interrupted),
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

function readNonNegativeInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    return null;
  }

  return value;
}

function readOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function readOptionalDate(value: unknown): Date | undefined | null {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}
