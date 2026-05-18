import "server-only";

import { randomUUID } from "node:crypto";

import type { NextResponse } from "next/server";

import type { XPResult } from "@/domain/gamification";
import {
  applyAwardedXp,
  createInitialProgress,
  toSafeProgressResponse,
  type AnonymousProgress,
} from "@/domain/progress";

export const PROGRESS_COOKIE_NAME = "profesor-ia.progress-id";

const progressStoreKey = "__profesorIaProgressStore";
const progressCookieMaxAgeSeconds = 60 * 60 * 24 * 365;
const progressStore = getProcessProgressStore();

type AnonymousProgressRecord = {
  progress: AnonymousProgress;
  awardedLessonIds: Set<string>;
};

export function getOrCreateAnonymousProgressId(request: Request): string {
  const cookieId = readProgressCookie(request);

  if (cookieId) {
    ensureProgressRecord(cookieId);
    return cookieId;
  }

  const id = randomUUID();
  ensureProgressRecord(id);
  return id;
}

export function readAnonymousProgress(progressId: string): AnonymousProgress {
  return toSafeProgressResponse(ensureProgressRecord(progressId).progress);
}

export function recordLessonProgress({
  progressId,
  lessonId,
  xp,
  now = new Date(),
}: {
  progressId: string;
  lessonId: string;
  xp: XPResult;
  now?: Date;
}): AnonymousProgress {
  const record = ensureProgressRecord(progressId);

  if (!xp.awarded || xp.xp <= 0 || record.awardedLessonIds.has(lessonId)) {
    return toSafeProgressResponse(record.progress);
  }

  record.progress = applyAwardedXp(record.progress, xp, now);
  record.awardedLessonIds.add(lessonId);
  return toSafeProgressResponse(record.progress);
}

export function writeAnonymousProgressCookie({
  response,
  request,
  progressId,
}: {
  response: NextResponse;
  request: Request;
  progressId: string;
}) {
  response.cookies.set(PROGRESS_COOKIE_NAME, progressId, {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: progressCookieMaxAgeSeconds,
  });
}

export function resetAnonymousProgressForTests() {
  progressStore.clear();
}

function ensureProgressRecord(progressId: string): AnonymousProgressRecord {
  const record = progressStore.get(progressId) ?? {
    progress: createInitialProgress(),
    awardedLessonIds: new Set<string>(),
  };

  progressStore.set(progressId, record);
  return record;
}

function readProgressCookie(request: Request): string | null {
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${PROGRESS_COOKIE_NAME}=`));
  const value = cookie?.slice(PROGRESS_COOKIE_NAME.length + 1).trim();

  return value && isValidOpaqueId(value) ? value : null;
}

function isValidOpaqueId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getProcessProgressStore(): Map<string, AnonymousProgressRecord> {
  const processGlobal = globalThis as typeof globalThis & {
    [progressStoreKey]?: Map<string, AnonymousProgressRecord>;
  };

  processGlobal[progressStoreKey] ??= new Map<
    string,
    AnonymousProgressRecord
  >();

  return processGlobal[progressStoreKey];
}
