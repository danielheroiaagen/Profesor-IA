import { useRef, useState } from "react";

import type { LiveAvatarSession as LiveAvatarSessionType } from "@heygen/liveavatar-web-sdk";

export type LiveAvatarStatus = "idle" | "starting" | "ready" | "unavailable";

/**
 * Manages the HeyGen LiveAvatar session lifecycle.
 *
 * Design constraints:
 * - liveAvatarVideoRef is owned HERE and exposed so the parent can pass it
 *   as a callback ref to AvatarStage — preserving the exact identity semantics
 *   of the original code.
 * - stopSession / startSession are stable across renders because they close
 *   over refs, not state. No useCallback needed (React Compiler handles it,
 *   and even without the compiler the functions are safe because they only
 *   read/write refs and call setState).
 * - Teardown (stopSession) is called by the parent both imperatively (on
 *   completeLesson / new lesson start) and in the unmount cleanup useEffect
 *   in lesson-client.tsx — exactly matching the original behavior.
 * - The unmount cleanup is deliberately kept in lesson-client.tsx so the
 *   hook itself has NO useEffect, avoiding the eslint exhaustive-deps problem
 *   Google's version had with capturing stopSession in a closure.
 */
export function useLiveAvatar(onConnectionDegraded: () => void) {
  const [liveAvatarStatus, setLiveAvatarStatus] =
    useState<LiveAvatarStatus>("idle");
  const liveAvatarRef = useRef<LiveAvatarSessionType | null>(null);
  const liveAvatarVideoRef = useRef<HTMLVideoElement | null>(null);

  async function startSession(
    nextAvatar: {
      mode: "live" | "generated" | "static" | "voice-only";
      available: boolean;
      avatarId?: string;
    },
    lessonId: string,
    lessonAccessToken: string,
  ) {
    if (
      nextAvatar.mode !== "live" ||
      !nextAvatar.available ||
      !nextAvatar.avatarId
    ) {
      return;
    }

    await stopSession({ resetState: false });
    setLiveAvatarStatus("starting");

    try {
      const response = await postJsonForAvatar<{
        liveAvatar: {
          provider: "liveavatar";
          mode: "live";
          avatarId: string;
          sessionId: string;
          sessionToken: string;
        };
      }>("/api/avatar/live-session", { lessonId, lessonAccessToken });

      const { LiveAvatarSession, SessionEvent } =
        await import("@heygen/liveavatar-web-sdk");
      const session = new LiveAvatarSession(response.liveAvatar.sessionToken, {
        voiceChat: false,
      });

      liveAvatarRef.current = session;
      session.on(SessionEvent.SESSION_STREAM_READY, () => {
        if (liveAvatarRef.current !== session) return;

        if (liveAvatarVideoRef.current) {
          muteLiveAvatarVideo(liveAvatarVideoRef.current);
          session.attach(liveAvatarVideoRef.current);
          muteLiveAvatarVideo(liveAvatarVideoRef.current);
        }
        setLiveAvatarStatus("ready");
      });
      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        if (liveAvatarRef.current !== session) return;
        setLiveAvatarStatus("unavailable");
        onConnectionDegraded();
      });

      await session.start();
    } catch {
      liveAvatarRef.current = null;
      setLiveAvatarStatus("unavailable");
      onConnectionDegraded();
    }
  }

  async function stopSession(
    options: { resetState?: boolean } = { resetState: true },
  ) {
    const session = liveAvatarRef.current;
    liveAvatarRef.current = null;

    if (liveAvatarVideoRef.current) {
      liveAvatarVideoRef.current.srcObject = null;
    }

    if (options.resetState) setLiveAvatarStatus("idle");
    await session?.stop().catch(() => undefined);
  }

  function rememberLiveAvatarVideo(video: HTMLVideoElement | null) {
    liveAvatarVideoRef.current = video;
    if (video) muteLiveAvatarVideo(video);
  }

  return {
    liveAvatarStatus,
    setLiveAvatarStatus,
    liveAvatarRef,
    liveAvatarVideoRef,
    startSession,
    stopSession,
    rememberLiveAvatarVideo,
  };
}

function muteLiveAvatarVideo(video: HTMLVideoElement) {
  video.defaultMuted = true;
  video.muted = true;
  video.volume = 0;
}

async function postJsonForAvatar<T>(url: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8_000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("La solicitud tardó demasiado. Reintentá la clase.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }

  const data = (await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(data.error?.message ?? "Request failed safely.");
  }
  return data;
}
