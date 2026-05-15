"use client";

import { useEffect, useRef, useState } from "react";

type LessonSession = {
  id: string;
  state: string;
  startedAt: string;
  metrics: {
    learnerTurns: number;
    feedbackEvents: number;
  };
};

type AvatarStatus = {
  mode: "live" | "generated" | "static" | "voice-only";
  available: boolean;
  reason?: string;
  avatarId?: string;
};

type RealtimeSession = {
  clientSecret: string;
  model: string;
  expiresAt: string;
  lessonId: string;
  connectUrl: string;
};

type LessonEvidence = "learner-turn" | "feedback";

type XPResult = {
  awarded: boolean;
  xp: number;
  reason: string;
};

type LessonStatus =
  | "idle"
  | "starting"
  | "active"
  | "feedback"
  | "completed"
  | "failed";

type ConnectionStatus =
  | "not-started"
  | "requesting-mic"
  | "connected"
  | "fallback"
  | "ended"
  | "failed";

type RealtimeConnection = {
  peerConnection: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  stream: MediaStream;
};

const INITIAL_FEEDBACK_SUMMARY =
  "Objetivo: decir con naturalidad 'I am practicing English today.'";
const REQUIRED_LEARNER_TURNS = 1;
const REQUIRED_FEEDBACK_EVENTS = 1;
const LOCAL_XP_STORAGE_KEY = "profesor-ia.total-xp";

export default function LessonClient() {
  const [status, setStatus] = useState<LessonStatus>("idle");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("not-started");
  const [lesson, setLesson] = useState<LessonSession | null>(null);
  const [avatar, setAvatar] = useState<AvatarStatus | null>(null);
  const [realtime, setRealtime] = useState<Pick<
    RealtimeSession,
    "model" | "lessonId"
  > | null>(null);
  const [learnerTurns, setLearnerTurns] = useState(0);
  const [feedbackEvents, setFeedbackEvents] = useState(0);
  const [feedbackSummary, setFeedbackSummary] = useState(
    INITIAL_FEEDBACK_SUMMARY,
  );
  const [xp, setXp] = useState<XPResult | null>(null);
  const [totalXp, setTotalXp] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const connectionRef = useRef<RealtimeConnection | null>(null);

  useEffect(() => {
    setTotalXp(readSavedTotalXp());

    return () => {
      closeRealtimeConnection(connectionRef.current);
    };
  }, []);

  const hasCompletionEvidence =
    learnerTurns >= REQUIRED_LEARNER_TURNS &&
    feedbackEvents >= REQUIRED_FEEDBACK_EVENTS;
  const canCompleteLesson =
    Boolean(lesson) &&
    status !== "completed" &&
    status !== "failed" &&
    hasCompletionEvidence;

  async function startLesson() {
    replaceRealtimeConnection(null);
    setStatus("starting");
    setConnectionStatus("requesting-mic");
    setError(null);
    setXp(null);
    setLearnerTurns(0);
    setFeedbackEvents(0);
    setFeedbackSummary(INITIAL_FEEDBACK_SUMMARY);

    try {
      const lessonResponse = await postJson<{
        lesson: LessonSession;
        avatar: AvatarStatus;
      }>("/api/lessons/start", {});
      setLesson(lessonResponse.lesson);
      setAvatar(lessonResponse.avatar);

      const realtimeResponse = await postJson<{ realtime: RealtimeSession }>(
        "/api/realtime/session",
        { lessonId: lessonResponse.lesson.id },
      );

      setRealtime({
        model: realtimeResponse.realtime.model,
        lessonId: realtimeResponse.realtime.lessonId,
      });

      const connection = await connectRealtime(
        realtimeResponse.realtime,
        (payload) => {
          void recordRealtimeEvidence(lessonResponse.lesson.id, payload);
        },
      );

      replaceRealtimeConnection(connection);
      setConnectionStatus("connected");
      setStatus("active");
    } catch (startError) {
      setConnectionStatus("fallback");
      setStatus("active");
      setError(
        startError instanceof Error
          ? startError.message
          : "No pudimos preparar el audio de forma segura.",
      );
    }
  }

  async function recordRealtimeEvidence(lessonId: string, payload: string) {
    const signal = readRealtimeSignal(payload);

    if (!signal) return;

    if (signal.feedbackSummary) {
      setFeedbackSummary(signal.feedbackSummary);
      setStatus("feedback");
    }

    if (!signal.evidence) return;

    await recordServerEvidence(lessonId, signal.evidence, { silent: true });
  }

  async function recordServerEvidence(
    lessonId: string,
    evidence: LessonEvidence,
    options: { silent?: boolean } = {},
  ) {
    try {
      const result = await postJson<{ lesson: LessonSession }>(
        "/api/lessons/evidence",
        {
          lessonId,
          evidence,
        },
      );

      syncLessonFromServer(result.lesson);
      return true;
    } catch {
      if (!options.silent) {
        setError(
          "No pudimos registrar evidencia de práctica. No vamos a otorgar XP sin verificarla.",
        );
      }

      return false;
    }
  }

  async function recordLearnerTurn() {
    if (!lesson) return;

    setError(null);
    await recordServerEvidence(lesson.id, "learner-turn");
  }

  async function recordVisibleFeedback() {
    if (!lesson) return;

    setError(null);
    setFeedbackSummary(
      "Corrección: decí 'I am practicing English today' en lugar de 'I practicing English today'.",
    );
    await recordServerEvidence(lesson.id, "feedback");
  }

  async function completeLesson() {
    if (!lesson || !hasCompletionEvidence) return;

    setError(null);

    try {
      const result = await postJson<{ xp: XPResult; lesson: LessonSession }>(
        "/api/lessons/complete",
        {
          lessonId: lesson.id,
        },
      );

      setXp(result.xp);
      syncLessonFromServer(result.lesson);
      setStatus(result.lesson.state === "completed" ? "completed" : "failed");

      if (result.xp.awarded && result.xp.xp > 0) {
        setTotalXp((currentTotal) => {
          const nextTotal = currentTotal + result.xp.xp;
          writeSavedTotalXp(nextTotal);
          return nextTotal;
        });
      }
    } catch {
      setError("No pudimos verificar la práctica. No se otorgó XP sin ganar.");
      setStatus("failed");
    } finally {
      replaceRealtimeConnection(null);
      setConnectionStatus("ended");
    }
  }

  function syncLessonFromServer(nextLesson: LessonSession) {
    setLesson(nextLesson);
    setLearnerTurns(nextLesson.metrics.learnerTurns);
    setFeedbackEvents(nextLesson.metrics.feedbackEvents);
    setStatus(readClientStatus(nextLesson));
  }

  function readClientStatus(nextLesson: LessonSession): LessonStatus {
    if (nextLesson.state === "feedback") return "feedback";
    if (nextLesson.state === "completed") return "completed";
    if (nextLesson.state === "failed") return "failed";

    return "active";
  }

  function replaceRealtimeConnection(
    nextConnection: RealtimeConnection | null,
  ) {
    closeRealtimeConnection(connectionRef.current);
    connectionRef.current = nextConnection;
  }

  return (
    <main
      style={{
        margin: "0 auto",
        maxWidth: "880px",
        padding: "3rem 1.5rem",
        fontFamily: "system-ui",
      }}
    >
      <p
        style={{
          color: "#2563eb",
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        Clase guiada · Speaking A1
      </p>
      <h1>Practicá inglés con una mini clase de voz.</h1>
      <p>
        El navegador recibe solo una credencial efímera de Realtime. Las claves
        principales de OpenAI y HeyGen quedan del lado del servidor.
      </p>

      <section
        style={{
          border: "1px solid #d1d5db",
          borderRadius: "1rem",
          padding: "1rem",
          marginTop: "1.5rem",
        }}
      >
        <h2>Tu clase</h2>
        <dl>
          <dt>Momento</dt>
          <dd>{formatLessonStatus(status)}</dd>
          <dt>Voz</dt>
          <dd>{formatConnectionStatus(connectionStatus)}</dd>
          <dt>Avatar</dt>
          <dd>
            {formatAvatarStatus(avatar)}
            {avatar?.avatarId ? ` · ${avatar.avatarId}` : ""}
          </dd>
          <dt>Sesión protegida</dt>
          <dd>
            {realtime
              ? `${realtime.model} · credencial limitada`
              : "sin emitir"}
          </dd>
          <dt>Progreso</dt>
          <dd>{totalXp} XP guardados</dd>
        </dl>
      </section>

      {error ? (
        <p
          role="alert"
          style={{
            background: "#fef2f2",
            borderRadius: "0.75rem",
            color: "#991b1b",
            padding: "1rem",
          }}
        >
          {error} Podés reintentar sin exponer valores secretos.
        </p>
      ) : null}

      <section style={{ display: "grid", gap: "0.75rem", marginTop: "1.5rem" }}>
        <button onClick={startLesson} disabled={status === "starting"}>
          {status === "starting" ? "Preparando clase..." : "Empezar clase"}
        </button>
        <button
          onClick={recordLearnerTurn}
          disabled={!lesson || status === "completed"}
        >
          Ya practiqué la frase
        </button>
        <button
          onClick={recordVisibleFeedback}
          disabled={!lesson || status === "completed"}
        >
          Ver corrección sugerida
        </button>
        <button onClick={completeLesson} disabled={!canCompleteLesson}>
          {lesson && !hasCompletionEvidence
            ? "Esperando evidencia de voz"
            : "Finalizar clase"}
        </button>
      </section>

      {lesson && !hasCompletionEvidence && status !== "completed" ? (
        <p role="status">
          Para cerrar la clase con XP, esperá a que el servidor registre una
          práctica y una corrección.
        </p>
      ) : null}

      <section
        style={{
          border: "1px solid #d1d5db",
          borderRadius: "1rem",
          padding: "1rem",
          marginTop: "1.5rem",
        }}
      >
        <h2>Corrección visible</h2>
        <p>{feedbackSummary}</p>
        <p>
          Prácticas: {learnerTurns} · Feedback: {feedbackEvents}
        </p>
      </section>

      {xp ? (
        <section
          style={{
            background: xp.awarded ? "#ecfdf5" : "#fffbeb",
            borderRadius: "1rem",
            padding: "1rem",
            marginTop: "1.5rem",
          }}
        >
          <h2>{xp.awarded ? `+${xp.xp} XP ganados` : "Todavía sin XP"}</h2>
          <p>
            {xp.awarded
              ? "Progreso registrado por práctica y feedback."
              : `Motivo: ${xp.reason}. Reintentá con una respuesta hablada.`}
          </p>
          {xp.awarded ? <p>Total guardado: {totalXp} XP.</p> : null}
        </section>
      ) : null}
    </main>
  );
}

function formatLessonStatus(status: LessonStatus) {
  const labels: Record<LessonStatus, string> = {
    idle: "lista para empezar",
    starting: "preparando audio",
    active: "clase activa",
    feedback: "feedback listo",
    completed: "clase completada",
    failed: "reintento recomendado",
  };
  return labels[status];
}

function formatConnectionStatus(status: ConnectionStatus) {
  const labels: Record<ConnectionStatus, string> = {
    "not-started": "pendiente",
    "requesting-mic": "pidiendo micrófono",
    connected: "voz lista",
    fallback: "modo voz seguro",
    ended: "sesión cerrada",
    failed: "no conectada",
  };
  return labels[status];
}

function formatAvatarStatus(avatar: AvatarStatus | null) {
  if (!avatar) return "tutor listo para empezar";
  if (avatar.available) return "tutor visual disponible";
  if (avatar.mode === "voice-only") return "tutor en modo voz";
  return "tutor con presencia estática";
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
  onRealtimeEvent: (payload: string) => void,
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
    if (typeof event.data === "string") {
      onRealtimeEvent(event.data);
    }
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

function readSavedTotalXp() {
  if (typeof window === "undefined") return 0;

  try {
    const value = Number.parseInt(
      window.localStorage.getItem(LOCAL_XP_STORAGE_KEY) ?? "0",
      10,
    );

    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function writeSavedTotalXp(totalXp: number) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(LOCAL_XP_STORAGE_KEY, String(totalXp));
  } catch {
    // Local progress is an enhancement; verified XP still comes from the server.
  }
}

function readRealtimeSignal(payload: string): {
  evidence?: LessonEvidence;
  feedbackSummary?: string;
} | null {
  try {
    const event = JSON.parse(payload) as {
      type?: string;
      text?: string;
      transcript?: string;
      response?: { output_text?: string };
    };
    const text = event.text ?? event.transcript ?? event.response?.output_text;
    const trimmedText =
      typeof text === "string" && text.trim() ? text.trim() : null;

    if (
      event.type === "conversation.item.input_audio_transcription.completed" &&
      trimmedText
    ) {
      return { evidence: "learner-turn" };
    }

    if (isTutorFeedbackEvent(event.type) && trimmedText) {
      return {
        evidence: "feedback",
        feedbackSummary: trimmedText,
      };
    }

    return null;
  } catch {
    return null;
  }
}

function isTutorFeedbackEvent(type: string | undefined) {
  return (
    type === "response.output_audio_transcript.done" ||
    type === "response.output_text.done"
  );
}
