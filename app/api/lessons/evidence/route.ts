import { NextResponse } from "next/server";

import { toSafeLessonResponse } from "@/domain/lesson";
import {
  recordTrustedFeedback,
  recordTrustedLearnerTurn,
} from "@/server/lesson-store";

type EvidenceType = "learner-turn" | "feedback";

type EvidenceRequest = {
  lessonId: string;
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

    if (!lessonId || !evidence) {
      return { ok: false };
    }

    return {
      ok: true,
      value: {
        lessonId,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
