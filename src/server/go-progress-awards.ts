import "server-only";

import type { XPResult } from "@/domain/gamification";
import type { LessonMetrics } from "@/domain/lesson";

const GO_PROGRESS_AWARD_PATH = "/v1/progress/awards";
const GO_PROGRESS_AWARD_TIMEOUT_MS = 3_000;

type RecordGoProgressAwardInput = {
  progressId: string;
  lessonId: string;
  metrics: LessonMetrics;
  xp: XPResult;
};

type GoProgressAwardOutcome = {
  configured: boolean;
  recorded: boolean;
  inserted: boolean;
  reason: string;
};

export async function recordGoProgressAward({
  progressId,
  lessonId,
  metrics,
  xp,
}: RecordGoProgressAwardInput): Promise<GoProgressAwardOutcome> {
  const endpoint = readGoProgressAwardEndpoint();

  if (!endpoint) {
    return notRecorded("not_configured", false);
  }

  if (!xp.awarded || xp.xp <= 0) {
    return notRecorded("not_awarded", true);
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    GO_PROGRESS_AWARD_TIMEOUT_MS,
  );

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        attemptId: lessonId,
        anonymousProgressId: progressId,
        evidence: {
          verified: true,
          learnerTurns: metrics.learnerTurns,
          feedbacks: metrics.feedbackEvents,
          interrupted: false,
        },
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      return notRecorded("go_api_unavailable", true);
    }

    const body = await readAwardResponse(response);
    const recorded = body.awarded === true && body.xp > 0;

    return {
      configured: true,
      recorded,
      inserted: body.inserted === true,
      reason: body.reason || (recorded ? "recorded" : "not_awarded"),
    };
  } catch {
    return notRecorded("go_api_unavailable", true);
  } finally {
    clearTimeout(timeout);
  }
}

function readGoProgressAwardEndpoint(): string | null {
  const rawBaseUrl = process.env.GO_API_INTERNAL_URL?.trim();

  if (!rawBaseUrl) {
    return null;
  }

  try {
    const baseUrl = new URL(rawBaseUrl);

    if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
      return null;
    }

    return new URL(GO_PROGRESS_AWARD_PATH, baseUrl).toString();
  } catch {
    return null;
  }
}

async function readAwardResponse(response: Response) {
  try {
    const value: unknown = await response.json();

    if (!isRecord(value)) {
      return emptyAwardResponse();
    }

    return {
      awarded: value.awarded === true,
      xp: typeof value.xp === "number" && Number.isFinite(value.xp) ? value.xp : 0,
      inserted: value.inserted === true,
      reason: typeof value.reason === "string" ? value.reason : "",
    };
  } catch {
    return emptyAwardResponse();
  }
}

function emptyAwardResponse() {
  return {
    awarded: false,
    xp: 0,
    inserted: false,
    reason: "",
  };
}

function notRecorded(
  reason: string,
  configured: boolean,
): GoProgressAwardOutcome {
  return {
    configured,
    recorded: false,
    inserted: false,
    reason,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
