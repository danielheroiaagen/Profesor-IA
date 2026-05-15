import { NextResponse } from "next/server";

import { toSafeLessonResponse } from "@/domain/lesson";
import { hasLessonAccess, isRecord, readString } from "@/server/lesson-access";
import {
  recordTrustedFeedback,
  recordTrustedLearnerTurn,
} from "@/server/lesson-store";

type EvidenceType = "learner-turn" | "feedback";

type EvidenceRequest = {
  lessonId: string;
  lessonAccessToken: string;
  evidence: EvidenceType;
};

export async function POST(request: Request) {
  const parsed = await parseEvidenceRequest(request);

  if (!parsed.ok) {
    return NextResponse.json(
      {
        error: {
          code: "invalid-lesson-evidence",
          message: "Lesson evidence is invalid.",
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
          message: "Lesson evidence could not be matched to your lesson.",
        },
      },
      { status: 403 },
    );
  }

  const lesson =
    parsed.value.evidence === "learner-turn"
      ? recordTrustedLearnerTurn(parsed.value.lessonId)
      : recordTrustedFeedback(parsed.value.lessonId);

  if (!lesson) {
    return NextResponse.json(
      {
        error: {
          code: "lesson-not-found",
          message: "Lesson evidence could not be matched to a live lesson.",
        },
      },
      { status: 404 },
    );
  }

  return NextResponse.json({ lesson: toSafeLessonResponse(lesson) });
}

type ParseResult =
  | {
      ok: true;
      value: EvidenceRequest;
    }
  | {
      ok: false;
    };

async function parseEvidenceRequest(request: Request): Promise<ParseResult> {
  try {
    const body: unknown = await request.json();

    if (!isRecord(body)) {
      return { ok: false };
    }

    const lessonId = readString(body.lessonId);
    const evidence = readEvidence(body.evidence);
    const lessonAccessToken = readString(body.lessonAccessToken);

    if (!lessonId || !lessonAccessToken || !evidence) {
      return { ok: false };
    }

    return {
      ok: true,
      value: {
        lessonId,
        lessonAccessToken,
        evidence,
      },
    };
  } catch {
    return { ok: false };
  }
}

function readEvidence(value: unknown): EvidenceType | null {
  return value === "learner-turn" || value === "feedback" ? value : null;
}
