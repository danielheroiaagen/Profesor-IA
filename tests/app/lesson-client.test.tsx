// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LessonClient from "@/../app/lesson/lesson-client";

function installLocalStorage(initialEntries: Record<string, string> = {}) {
  const entries = new Map(Object.entries(initialEntries));
  const storage = {
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      entries.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      entries.delete(key);
    }),
    clear: vi.fn(() => {
      entries.clear();
    }),
  };

  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });

  return storage;
}

describe("LessonClient smoke", () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it("renders a professional class surface before the lesson starts", () => {
    render(<LessonClient />);

    expect(
      screen.getByRole("heading", {
        name: "Practicá inglés con una mini clase de voz.",
      }),
    ).toBeVisible();
    expect(screen.getByText("Corrección visible")).toBeVisible();
    expect(screen.getByRole("button", { name: "Empezar clase" })).toBeEnabled();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    installLocalStorage();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });
  });

  it("shows avatar modo voz seguro and a safe retry message when audio setup fails", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Empezar clase" }));

    expect(await screen.findByText("tutor en modo voz")).toBeVisible();
    expect(
      screen.getByText(
        "La clase sigue por voz; el avatar no bloquea la práctica.",
      ),
    ).toBeVisible();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Microphone APIs are unavailable in this browser.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Podés reintentar sin exponer valores secretos.",
    );
  });

  it("shows safe modo voz seguro when microphone permission is denied", async () => {
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

    fireEvent.click(screen.getByRole("button", { name: "Empezar clase" }));

    await waitFor(() =>
      expect(screen.getByText("modo voz seguro")).toBeVisible(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Microphone permission denied by browser.",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Podés reintentar sin exponer valores secretos.",
    );
  });

  it("uses the server-returned Realtime connect URL and limited credential", async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const connectUrl = "https://example.test/realtime/calls";
    const connectAttempts: RequestInit[] = [];
    const requestedUrls: string[] = [];

    vi.stubGlobal(
      "Audio",
      vi.fn(() => ({ autoplay: false, srcObject: null })),
    );
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

    fireEvent.click(screen.getByRole("button", { name: "Empezar clase" }));

    await waitFor(() => expect(screen.getByText("voz lista")).toBeVisible());
    expect(requestedUrls).toEqual(
      expect.arrayContaining([
        "/api/lessons/start",
        "/api/realtime/session",
        connectUrl,
      ]),
    );
    expect(connectAttempts[0]?.headers).toMatchObject({
      Authorization: "Bearer ek_test_ephemeral",
      "Content-Type": "application/sdp",
    });
    expect(connectAttempts[0]?.body).toBe("offer-sdp");
  });

  it("records Realtime events as server evidence before awarding XP", async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const dataChannel: {
      close: ReturnType<typeof vi.fn>;
      onmessage: ((event: MessageEvent) => void) | null;
    } = { close: vi.fn(), onmessage: null };
    const lesson = {
      id: "lesson-realtime-evidence",
      state: "active",
      startedAt: "2026-05-13T00:00:00.000Z",
      metrics: { learnerTurns: 0, feedbackEvents: 0 },
    };

    vi.stubGlobal(
      "Audio",
      vi.fn(() => ({ autoplay: false, srcObject: null })),
    );
    vi.stubGlobal(
      "RTCPeerConnection",
      vi.fn(() => ({
        addTrack: vi.fn(),
        createDataChannel: vi.fn(() => dataChannel),
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

        if (value === "/api/lessons/start") {
          return Response.json({
            lesson,
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
              lessonId: "lesson-realtime-evidence",
              connectUrl: "https://api.openai.com/v1/realtime/calls",
            },
          });
        }

        if (value === "/api/lessons/evidence") {
          const body = JSON.parse(String(init?.body)) as {
            evidence: "learner-turn" | "feedback";
          };

          if (body.evidence === "learner-turn") {
            lesson.metrics.learnerTurns += 1;
          } else {
            lesson.metrics.feedbackEvents += 1;
            lesson.state = "feedback";
          }

          return Response.json({ lesson });
        }

        return new Response("answer-sdp");
      }),
    );

    render(<LessonClient />);

    fireEvent.click(screen.getByRole("button", { name: "Empezar clase" }));
    await waitFor(() => expect(screen.getByText("voz lista")).toBeVisible());

    act(() => {
      dataChannel.onmessage?.({
        data: JSON.stringify({
          type: "conversation.item.input_audio_transcription.completed",
          transcript: "I am practicing English today.",
        }),
      } as MessageEvent);
    });
    await waitFor(() =>
      expect(screen.getByText("Prácticas: 1 · Feedback: 0")).toBeVisible(),
    );

    act(() => {
      dataChannel.onmessage?.({
        data: JSON.stringify({
          type: "response.output_audio_transcript.done",
          transcript: "Good job. Say: I am practicing English today.",
        }),
      } as MessageEvent);
    });
    await waitFor(() =>
      expect(screen.getByText("Prácticas: 1 · Feedback: 1")).toBeVisible(),
    );
    expect(
      screen.getByText("Good job. Say: I am practicing English today."),
    ).toBeVisible();
  });

  it("persists server-awarded XP as anonymous local progress", async () => {
    window.localStorage.setItem("profesor-ia.total-xp", "10");
    const lesson = {
      id: "lesson-local-progress",
      state: "active",
      startedAt: "2026-05-13T00:00:00.000Z",
      metrics: { learnerTurns: 0, feedbackEvents: 0 },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const value = String(url);

        if (value === "/api/lessons/start") {
          return Response.json({
            lesson,
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
              lessonId: "lesson-local-progress",
              connectUrl: "https://api.openai.com/v1/realtime/calls",
            },
          });
        }

        if (value === "/api/lessons/evidence") {
          const body = JSON.parse(String(init?.body)) as {
            evidence: "learner-turn" | "feedback";
          };

          if (body.evidence === "learner-turn") {
            lesson.metrics.learnerTurns += 1;
          } else {
            lesson.metrics.feedbackEvents += 1;
            lesson.state = "feedback";
          }

          return Response.json({ lesson });
        }

        return Response.json({
          lesson: {
            ...lesson,
            state: "completed",
            completionReason: "completed",
          },
          xp: {
            awarded: true,
            xp: 50,
            reason: "completed",
          },
        });
      }),
    );

    render(<LessonClient />);

    expect(await screen.findByText("10 XP guardados")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Empezar clase" }));
    await screen.findByText("modo voz seguro");

    fireEvent.click(
      screen.getByRole("button", { name: "Ya practiqué la frase" }),
    );
    await waitFor(() =>
      expect(screen.getByText("Prácticas: 1 · Feedback: 0")).toBeVisible(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Ver corrección sugerida" }),
    );
    await waitFor(() =>
      expect(screen.getByText("Prácticas: 1 · Feedback: 1")).toBeVisible(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Finalizar clase" }));

    expect(await screen.findByText("+50 XP ganados")).toBeVisible();
    expect(await screen.findByText("Total guardado: 60 XP.")).toBeVisible();
    expect(window.localStorage.getItem("profesor-ia.total-xp")).toBe("60");
  });

  it("clears anonymous local XP progress from browser storage", async () => {
    window.localStorage.setItem("profesor-ia.total-xp", "60");

    render(<LessonClient />);

    expect(await screen.findByText("60 XP guardados")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Borrar progreso local" }),
    );

    expect(await screen.findByText("0 XP guardados")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Borrar progreso local" }),
    ).not.toBeInTheDocument();
    expect(window.localStorage.getItem("profesor-ia.total-xp")).toBeNull();
  });

  it("clears stale lesson state when retry start fails before creating a new lesson", async () => {
    let startCount = 0;
    const lesson = {
      id: "lesson-retry-clears-stale-state",
      state: "active",
      startedAt: "2026-05-13T00:00:00.000Z",
      metrics: { learnerTurns: 0, feedbackEvents: 0 },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const value = String(url);

        if (value === "/api/lessons/start") {
          startCount += 1;

          if (startCount === 2) {
            return Response.json(
              {
                error: {
                  message: "Could not start a new lesson safely.",
                },
              },
              { status: 503 },
            );
          }

          return Response.json({
            lesson,
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
              lessonId: "lesson-retry-clears-stale-state",
              connectUrl: "https://api.openai.com/v1/realtime/calls",
            },
          });
        }

        if (value === "/api/lessons/evidence") {
          const body = JSON.parse(String(init?.body)) as {
            evidence: "learner-turn" | "feedback";
          };

          if (body.evidence === "learner-turn") {
            lesson.metrics.learnerTurns += 1;
          } else {
            lesson.metrics.feedbackEvents += 1;
            lesson.state = "feedback";
          }

          return Response.json({ lesson });
        }

        return Response.json({
          lesson: {
            ...lesson,
            state: "completed",
            completionReason: "completed",
          },
          xp: {
            awarded: true,
            xp: 50,
            reason: "completed",
          },
        });
      }),
    );

    render(<LessonClient />);

    fireEvent.click(screen.getByRole("button", { name: "Empezar clase" }));
    await screen.findByText("tutor en modo voz");

    fireEvent.click(
      screen.getByRole("button", { name: "Ya practiqué la frase" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Ver corrección sugerida" }),
    );
    await waitFor(() =>
      expect(screen.getByText("Prácticas: 1 · Feedback: 1")).toBeVisible(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Finalizar clase" }));

    expect(await screen.findByText("+50 XP ganados")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Practicar otra vez" }));

    expect(await screen.findByText("reintento recomendado")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not start a new lesson safely.",
    );
    expect(screen.getByText("no conectada")).toBeVisible();
    expect(screen.getByText("tutor listo para empezar")).toBeVisible();
    expect(screen.getByText("sin emitir")).toBeVisible();
    expect(screen.getByText("Prácticas: 0 · Feedback: 0")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Ya practiqué la frase" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Ver corrección sugerida" }),
    ).toBeDisabled();
  });

  it("shows failed completion state when server denies XP", async () => {
    const lesson = {
      id: "lesson-denied",
      state: "active",
      startedAt: "2026-05-13T00:00:00.000Z",
      metrics: { learnerTurns: 0, feedbackEvents: 0 },
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        const value = String(url);

        if (value === "/api/lessons/start") {
          return Response.json({
            lesson,
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
              lessonId: "lesson-denied",
              connectUrl: "https://api.openai.com/v1/realtime/calls",
            },
          });
        }

        if (value === "/api/lessons/evidence") {
          const body = JSON.parse(String(init?.body)) as {
            evidence: "learner-turn" | "feedback";
          };

          if (body.evidence === "learner-turn") {
            lesson.metrics.learnerTurns += 1;
          } else {
            lesson.metrics.feedbackEvents += 1;
            lesson.state = "feedback";
          }

          return Response.json({ lesson });
        }

        return Response.json({
          lesson: {
            id: "lesson-denied",
            state: "failed",
            startedAt: "2026-05-13T00:00:00.000Z",
            metrics: { learnerTurns: 1, feedbackEvents: 1 },
            failureReason: "unverified",
            completionReason: "unverified",
          },
          xp: {
            awarded: false,
            xp: 0,
            reason: "unverified",
          },
        });
      }),
    );

    render(<LessonClient />);

    fireEvent.click(screen.getByRole("button", { name: "Empezar clase" }));
    expect(await screen.findByText("tutor en modo voz")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Esperando evidencia de voz" }),
    ).toBeDisabled();

    fireEvent.click(
      screen.getByRole("button", { name: "Ya practiqué la frase" }),
    );
    await waitFor(() =>
      expect(screen.getByText("Prácticas: 1 · Feedback: 0")).toBeVisible(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Ver corrección sugerida" }),
    );
    await waitFor(() =>
      expect(screen.getByText("Prácticas: 1 · Feedback: 1")).toBeVisible(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Finalizar clase" }));

    await waitFor(() =>
      expect(screen.getByText("reintento recomendado")).toBeVisible(),
    );
    expect(
      screen.getByRole("heading", { name: "Todavía sin XP" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Reintentar clase" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Ya practiqué la frase" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Ver corrección sugerida" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Finalizar clase" }),
    ).toBeDisabled();
  });

  it("closes realtime microphone capture when the lesson finishes", async () => {
    const track = { stop: vi.fn() };
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const dataChannel: {
      close: ReturnType<typeof vi.fn>;
      onmessage: ((event: MessageEvent) => void) | null;
    } = { close: vi.fn(), onmessage: null };
    const lesson = {
      id: "lesson-finish-closes-mic",
      state: "active",
      startedAt: "2026-05-13T00:00:00.000Z",
      metrics: { learnerTurns: 0, feedbackEvents: 0 },
    };
    const peerConnection = {
      addTrack: vi.fn(),
      createDataChannel: vi.fn(() => dataChannel),
      createOffer: vi.fn(async () => ({ sdp: "offer-sdp", type: "offer" })),
      setLocalDescription: vi.fn(async () => undefined),
      setRemoteDescription: vi.fn(async () => undefined),
      close: vi.fn(),
    };

    vi.stubGlobal(
      "Audio",
      vi.fn(() => ({ autoplay: false, srcObject: null })),
    );
    vi.stubGlobal(
      "RTCPeerConnection",
      vi.fn(() => peerConnection),
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

        if (value === "/api/lessons/start") {
          return Response.json({
            lesson,
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
              lessonId: "lesson-finish-closes-mic",
              connectUrl: "https://api.openai.com/v1/realtime/calls",
            },
          });
        }

        if (value === "/api/lessons/evidence") {
          const body = JSON.parse(String(init?.body)) as {
            evidence: "learner-turn" | "feedback";
          };

          if (body.evidence === "learner-turn") {
            lesson.metrics.learnerTurns += 1;
          } else {
            lesson.metrics.feedbackEvents += 1;
            lesson.state = "feedback";
          }

          return Response.json({ lesson });
        }

        if (value === "/api/lessons/complete") {
          return Response.json({
            lesson: {
              id: "lesson-finish-closes-mic",
              state: "completed",
              startedAt: "2026-05-13T00:00:00.000Z",
              metrics: { learnerTurns: 1, feedbackEvents: 1 },
              completionReason: "completed",
            },
            xp: {
              awarded: true,
              xp: 50,
              reason: "completed",
            },
          });
        }

        return new Response("answer-sdp");
      }),
    );

    render(<LessonClient />);

    fireEvent.click(screen.getByRole("button", { name: "Empezar clase" }));
    await waitFor(() => expect(screen.getByText("voz lista")).toBeVisible());

    act(() => {
      dataChannel.onmessage?.({
        data: JSON.stringify({
          type: "conversation.item.input_audio_transcription.completed",
          transcript: "I am practicing English today.",
        }),
      } as MessageEvent);
    });
    act(() => {
      dataChannel.onmessage?.({
        data: JSON.stringify({
          type: "response.output_audio_transcript.done",
          transcript: "Good job.",
        }),
      } as MessageEvent);
    });
    await waitFor(() =>
      expect(screen.getByText("Prácticas: 1 · Feedback: 1")).toBeVisible(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Finalizar clase" }));
    await waitFor(() =>
      expect(screen.getByText("sesión cerrada")).toBeVisible(),
    );

    expect(track.stop).toHaveBeenCalled();
    expect(dataChannel.close).toHaveBeenCalled();
    expect(peerConnection.close).toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Practicar otra vez" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Ya practiqué la frase" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Ver corrección sugerida" }),
    ).toBeDisabled();
  });

  it("closes the previous realtime connection before starting another one", async () => {
    const firstTrack = { stop: vi.fn() };
    const secondTrack = { stop: vi.fn() };
    const streams = [
      { getTracks: () => [firstTrack] },
      { getTracks: () => [secondTrack] },
    ] as unknown as MediaStream[];
    const peerConnections: Array<{ close: ReturnType<typeof vi.fn> }> = [];
    const dataChannels: Array<{
      close: ReturnType<typeof vi.fn>;
      onmessage: ((event: MessageEvent) => void) | null;
    }> = [];

    vi.stubGlobal(
      "Audio",
      vi.fn(() => ({ autoplay: false, srcObject: null })),
    );
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
              id: `lesson-voz lista-${startCount}`,
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
              lessonId: "lesson-voz lista",
              connectUrl: "https://api.openai.com/v1/realtime/calls",
            },
          });
        }

        return new Response("answer-sdp");
      }),
    );

    render(<LessonClient />);

    fireEvent.click(screen.getByRole("button", { name: "Empezar clase" }));
    await waitFor(() => expect(screen.getByText("voz lista")).toBeVisible());

    fireEvent.click(screen.getByRole("button", { name: "Empezar clase" }));
    await waitFor(() => expect(firstTrack.stop).toHaveBeenCalled());

    expect(dataChannels[0]?.close).toHaveBeenCalled();
    expect(peerConnections[0]?.close).toHaveBeenCalled();
  });
});
