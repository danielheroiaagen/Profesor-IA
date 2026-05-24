import { NextResponse } from "next/server";

import {
  mintRealtimeSessionFromConfig,
  RealtimeSessionError,
} from "@/integrations/openai/realtime";
import {
  hasLessonAccess,
  parseLessonAccessRequest,
} from "@/server/lesson-access";
import { getTrackedLessonPlan } from "@/server/lesson-store";
import { rateLimitPolicies } from "@/server/rate-limit";
import { checkRateLimitResponse } from "@/server/rate-limit-response";
import { enforceSameOriginRequest } from "@/server/request-guard";

export async function POST(request: Request) {
  const crossSiteBlocked = enforceSameOriginRequest(request);

  if (crossSiteBlocked) {
    return crossSiteBlocked;
  }

  const parsed = await parseLessonAccessRequest(request);

  if (!parsed.ok || !hasLessonAccess(parsed.value)) {
    return NextResponse.json(
      {
        error: {
          code: "lesson-access-denied",
          message: "Voice session could not start. Please restart the lesson.",
        },
      },
      { status: 403 },
    );
  }

  const { lessonId } = parsed.value;
  const rateLimited = checkRateLimitResponse({
    request,
    policy: rateLimitPolicies.realtimeSession,
    scope: lessonId,
  });

  if (rateLimited) {
    return rateLimited;
  }

  try {
    const realtime = await mintRealtimeSessionFromConfig({
      lessonId,
      lessonPlan: getTrackedLessonPlan(lessonId) ?? undefined,
      safetyIdentifier: lessonId,
    });

    return NextResponse.json({ realtime }, { status: 201 });
  } catch (error) {
    const code =
      error instanceof RealtimeSessionError
        ? "realtime-session-unavailable"
        : "realtime-session-failed";

    return NextResponse.json(
      {
        error: {
          code,
          message: "Voice session could not start. Please retry.",
        },
      },
      { status: 502 },
    );
  }
}
