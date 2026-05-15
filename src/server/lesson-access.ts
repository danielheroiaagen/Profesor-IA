import "server-only";

import { canAccessTrackedLesson } from "@/server/lesson-store";

export type LessonAccessRequest = {
  lessonId: string;
  lessonAccessToken: string;
};

export type LessonAccessParseResult =
  | { ok: true; value: LessonAccessRequest }
  | { ok: false };

export async function parseLessonAccessRequest(
  request: Request,
): Promise<LessonAccessParseResult> {
  try {
    const body: unknown = await request.json();

    if (!isRecord(body)) {
      return { ok: false };
    }

    const lessonId = readString(body.lessonId);
    const lessonAccessToken = readString(body.lessonAccessToken);

    if (!lessonId || !lessonAccessToken) {
      return { ok: false };
    }

    return { ok: true, value: { lessonId, lessonAccessToken } };
  } catch {
    return { ok: false };
  }
}

export function hasLessonAccess({
  lessonId,
  lessonAccessToken,
}: LessonAccessRequest): boolean {
  return canAccessTrackedLesson({ lessonId, accessToken: lessonAccessToken });
}

export function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
