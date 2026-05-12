// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LessonClient from "@/../app/lesson/lesson-client";

describe("LessonClient smoke", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows avatar fallback and a safe retry message when audio setup fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        if (String(url) === "/api/lessons/start") {
          return Response.json({
            lesson: {
              id: "lesson-ui",
              state: "active",
              startedAt: "2026-05-13T00:00:00.000Z",
              metrics: { learnerTurns: 0, feedbackEvents: 0 },
            },
            avatar: {
              mode: "voice-only",
              available: false,
              reason: "avatar-provider-not-configured",
            },
          });
        }

        return Response.json({
          realtime: {
            clientSecret: "ek_test_ephemeral",
            model: "gpt-realtime-2",
            expiresAt: "2026-05-13T00:10:00.000Z",
            lessonId: "lesson-ui",
            connectUrl: "https://api.openai.com/v1/realtime/calls",
          },
        });
      }),
    );

    render(<LessonClient />);

    fireEvent.click(screen.getByRole("button", { name: "Start voice lesson" }));

    expect(await screen.findByText(/voice-only \(avatar-provider-not-configured\)/)).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Microphone APIs are unavailable in this browser.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "You can retry without exposing any secret value.",
    );
  });
});
