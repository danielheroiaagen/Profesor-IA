// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LessonClient from "@/../app/lesson/lesson-client";

describe("LessonClient smoke", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
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

  it("shows safe fallback when microphone permission is denied", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => {
          throw new Error("Microphone permission denied by browser.");
        }),
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        if (String(url) === "/api/lessons/start") {
          return Response.json({
            lesson: {
              id: "lesson-permission-denied",
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
            lessonId: "lesson-permission-denied",
            connectUrl: "https://api.openai.com/v1/realtime/calls",
          },
        });
      }),
    );

    render(<LessonClient />);

    fireEvent.click(screen.getByRole("button", { name: "Start voice lesson" }));

    await waitFor(() => expect(screen.getByText("fallback")).toBeVisible());
    expect(screen.getByRole("alert")).toHaveTextContent("Microphone permission denied by browser.");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "You can retry without exposing any secret value.",
    );
  });

  it("uses the server-returned Realtime connect URL and limited credential", async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const connectUrl = "https://example.test/realtime/calls";
    const connectAttempts: RequestInit[] = [];
    const requestedUrls: string[] = [];

    vi.stubGlobal("Audio", vi.fn(() => ({ autoplay: false, srcObject: null })));
    vi.stubGlobal(
      "RTCPeerConnection",
      vi.fn(() => ({
        addTrack: vi.fn(),
        createDataChannel: vi.fn(() => ({ close: vi.fn(), onmessage: null })),
        createOffer: vi.fn(async () => ({ sdp: "offer-sdp", type: "offer" })),
        setLocalDescription: vi.fn(async () => undefined),
        setRemoteDescription: vi.fn(async () => undefined),
        close: vi.fn(),
      })),
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => stream),
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const value = String(url);
        requestedUrls.push(value);

        if (value === "/api/lessons/start") {
          return Response.json({
            lesson: {
              id: "lesson-connect-url",
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

        if (value === "/api/realtime/session") {
          return Response.json({
            realtime: {
              clientSecret: "ek_test_ephemeral",
              model: "gpt-realtime-2",
              expiresAt: "2026-05-13T00:10:00.000Z",
              lessonId: "lesson-connect-url",
              connectUrl,
            },
          });
        }

        connectAttempts.push(init ?? {});
        return new Response("answer-sdp");
      }),
    );

    render(<LessonClient />);

    fireEvent.click(screen.getByRole("button", { name: "Start voice lesson" }));

    await waitFor(() => expect(screen.getByText("connected")).toBeVisible());
    expect(requestedUrls).toEqual(
      expect.arrayContaining(["/api/lessons/start", "/api/realtime/session", connectUrl]),
    );
    expect(connectAttempts[0]?.headers).toMatchObject({
      Authorization: "Bearer ek_test_ephemeral",
      "Content-Type": "application/sdp",
    });
    expect(connectAttempts[0]?.body).toBe("offer-sdp");
  });

  it("shows failed completion state when server denies XP", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        if (String(url) === "/api/lessons/start") {
          return Response.json({
            lesson: {
              id: "lesson-denied",
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

        if (String(url) === "/api/realtime/session") {
          return Response.json({
            realtime: {
              clientSecret: "ek_test_ephemeral",
              model: "gpt-realtime-2",
              expiresAt: "2026-05-13T00:10:00.000Z",
              lessonId: "lesson-denied",
              connectUrl: "https://api.openai.com/v1/realtime/calls",
            },
          });
        }

        return Response.json({
          lesson: {
            id: "lesson-denied",
            state: "failed",
            startedAt: "2026-05-13T00:00:00.000Z",
            metrics: { learnerTurns: 0, feedbackEvents: 0 },
            failureReason: "insufficient-participation",
            completionReason: "insufficient-participation",
          },
          xp: {
            awarded: false,
            xp: 0,
            reason: "insufficient-participation",
          },
        });
      }),
    );

    render(<LessonClient />);

    fireEvent.click(screen.getByRole("button", { name: "Start voice lesson" }));
    expect(await screen.findByText(/voice-only \(avatar-provider-not-configured\)/)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Complete lesson and calculate XP" }));

    await waitFor(() => expect(screen.getByText("failed")).toBeVisible());
    expect(screen.getByRole("heading", { name: "No XP awarded" })).toBeVisible();
  });

  it("closes the previous realtime connection before starting another one", async () => {
    const firstTrack = { stop: vi.fn() };
    const secondTrack = { stop: vi.fn() };
    const streams = [
      { getTracks: () => [firstTrack] },
      { getTracks: () => [secondTrack] },
    ] as unknown as MediaStream[];
    const peerConnections: Array<{ close: ReturnType<typeof vi.fn> }> = [];
    const dataChannels: Array<{ close: ReturnType<typeof vi.fn>; onmessage: ((event: MessageEvent) => void) | null }> = [];

    vi.stubGlobal("Audio", vi.fn(() => ({ autoplay: false, srcObject: null })));
    vi.stubGlobal(
      "RTCPeerConnection",
      vi.fn(() => {
        const dataChannel = { close: vi.fn(), onmessage: null };
        const peerConnection = {
          addTrack: vi.fn(),
          createDataChannel: vi.fn(() => dataChannel),
          createOffer: vi.fn(async () => ({ sdp: "offer-sdp", type: "offer" })),
          setLocalDescription: vi.fn(async () => undefined),
          setRemoteDescription: vi.fn(async () => undefined),
          close: vi.fn(),
        };

        dataChannels.push(dataChannel);
        peerConnections.push(peerConnection);

        return peerConnection;
      }),
    );
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn(async () => streams.shift()),
      },
    });

    let startCount = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request) => {
        const value = String(url);

        if (value === "/api/lessons/start") {
          startCount += 1;
          return Response.json({
            lesson: {
              id: `lesson-connected-${startCount}`,
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

        if (value === "/api/realtime/session") {
          return Response.json({
            realtime: {
              clientSecret: "ek_test_ephemeral",
              model: "gpt-realtime-2",
              expiresAt: "2026-05-13T00:10:00.000Z",
              lessonId: "lesson-connected",
              connectUrl: "https://api.openai.com/v1/realtime/calls",
            },
          });
        }

        return new Response("answer-sdp");
      }),
    );

    render(<LessonClient />);

    fireEvent.click(screen.getByRole("button", { name: "Start voice lesson" }));
    await waitFor(() => expect(screen.getByText("connected")).toBeVisible());

    fireEvent.click(screen.getByRole("button", { name: "Start voice lesson" }));
    await waitFor(() => expect(firstTrack.stop).toHaveBeenCalled());

    expect(dataChannels[0]?.close).toHaveBeenCalled();
    expect(peerConnections[0]?.close).toHaveBeenCalled();
  });
});
