import type { CompletionQualification } from "@/domain/lesson";

export const LESSON_COMPLETION_XP = 50;

export type XPResult = {
  awarded: boolean;
  xp: number;
  reason: "completed" | "insufficient-participation" | "unverified";
};

export function awardLessonXp(qualification: CompletionQualification): XPResult {
  if (!qualification.qualified) {
    return {
      awarded: false,
      xp: 0,
      reason: qualification.reason,
    };
  }

  return {
    awarded: true,
    xp: LESSON_COMPLETION_XP,
    reason: "completed",
  };
}
