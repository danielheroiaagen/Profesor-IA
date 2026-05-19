import type { XPResult } from "@/domain/gamification";

export type AnonymousProgress = {
  totalXp: number;
  completedLessons: number;
  lastAwardedAt: string | null;
};

export function createInitialProgress(): AnonymousProgress {
  return {
    totalXp: 0,
    completedLessons: 0,
    lastAwardedAt: null,
  };
}

export function applyAwardedXp(
  progress: AnonymousProgress,
  xp: XPResult,
  now = new Date(),
): AnonymousProgress {
  if (!xp.awarded || xp.xp <= 0) {
    return progress;
  }

  return {
    totalXp: progress.totalXp + Math.floor(xp.xp),
    completedLessons: progress.completedLessons + 1,
    lastAwardedAt: now.toISOString(),
  };
}

export function toSafeProgressResponse(
  progress: AnonymousProgress,
): AnonymousProgress {
  return { ...progress };
}
