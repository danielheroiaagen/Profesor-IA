import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/../app/api/avatar/live-session/route";
import {
  createTrackedLesson,
  getTrackedLessonAccessToken,
  resetTrackedLessonsForTests,
} from "@/server/lesson-store";

const LIVEAVATAR_API_KEY = "liveavatar-secret-never-returned";

describe("POST /api/avatar/live-session", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetTrackedLessonsForTests();
  });

  it("returns a limited live avatar session and no primary key", async () => {
    vi.stubEnv("LIVEAVATAR_API_KEY", LIVEAVATAR_API_KEY);
    vi.stubEnv("HEYGEN_AVATAR_ID", "e29e792a-41e7-4df0-84a8-349e099fb50f");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          code: 1000,
          data: {
            session_id: "live-session-route",
            session_token: "live-token-limited",
          },
        }),
      ),
    );
    createTrackedLesson({ lessonId: "lesson-avatar" });

    const response = await POST(lessonAccessRequest("lesson-avatar"));
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(201);
    expect(body.liveAvatar).toMatchObject({
      provider: "liveavatar",
      mode: "live",
      avatarId: "e29e792a-41e7-4df0-84a8-349e099fb50f",
      sessionId: "live-session-route",
    });
    expect(serialized).not.toContain(LIVEAVATAR_API_KEY);
    expect(serialized).not.toContain("HEYGEN_API_KEY");
    expect(serialized).not.toContain("LIVEAVATAR_API_KEY");
  });

  it("fails safely without a configured provider key", async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);
    createTrackedLesson({ lessonId: "lesson-avatar" });

    const response = await POST(lessonAccessRequest("lesson-avatar"));
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(502);
    expect(body.error.code).toBe("avatar-live-provider-not-configured");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(serialized).not.toContain("HEYGEN_API_KEY");
    expect(serialized).not.toContain("LIVEAVATAR_API_KEY");
    expect(serialized).not.toContain(".env");
  });

  it("rejects live avatar token minting without lesson access", async () => {
    vi.stubEnv("LIVEAVATAR_API_KEY", LIVEAVATAR_API_KEY);
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);
    createTrackedLesson({ lessonId: "lesson-avatar" });

    const response = await POST(
      new Request("http://localhost/api/avatar/live-session", {
        method: "POST",
        body: JSON.stringify({
          lessonId: "lesson-avatar",
          lessonAccessToken: "wrong-token",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.code).toBe("lesson-access-denied");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

function lessonAccessRequest(lessonId: string) {
  return new Request("http://localhost/api/avatar/live-session", {
    method: "POST",
    body: JSON.stringify({
      lessonId,
      lessonAccessToken: getTrackedLessonAccessToken(lessonId),
    }),
  });
}
