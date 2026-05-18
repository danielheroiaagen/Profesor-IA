import { afterEach, describe, expect, it } from "vitest";

import { GET } from "@/../app/api/progress/route";
import {
  PROGRESS_COOKIE_NAME,
  resetAnonymousProgressForTests,
} from "@/server/progress-store";

describe("GET /api/progress", () => {
  afterEach(resetAnonymousProgressForTests);

  it("bootstraps safe anonymous progress with an HttpOnly cookie", async () => {
    const response = await GET(new Request("http://localhost/api/progress"));
    const body = await response.json();
    const serialized = JSON.stringify(body);
    const setCookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(body.progress).toEqual({
      totalXp: 0,
      completedLessons: 0,
      lastAwardedAt: null,
    });
    expect(Object.keys(body.progress).sort()).toEqual([
      "completedLessons",
      "lastAwardedAt",
      "totalXp",
    ]);
    expect(serialized).not.toContain("lessonAccessToken");
    expect(serialized).not.toContain("clientSecret");
    expect(serialized).not.toContain("sessionToken");
    expect(setCookie).toContain(`${PROGRESS_COOKIE_NAME}=`);
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
  });

  it("rejects cross-site progress reads", async () => {
    const response = await GET(
      new Request("http://localhost/api/progress", {
        headers: {
          origin: "https://attacker.example",
          "sec-fetch-site": "cross-site",
        },
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("cross-site-request-denied");
  });
});
