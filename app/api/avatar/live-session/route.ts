import { NextResponse } from "next/server";

import {
  LiveAvatarSessionError,
  mintLiveAvatarSessionFromConfig,
} from "@/integrations/avatar/liveavatar";
import {
  hasLessonAccess,
  parseLessonAccessRequest,
} from "@/server/lesson-access";
import { rateLimitPolicies } from "@/server/rate-limit";
import { checkRateLimitResponse } from "@/server/rate-limit-response";

export async function POST(request: Request) {
  const parsed = await parseLessonAccessRequest(request);

  if (!parsed.ok || !hasLessonAccess(parsed.value)) {
    return NextResponse.json(
      {
        error: {
          code: "lesson-access-denied",
          message:
            "Live avatar session could not start. Voice mode remains available.",
        },
      },
      { status: 403 },
    );
  }

  const rateLimited = checkRateLimitResponse({
    request,
    policy: rateLimitPolicies.liveAvatarSession,
    scope: parsed.value.lessonId,
  });

  if (rateLimited) {
    return rateLimited;
  }

  try {
    const liveAvatar = await mintLiveAvatarSessionFromConfig();

    return NextResponse.json({ liveAvatar }, { status: 201 });
  } catch (error) {
    const code =
      error instanceof LiveAvatarSessionError
        ? error.reason
        : "avatar-live-session-failed";

    return NextResponse.json(
      {
        error: {
          code,
          message:
            "Live avatar session could not start. Voice mode remains available.",
        },
      },
      { status: 502 },
    );
  }
}
