"use client";

import { useEffect, useRef, useState } from "react";

type LessonSession = {
  id: string;
  state: string;
  startedAt: string;
};

type AvatarStatus = {
  mode: "live" | "generated" | "static" | "voice-only";
  available: boolean;
  reason?: string;
};

type RealtimeSession = {
  clientSecret: string;
  model: string;
  expiresAt: string;
  lessonId: string;
  connectUrl: string;
};

type XPResult = {
  awarded: boolean;
  xp: number;
  reason: string;
};

type LessonStatus = "idle" | "starting" | "active" | "feedback" | "completed" | "failed";

type ConnectionStatus = "not-started" | "requesting-mic" | "connected" | "fallback" | "failed";

type RealtimeConnection = {
  peerConnection: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  stream: MediaStream;
};

export default function LessonClient() {
  const [status, setStatus] = useState<LessonStatus>("idle");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("not-started");
  const [lesson, setLesson] = useState<LessonSession | null>(null);
  const [avatar, setAvatar] = useState<AvatarStatus | null>(null);
  const [realtime, setRealtime] = useState<Omit<RealtimeSession, "clientSecret"> | null>(null);
  const [learnerTurns, setLearnerTurns] = useState(0);
  const [feedbackEvents, setFeedbackEvents] = useState(0);
  const [feedbackSummary, setFeedbackSummary] = useState("Say: I am practicing English today.");
  const [xp, setXp] = useState<XPResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connectionRef = useRef<RealtimeConnection | null>(null);

  useEffect(() => {
    return () => {
      closeRealtimeConnection(connectionRef.current);
    };
  }, []);

  async function startLesson() {
    setStatus("starting");
    setConnectionStatus("requesting-mic");
    setError(null);
    setXp(null);
    setLearnerTurns(0);
    setFeedbackEvents(0);

    try {
      const lessonResponse = await postJson<{ lesson: LessonSession; avatar: AvatarStatus }>(
        "/api/lessons/start",
        {},
      );
      setLesson(lessonResponse.lesson);
      setAvatar(lessonResponse.avatar);

      const realtimeResponse = await postJson<{ realtime: RealtimeSession }>(
        "/api/realtime/session",
        { lessonId: lessonResponse.lesson.id },
      );

      setRealtime({
        model: realtimeResponse.realtime.model,
        expiresAt: realtimeResponse.realtime.expiresAt,
        lessonId: realtimeResponse.realtime.lessonId,
        connectUrl: realtimeResponse.realtime.connectUrl,
      });

      const connection = await connectRealtime(realtimeResponse.realtime, (message) => {
        setFeedbackSummary(message);
        setFeedbackEvents((current) => Math.max(current, 1));
        setStatus("feedback");
      });

      connectionRef.current = connection;
      setConnectionStatus("connected");
      setStatus("active");
    } catch (startError) {
      setConnectionStatus("fallback");
      setStatus("active");
      setError(startError instanceof Error ? startError.message : "Voice setup failed safely.");
    }
  }

  function recordLearnerTurn() {
    setLearnerTurns((current) => current + 1);
    setStatus("active");
  }

  function recordVisibleFeedback() {
    setFeedbackEvents((current) => current + 1);
    setFeedbackSummary("Correction: say 'I am practicing English today' instead of 'I practicing English today'.");
    setStatus("feedback");
  }

  async function completeLesson() {
    if (!lesson) return;

    setError(null);

    try {
      const result = await postJson<{ xp: XPResult; lesson: LessonSession }>(
        "/api/lessons/complete",
        {
          lessonId: lesson.id,
          learnerTurns,
          feedbackEvents,
          canVerify: connectionStatus === "connected" || feedbackEvents > 0,
          interrupted: connectionStatus === "failed",
          startedAt: lesson.startedAt,
        },
      );

      setXp(result.xp);
      setLesson(result.lesson);
      setStatus("completed");
    } catch {
      setError("Completion could not be verified. No unearned XP was awarded.");
      setStatus("failed");
    }
  }

  return (
    <main style={{ margin: "0 auto", maxWidth: "880px", padding: "3rem 1.5rem", fontFamily: "system-ui" }}>
      <p style={{ color: "#2563eb", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
        Realtime voice MVP
      </p>
      <h1>Short English lesson</h1>
      <p>
        The browser receives only an ephemeral Realtime credential. Primary OpenAI and HeyGen keys stay
        server-side. That distinction matters — shortcuts here leak the keys to the street.
      </p>

      <section style={{ border: "1px solid #d1d5db", borderRadius: "1rem", padding: "1rem", marginTop: "1.5rem" }}>
        <h2>Lesson state</h2>
        <dl>
          <dt>Status</dt>
          <dd>{status}</dd>
          <dt>Voice connection</dt>
          <dd>{connectionStatus}</dd>
          <dt>Avatar</dt>
          <dd>{avatar ? `${avatar.mode}${avatar.reason ? ` (${avatar.reason})` : ""}` : "not started"}</dd>
          <dt>Realtime model</dt>
          <dd>{realtime?.model ?? "not minted yet"}</dd>
          <dt>Ephemeral credential expires</dt>
          <dd>{realtime?.expiresAt ?? "not minted yet"}</dd>
        </dl>
      </section>

      {error ? (
        <p role="alert" style={{ background: "#fef2f2", borderRadius: "0.75rem", color: "#991b1b", padding: "1rem" }}>
          {error} You can retry without exposing any secret value.
        </p>
      ) : null}

      <section style={{ display: "grid", gap: "0.75rem", marginTop: "1.5rem" }}>
        <button onClick={startLesson} disabled={status === "starting"}>
          {status === "starting" ? "Starting..." : "Start voice lesson"}
        </button>
        <button onClick={recordLearnerTurn} disabled={!lesson || status === "completed"}>
          I spoke one answer
        </button>
        <button onClick={recordVisibleFeedback} disabled={!lesson || status === "completed"}>
          Show correction feedback
        </button>
        <button onClick={completeLesson} disabled={!lesson || status === "completed"}>
          Complete lesson and calculate XP
        </button>
      </section>

      <section style={{ border: "1px solid #d1d5db", borderRadius: "1rem", padding: "1rem", marginTop: "1.5rem" }}>
        <h2>Visible correction</h2>
        <p>{feedbackSummary}</p>
        <p>
          Learner turns: {learnerTurns} · Feedback events: {feedbackEvents}
        </p>
      </section>

      {xp ? (
        <section style={{ background: xp.awarded ? "#ecfdf5" : "#fffbeb", borderRadius: "1rem", padding: "1rem", marginTop: "1.5rem" }}>
          <h2>{xp.awarded ? `XP awarded: ${xp.xp}` : "No XP awarded"}</h2>
          <p>Reason: {xp.reason}</p>
        </section>
      ) : null}
    </main>
  );
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(data.error?.message ?? "Request failed safely.");
  }

  return data;
}

async function connectRealtime(
  realtime: RealtimeSession,
  onFeedback: (message: string) => void,
): Promise<RealtimeConnection> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone APIs are unavailable in this browser.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const peerConnection = new RTCPeerConnection();
  const dataChannel = peerConnection.createDataChannel("oai-events");

  stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

  peerConnection.ontrack = (event) => {
    const [remoteStream] = event.streams;
    const audio = new Audio();
    audio.autoplay = true;
    audio.srcObject = remoteStream;
  };

  dataChannel.onmessage = (event) => {
    const message = readRealtimeFeedback(event.data);
    if (message) onFeedback(message);
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  const response = await fetch(realtime.connectUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${realtime.clientSecret}`,
      "Content-Type": "application/sdp",
    },
    body: offer.sdp,
  });

  if (!response.ok) {
    closeRealtimeConnection({ peerConnection, dataChannel, stream });
    throw new Error("Realtime connection failed safely. Retry the lesson.");
  }

  await peerConnection.setRemoteDescription({
    type: "answer",
    sdp: await response.text(),
  });

  return { peerConnection, dataChannel, stream };
}

function closeRealtimeConnection(connection: RealtimeConnection | null) {
  connection?.stream.getTracks().forEach((track) => track.stop());
  connection?.dataChannel.close();
  connection?.peerConnection.close();
}

function readRealtimeFeedback(payload: string): string | null {
  try {
    const event = JSON.parse(payload) as { type?: string; text?: string; transcript?: string; response?: { output_text?: string } };
    const text = event.text ?? event.transcript ?? event.response?.output_text;

    if (typeof text === "string" && text.trim()) {
      return text.trim();
    }

    return event.type?.startsWith("response.") ? "Realtime tutor responded. Check the spoken correction." : null;
  } catch {
    return null;
  }
}
