import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  failLesson,
  createLessonSession,
  toSafeLessonResponse,
} from "@/domain/lesson";
import type { AvatarStatus } from "@/integrations/avatar/avatar-adapter";
import { createHeyGenAvatarAdapterFromConfig } from "@/integrations/avatar/heygen";
import { createLiveAvatarAdapterFromConfig } from "@/integrations/avatar/liveavatar";
import {
  createTrackedLesson,
  getTrackedLessonAccessToken,
} from "@/server/lesson-store";
import { rateLimitPolicies } from "@/server/rate-limit";
import { checkRateLimitResponse } from "@/server/rate-limit-response";
import { enforceSameOriginRequest } from "@/server/request-guard";

export async function POST(request: Request) {
  const crossSiteBlocked = enforceSameOriginRequest(request);

  if (crossSiteBlocked) {
    return crossSiteBlocked;
  }

  const rateLimited = checkRateLimitResponse({
    request,
    policy: rateLimitPolicies.lessonStart,
  });

  if (rateLimited) {
    return rateLimited;
  }

  try {
    const lesson = createTrackedLesson({ lessonId: randomUUID() });
    const avatar = await resolveLessonAvatarStatus(lesson.id);

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

async function resolveLessonAvatarStatus(lessonId: string) {
  const liveAvatar = await createLiveAvatarAdapterFromConfig().getStatus({
    lessonId,
  });

  if (isAvailableLiveAvatar(liveAvatar)) return liveAvatar;

  return createHeyGenAvatarAdapterFromConfig().getStatus({ lessonId });
}

function isAvailableLiveAvatar(
  avatar: AvatarStatus,
): avatar is AvatarStatus & { mode: "live"; available: true } {
  return avatar.mode === "live" && avatar.available;
}
