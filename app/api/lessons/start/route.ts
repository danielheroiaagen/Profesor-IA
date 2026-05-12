import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  createLessonSession,
  failLesson,
  toSafeLessonResponse,
} from "@/domain/lesson";
import { createHeyGenAvatarAdapterFromConfig } from "@/integrations/avatar/heygen";

export async function POST() {
  try {
    const lesson = createLessonSession({ lessonId: randomUUID() });
    const avatar = await createHeyGenAvatarAdapterFromConfig().getStatus({
      lessonId: lesson.id,
    });

    return NextResponse.json(
      {
        lesson: toSafeLessonResponse(lesson),
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
