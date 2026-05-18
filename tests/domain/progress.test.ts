import { describe, expect, it } from "vitest";

import {
  applyAwardedXp,
  createInitialProgress,
  toSafeProgressResponse,
} from "@/domain/progress";

describe("anonymous progress domain", () => {
  it("adds awarded XP, ignores non-awards, and exposes safe fields", () => {
    const initial = createInitialProgress();
    const progress = applyAwardedXp(
      initial,
      { awarded: true, xp: 50, reason: "completed" },
      new Date("2026-05-13T00:00:00.000Z"),
    );

    expect(
      applyAwardedXp(initial, {
        awarded: false,
        xp: 0,
        reason: "insufficient-participation",
      }),
    ).toEqual(initial);
    expect(progress).toEqual({
      totalXp: 50,
      completedLessons: 1,
      lastAwardedAt: "2026-05-13T00:00:00.000Z",
    });
    expect(Object.keys(toSafeProgressResponse(progress)).sort()).toEqual([
      "completedLessons",
      "lastAwardedAt",
      "totalXp",
    ]);
  });
});
