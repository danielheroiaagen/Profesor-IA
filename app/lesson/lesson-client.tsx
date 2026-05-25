"use client";

import "./lesson.css";

import type { LiveAvatarSession as LiveAvatarSessionType } from "@heygen/liveavatar-web-sdk";
import { useEffect, useRef, useState } from "react";

import {
  reduceLessonAvatarConnectionDegraded,
  reduceLessonAvatarManualEvent,
  reduceLessonAvatarRealtimePayload,
  startLessonAvatarRuntime,
} from "@/integrations/avatar/avatar-lesson-runtime";
import {
  buildRaioRealtimeOpeningInstructions,
  DEFAULT_RAIO_SPEAKING_LESSON,
  type RaioSpeakingLesson,
} from "@/domain/raio-curriculum";
import type {
  AvatarRuntimeEventInput,
  AvatarRuntimeState,
  AvatarRuntimeStatus,
} from "@/integrations/avatar/avatar-runtime";

import { AvatarStage } from "./components/AvatarStage";
import { LessonControls } from "./components/LessonControls";
import { LessonHeader } from "./components/LessonHeader";
import { ProgressPanel } from "./components/ProgressPanel";
import { SessionStatusPanel } from "./components/SessionStatusPanel";

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

type AvatarLiveSession = {
  provider: "liveavatar";
  mode: "live";
  avatarId: string;
  sessionId: string;
  sessionToken: string;
};

type LessonStartResponse = {
  lesson: LessonSession;
  lessonPlan?: RaioSpeakingLesson;
  lessonAccessToken: string;
  avatar: AvatarStatus;
};

type LessonEvidence = "learner-turn" | "feedback";

type XPResult = {
  awarded: boolean;
  xp: number;
  reason: string;
};

type ProgressSummary = {
  totalXp: number;
  completedLessons: number;
  lastAwardedAt: string | null;
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

type LiveAvatarStatus = "idle" | "starting" | "ready" | "unavailable";

type RealtimeConnection = {
  peerConnection: RTCPeerConnection;
  dataChannel: RTCDataChannel;
  stream: MediaStream;
  audioElement: HTMLAudioElement;
};

const INITIAL_FEEDBACK_SUMMARY = formatLessonObjective(
  DEFAULT_RAIO_SPEAKING_LESSON,
);
const REQUIRED_LEARNER_TURNS = 1;
const REQUIRED_FEEDBACK_EVENTS = 1;
const DEFAULT_HEYGEN_AVATAR_ID = "e29e792a-41e7-4df0-84a8-349e099fb50f";
const DEFAULT_OPENAI_REALTIME_MODEL = "gpt-realtime-2";
const API_REQUEST_TIMEOUT_MS = 8_000;
const REALTIME_CONNECT_TIMEOUT_MS = 25_000;
const STITCH_TUTOR_POSTER_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDdzHwAwTAvUVLRwMGfxmkra0pwSCyt_9MBzo5amWwIOuiJT0YWdMgIfb-dxqXs4qCM4XJbck5TKVEd1jb4fTgALsRsy1fguXSxALC0Z_hr3me3Tvr42VYUF7f9e09fiQagGE6Qjrigk60gkak4EYTVcFN5bm6sgX55vfZD3-6dDKWbpTNDPPDxEN4cJFgwl8BDNDZgUEN1SH-uP_TWcxWiAACNltXBJF036PQzam6cpb75NIg-I2eH0ttoYWNUkRUix26Iy55uN-0g";
const TUTOR_STATE_LABELS = [
  "Ready",
  "Conectando",
  "Escuchando",
  "Hablando",
  "Corrigiendo",
  "Completada",
  "Modo voz seguro",
  "Reintento seguro",
] as const;

export default function LessonClient() {
  const [status, setStatus] = useState<LessonStatus>("idle");
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("not-started");
  const [lesson, setLesson] = useState<LessonSession | null>(null);
  const [lessonPlan, setLessonPlan] = useState<RaioSpeakingLesson>(
    DEFAULT_RAIO_SPEAKING_LESSON,
  );
  const [avatar, setAvatar] = useState<AvatarStatus | null>(null);
  const [liveAvatarStatus, setLiveAvatarStatus] =
    useState<LiveAvatarStatus>("idle");
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
  const [avatarRuntime, setAvatarRuntime] = useState<AvatarRuntimeState | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const connectionRef = useRef<RealtimeConnection | null>(null);
  const avatarRuntimeRef = useRef<AvatarRuntimeState | null>(null);
  const lessonAccessTokenRef = useRef<string | null>(null);
  const progressVersionRef = useRef(0);
  const liveAvatarRef = useRef<LiveAvatarSessionType | null>(null);
  const liveAvatarVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let mounted = true;
    const hydrationVersion = progressVersionRef.current;

    void hydrateProgress((progress) => {
      if (mounted && progressVersionRef.current === hydrationVersion) {
        setTotalXp(progress.totalXp);
      }
    });

    return () => {
      mounted = false;
      closeRealtimeConnection(connectionRef.current);
      void stopLiveAvatarSession({ resetState: false });
    };
  }, []);

  const hasCompletionEvidence =
    learnerTurns >= REQUIRED_LEARNER_TURNS &&
    feedbackEvents >= REQUIRED_FEEDBACK_EVENTS;
  const lessonEnded = status === "completed" || status === "failed";
  const lessonRunning = status === "active" || status === "feedback";
  const startControlsDisabled = status === "starting" || lessonRunning;
  const canCompleteLesson =
    Boolean(lesson) && !lessonEnded && hasCompletionEvidence;
  const practiceControlsDisabled = !lesson || lessonEnded;

  async function startLesson() {
    replaceRealtimeConnection(null);
    await stopLiveAvatarSession({ resetState: false });
    let lessonStarted = false;

    setStatus("starting");
    setConnectionStatus("requesting-mic");
    lessonAccessTokenRef.current = null;
    setLesson(null);
    setLessonPlan(DEFAULT_RAIO_SPEAKING_LESSON);
    setAvatar(null);
    setLiveAvatarStatus("idle");
    replaceAvatarRuntime(null);
    setRealtime(null);
    setError(null);
    setXp(null);
    setLearnerTurns(0);
    setFeedbackEvents(0);
    setFeedbackSummary(INITIAL_FEEDBACK_SUMMARY);

    try {
      const lessonResponse = await postJson<LessonStartResponse>(
        "/api/lessons/start",
        {},
      );
      lessonStarted = true;
      const activeLessonPlan =
        lessonResponse.lessonPlan ?? DEFAULT_RAIO_SPEAKING_LESSON;
      lessonAccessTokenRef.current = lessonResponse.lessonAccessToken;
      setLesson(lessonResponse.lesson);
      setLessonPlan(activeLessonPlan);
      setFeedbackSummary(formatLessonObjective(activeLessonPlan));
      setAvatar(lessonResponse.avatar);
      replaceAvatarRuntime(
        startLessonAvatarRuntime({
          attemptId: lessonResponse.lesson.id,
          lessonPlanSlug: activeLessonPlan.slug,
        }),
      );
      void startLiveAvatarSession(
        lessonResponse.avatar,
        lessonResponse.lesson.id,
        lessonResponse.lessonAccessToken,
      );

      const realtimeResponse = await postJson<{ realtime: RealtimeSession }>(
        "/api/realtime/session",
        {
          lessonId: lessonResponse.lesson.id,
          lessonAccessToken: lessonResponse.lessonAccessToken,
        },
      );

      setRealtime({
        model: realtimeResponse.realtime.model,
        lessonId: realtimeResponse.realtime.lessonId,
      });

      const connection = await connectRealtime(
        realtimeResponse.realtime,
        activeLessonPlan,
        (payload) => {
          void recordRealtimeEvidence(lessonResponse.lesson.id, payload);
        },
      );

      replaceRealtimeConnection(connection);
      setConnectionStatus("connected");
      setStatus("active");
    } catch (startError) {
      if (lessonStarted) dispatchAvatarConnectionDegraded();
      setConnectionStatus(lessonStarted ? "fallback" : "failed");
      setStatus(lessonStarted ? "active" : "failed");
      setError(
        startError instanceof Error
          ? startError.message
          : "No pudimos preparar el audio de forma segura.",
      );
    }
  }

  async function startLiveAvatarSession(
    nextAvatar: AvatarStatus,
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

    await stopLiveAvatarSession({ resetState: false });
    setLiveAvatarStatus("starting");

    try {
      const response = await postJson<{ liveAvatar: AvatarLiveSession }>(
        "/api/avatar/live-session",
        { lessonId, lessonAccessToken },
      );
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
        dispatchAvatarConnectionDegraded();
      });

      await session.start();
    } catch {
      liveAvatarRef.current = null;
      setLiveAvatarStatus("unavailable");
      dispatchAvatarConnectionDegraded();
    }
  }

  async function stopLiveAvatarSession(
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

  async function recordRealtimeEvidence(lessonId: string, payload: string) {
    const runtime = avatarRuntimeRef.current;
    const result = runtime
      ? reduceLessonAvatarRealtimePayload(runtime, payload)
      : null;

    if (result) replaceAvatarRuntime(result.state);

    const signal = result?.signal;

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
          lessonAccessToken: lessonAccessTokenRef.current,
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
    dispatchAvatarRuntimeEvent({ type: "learner.speech_completed" });
    await recordServerEvidence(lesson.id, "learner-turn");
  }

  async function recordVisibleFeedback() {
    if (!lesson) return;

    const visibleFeedback = lessonPlan.visibleFeedback;

    setError(null);
    setFeedbackSummary(visibleFeedback);
    dispatchAvatarRuntimeEvent({
      type: "feedback.detected",
      tutorText: visibleFeedback,
      feedbackTone: "correction",
    });
    await recordServerEvidence(lesson.id, "feedback");
  }

  async function completeLesson() {
    if (!lesson || !hasCompletionEvidence) return;

    setError(null);

    try {
      const result = await postJson<{
        xp: XPResult;
        lesson: LessonSession;
        progress: ProgressSummary;
      }>("/api/lessons/complete", {
        lessonId: lesson.id,
        lessonAccessToken: lessonAccessTokenRef.current,
      });

      setXp(result.xp);
      progressVersionRef.current += 1;
      setTotalXp(result.progress.totalXp);
      syncLessonFromServer(result.lesson);
      setStatus(result.lesson.state === "completed" ? "completed" : "failed");
      if (result.lesson.state === "completed") {
        dispatchAvatarRuntimeEvent({ type: "lesson.completed" });
      }
    } catch {
      setError("No pudimos verificar la práctica. No se otorgó XP sin ganar.");
      setStatus("failed");
    } finally {
      replaceRealtimeConnection(null);
      void stopLiveAvatarSession();
      setConnectionStatus("ended");
    }
  }

  async function hydrateProgress(
    onProgress: (progress: ProgressSummary) => void,
  ) {
    try {
      const result = await getJson<{ progress: unknown }>("/api/progress");
      const progress = readProgressSummary(result.progress);

      if (progress) onProgress(progress);
    } catch {
      // Progress hydration should never block opening a voice lesson.
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

  function replaceAvatarRuntime(nextRuntime: AvatarRuntimeState | null) {
    avatarRuntimeRef.current = nextRuntime;
    setAvatarRuntime(nextRuntime);
  }

  function dispatchAvatarRuntimeEvent(event: AvatarRuntimeEventInput) {
    const runtime = avatarRuntimeRef.current;
    if (!runtime) return;

    replaceAvatarRuntime(reduceLessonAvatarManualEvent(runtime, event));
  }

  function dispatchAvatarConnectionDegraded() {
    const runtime = avatarRuntimeRef.current;
    if (!runtime) return;

    replaceAvatarRuntime(reduceLessonAvatarConnectionDegraded(runtime));
  }

  function rememberLiveAvatarVideo(video: HTMLVideoElement | null) {
    liveAvatarVideoRef.current = video;
    if (video) muteLiveAvatarVideo(video);
  }

  const lessonStatusLabel = formatLessonStatus(status);
  const voiceStatusLabel = formatConnectionStatus(connectionStatus);
  const avatarRuntimeStatus = avatarRuntime?.status ?? null;
  const avatarStatusLabel = formatAvatarStatus(
    avatar,
    liveAvatarStatus,
    avatarRuntimeStatus,
  );
  const stage = readTutorStage(
    status,
    connectionStatus,
    avatar,
    liveAvatarStatus,
    avatarRuntimeStatus,
  );
  const protectedSessionLabel = realtime
    ? `${realtime.model} · credencial limitada`
    : "sin emitir";
  const completionHint = !lesson
    ? "Empezá la clase para desbloquear práctica, corrección y cierre."
    : hasCompletionEvidence
      ? "Ya hay práctica y feedback: podés cerrar la clase."
      : "Para cerrar la clase con XP, esperá a que el servidor registre una práctica y una corrección.";

  // Derive a single current-status chip from stage.stateLabel
  const currentStateIcon = readTutorStateIcon(stage.stateLabel);

  return (
    <main className="classroomShell">
      <LessonHeader totalXp={totalXp} />

      <section className="classroomHero" aria-labelledby="lesson-title">
        <div className="lessonStageColumn">

          {/* SIDE-BY-SIDE HERO: avatar left, phrase+CTA+status right */}
          <div className="lessonHero">

            {/* LEFT column: avatar — full height, cinematic */}
            <AvatarStage
              stage={stage}
              rememberLiveAvatarVideo={rememberLiveAvatarVideo}
              onVideoVolumeChange={(event) =>
                muteLiveAvatarVideo(event.currentTarget)
              }
            />

            {/* RIGHT column: phrase, CTA, status chip, practice controls */}
            <LessonControls
              lessonPlan={lessonPlan}
              status={status}
              lesson={lesson}
              startControlsDisabled={startControlsDisabled}
              practiceControlsDisabled={practiceControlsDisabled}
              canCompleteLesson={canCompleteLesson}
              hasCompletionEvidence={hasCompletionEvidence}
              completionHint={completionHint}
              currentStateIcon={currentStateIcon}
              stage={stage}
              onStartLesson={startLesson}
              onRecordLearnerTurn={recordLearnerTurn}
              onRecordVisibleFeedback={recordVisibleFeedback}
              onCompleteLesson={completeLesson}
            />
          </div>{/* /lessonHero */}

          {/* State machine data - hidden visually but kept for structural parity */}
          <dl className="stateChipRow--hidden" aria-hidden="true">
            {TUTOR_STATE_LABELS.map((label) => (
              <span
                className={
                  stage.stateLabel === label ? "stateChip active" : "stateChip"
                }
                key={label}
              >
                <span aria-hidden="true">{readTutorStateIcon(label)}</span>
                {label}
              </span>
            ))}
          </dl>
        </div>

        <aside className="lessonHud" aria-label="Panel de progreso de sesión">
          <ProgressPanel
            xp={xp}
            totalXp={totalXp}
            learnerTurns={learnerTurns}
            feedbackEvents={feedbackEvents}
            feedbackSummary={feedbackSummary}
            lessonPlan={lessonPlan}
          />
          <SessionStatusPanel
            lessonStatusLabel={lessonStatusLabel}
            voiceStatusLabel={voiceStatusLabel}
            avatarStatusLabel={avatarStatusLabel}
            avatar={avatar}
            avatarRuntime={avatarRuntime}
            protectedSessionLabel={protectedSessionLabel}
            realtimeModel={stage.realtimeModel}
          />
          <section className="tipCard" aria-labelledby="teacher-tip-title">
            <span className="tipIcon" aria-hidden="true">
              ?
            </span>
            <h2 id="teacher-tip-title">Tip del Profesor</h2>
            <p>
              RAIO prioriza respuesta oral rápida: el tutor te guía en español,
              vos respondés en inglés y recibís corrección breve en español.
            </p>
          </section>
        </aside>
      </section>

      {error ? (
        <p role="alert" className="alertCard">
          {error} Podés reintentar sin exponer valores secretos.
        </p>
      ) : null}

      <section
        id="feedback-panel"
        className="feedbackGrid"
        aria-label="Feedback de clase"
      >
        <article className="feedbackCard">
          <p className="eyebrow">Feedback en vivo</p>
          <h2>Corrección visible</h2>
          <p>{feedbackSummary}</p>
          <p className="evidenceLine">
            Prácticas: {learnerTurns} · Feedback: {feedbackEvents}
          </p>
        </article>

        {xp ? (
          <article
            className={xp.awarded ? "rewardCard success" : "rewardCard warning"}
          >
            <h2>{xp.awarded ? `+${xp.xp} XP ganados` : "Todavía sin XP"}</h2>
            <p>
              {xp.awarded
                ? "Progreso registrado por práctica y feedback."
                : `Motivo: ${xp.reason}. Reintentá con una respuesta hablada.`}
            </p>
            {xp.awarded ? <p>Total guardado: {totalXp} XP.</p> : null}
          </article>
        ) : (
          <article className="rewardCard">
            <h2>Recompensa de sesión</h2>
            <p>Tu progreso se guarda cuando practicás y recibís feedback.</p>
          </article>
        )}
      </section>
    </main>
  );
}

type TutorStateLabel = (typeof TUTOR_STATE_LABELS)[number];

type TutorMotionCue =
  | "idle"
  | "connecting"
  | "listening"
  | "speaking"
  | "correcting"
  | "fallback"
  | "completed";

type TutorStageViewModel = {
  title: string;
  stateLabel: TutorStateLabel;
  stateDescription: string;
  motionCue: TutorMotionCue;
  isLiveAvatar: boolean;
  avatarId: typeof DEFAULT_HEYGEN_AVATAR_ID;
  realtimeModel: typeof DEFAULT_OPENAI_REALTIME_MODEL;
};

function readTutorStage(
  status: LessonStatus,
  connectionStatus: ConnectionStatus,
  avatar: AvatarStatus | null,
  liveAvatarStatus: LiveAvatarStatus,
  avatarRuntimeStatus: AvatarRuntimeStatus | null,
): TutorStageViewModel {
  const isLiveAvatar = liveAvatarStatus === "ready";

  if (status === "completed") {
    return withTutorIdentity({
      title: "Clase completada con evidencia",
      stateLabel: "Completada",
      stateDescription:
        "Clase completada. Tu progreso quedó registrado con evidencia de práctica.",
      motionCue: "completed",
      isLiveAvatar,
    });
  }

  if (status === "failed" || connectionStatus === "failed") {
    return withTutorIdentity({
      title: "Reintento seguro",
      stateLabel: "Reintento seguro",
      stateDescription:
        "No se pudo preparar la clase. Reintentá sin exponer credenciales.",
      motionCue: "fallback",
      isLiveAvatar: false,
    });
  }

  if (status === "feedback") {
    return withTutorIdentity({
      title: "Corrección de pronunciación",
      stateLabel: "Corrigiendo",
      stateDescription:
        "Tu profesor está corrigiendo la frase para que suene natural.",
      motionCue: "correcting",
      isLiveAvatar,
    });
  }

  if (connectionStatus === "fallback" || avatar?.mode === "voice-only") {
    return withTutorIdentity({
      title: "Tutoría premium en modo voz",
      stateLabel: "Modo voz seguro",
      stateDescription:
        "El avatar no bloquea la clase: seguimos con tutoría por voz segura.",
      motionCue: "fallback",
      isLiveAvatar: false,
    });
  }

  if (connectionStatus === "requesting-mic" || status === "starting") {
    return withTutorIdentity({
      title: "Preparando aula privada",
      stateLabel: "Conectando",
      stateDescription:
        avatar?.available === true && avatar.mode === "live"
          ? "Preparando micrófono, WebRTC, Realtime y sesión live del avatar."
          : "Preparando micrófono, WebRTC y sesión protegida para empezar.",
      motionCue: "connecting",
      isLiveAvatar,
    });
  }

  if (connectionStatus === "connected" || status === "active") {
    const runtimeStage = readRuntimeTutorStage(
      avatarRuntimeStatus,
      isLiveAvatar,
    );
    if (runtimeStage) return runtimeStage;

    return withTutorIdentity({
      title: isLiveAvatar
        ? "Avatar visual listo para tu clase"
        : "Profesor IA escuchando por voz",
      stateLabel: "Escuchando",
      stateDescription:
        "Tu profesor está listo: practicá la frase en voz alta.",
      motionCue: "listening",
      isLiveAvatar,
    });
  }

  return withTutorIdentity({
    title: "Avatar visual listo para tu clase",
    stateLabel: "Ready",
    stateDescription:
      "Tu profesor IA está listo para abrir una clase de speaking.",
    motionCue: "idle",
    isLiveAvatar: false,
  });
}

function readRuntimeTutorStage(
  status: AvatarRuntimeStatus | null,
  isLiveAvatar: boolean,
): TutorStageViewModel | null {
  switch (status) {
    case "listening":
      return withTutorIdentity({
        title: "Profesor IA escuchando en vivo",
        stateLabel: "Escuchando",
        stateDescription: "Tu profesor está atento a tu voz en tiempo real.",
        motionCue: "listening",
        isLiveAvatar,
      });
    case "thinking":
      return withTutorIdentity({
        title: "Pensando la respuesta",
        stateLabel: "Corrigiendo",
        stateDescription:
          "Tu profesor está procesando tu frase antes de responder.",
        motionCue: "correcting",
        isLiveAvatar,
      });
    case "speaking":
      return withTutorIdentity({
        title: "Profesor IA respondiendo",
        stateLabel: "Hablando",
        stateDescription:
          "Tu profesor está hablando con texto aprobado por Realtime.",
        motionCue: "speaking",
        isLiveAvatar,
      });
    case "feedback":
      return withTutorIdentity({
        title: "Corrección de pronunciación",
        stateLabel: "Corrigiendo",
        stateDescription:
          "Tu profesor está corrigiendo la frase para que suene natural.",
        motionCue: "correcting",
        isLiveAvatar,
      });
    case "celebrating":
      return withTutorIdentity({
        title: "Clase completada con evidencia",
        stateLabel: "Completada",
        stateDescription:
          "Clase completada. Tu progreso quedó registrado con evidencia de práctica.",
        motionCue: "completed",
        isLiveAvatar,
      });
    case "fallback":
      return withTutorIdentity({
        title: "Tutoría premium en modo voz",
        stateLabel: "Modo voz seguro",
        stateDescription:
          "El avatar no bloquea la clase: seguimos con tutoría por voz segura.",
        motionCue: "fallback",
        isLiveAvatar: false,
      });
    case "idle":
    case null:
      return null;
  }
}

function withTutorIdentity(
  stage: Omit<TutorStageViewModel, "avatarId" | "realtimeModel">,
): TutorStageViewModel {
  return {
    ...stage,
    avatarId: DEFAULT_HEYGEN_AVATAR_ID,
    realtimeModel: DEFAULT_OPENAI_REALTIME_MODEL,
  };
}

function readTutorStateIcon(label: TutorStateLabel) {
  const icons: Record<TutorStateLabel, string> = {
    Ready: "✓",
    Conectando: "↻",
    Escuchando: "▮",
    Hablando: "◍",
    Corrigiendo: "✦",
    Completada: "★",
    "Modo voz seguro": "◇",
    "Reintento seguro": "!",
  };

  return icons[label];
}

function formatLessonObjective(lessonPlan: RaioSpeakingLesson) {
  return `Objetivo RAIO: ${lessonPlan.spanishInstruction} Respondé en inglés: "${lessonPlan.targetEnglish}".`;
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

function formatAvatarStatus(
  avatar: AvatarStatus | null,
  liveAvatarStatus: LiveAvatarStatus,
  avatarRuntimeStatus: AvatarRuntimeStatus | null,
) {
  if (!avatar) return "tutor listo para empezar";
  if (avatar.mode === "voice-only") return "tutor en modo voz";
  if (avatarRuntimeStatus && avatarRuntimeStatus !== "idle") {
    return formatAvatarRuntimeStatus(avatarRuntimeStatus);
  }
  if (liveAvatarStatus === "ready") return "avatar live conectado";
  if (liveAvatarStatus === "starting") return "avatar live iniciando";
  if (liveAvatarStatus === "unavailable") return "avatar live no disponible";
  if (avatar.available) return "tutor visual disponible";
  return "tutor con presencia estática";
}

function formatAvatarRuntimeStatus(status: AvatarRuntimeStatus) {
  const labels: Record<AvatarRuntimeStatus, string> = {
    idle: "avatar preparado",
    listening: "avatar escuchando en vivo",
    thinking: "avatar pensando respuesta",
    speaking: "tutor hablando; avatar reacciona",
    feedback: "tutor corrigiendo; avatar reacciona",
    celebrating: "avatar celebrando progreso",
    fallback: "avatar en modo voz seguro",
  };

  return labels[status];
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return readJsonResponse<T>(response);
}

async function getJson<T>(url: string): Promise<T> {
  return readJsonResponse<T>(await fetchWithTimeout(url));
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(data.error?.message ?? "Request failed safely.");
  }

  return data;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    API_REQUEST_TIMEOUT_MS,
  );

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("La solicitud tardó demasiado. Reintentá la clase.");
    }

    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function connectRealtime(
  realtime: RealtimeSession,
  lessonPlan: RaioSpeakingLesson,
  onRealtimeEvent: (payload: string) => void,
): Promise<RealtimeConnection> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone APIs are unavailable in this browser.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const cleanupTarget: Partial<RealtimeConnection> = { stream };

  try {
    const peerConnection = new RTCPeerConnection();
    cleanupTarget.peerConnection = peerConnection;

    const dataChannel = peerConnection.createDataChannel("oai-events");
    cleanupTarget.dataChannel = dataChannel;
    dataChannel.onopen = () => {
      sendRealtimeTutorResponse(
        dataChannel,
        buildRaioRealtimeOpeningInstructions(lessonPlan),
      );
    };

    const audioElement = new Audio();
    audioElement.autoplay = true;
    cleanupTarget.audioElement = audioElement;

    stream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, stream));

    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      audioElement.srcObject = remoteStream;
      void audioElement.play?.().catch(() => undefined);
    };

    dataChannel.onmessage = (event) => {
      if (typeof event.data === "string") {
        onRealtimeEvent(event.data);
      }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      REALTIME_CONNECT_TIMEOUT_MS,
    );

    let response: Response;

    try {
      response = await fetch(realtime.connectUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${realtime.clientSecret}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(
          "Realtime tardó demasiado en responder. Activamos modo voz seguro.",
        );
      }

      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }

    if (!response.ok) {
      throw new Error("Realtime connection failed safely. Retry the lesson.");
    }

    await peerConnection.setRemoteDescription({
      type: "answer",
      sdp: await response.text(),
    });

    return { peerConnection, dataChannel, stream, audioElement };
  } catch (error) {
    closeRealtimeResources(cleanupTarget);
    throw error;
  }
}

function sendRealtimeTutorResponse(
  dataChannel: RTCDataChannel,
  instructions: string,
) {
  if (dataChannel.readyState !== "open") return;

  dataChannel.send(
    JSON.stringify({
      type: "response.create",
      response: { instructions },
    }),
  );
}

function closeRealtimeConnection(connection: RealtimeConnection | null) {
  closeRealtimeResources(connection);
}

function closeRealtimeResources(
  connection: Partial<RealtimeConnection> | null,
) {
  if (!connection) return;

  connection.stream
    ?.getTracks()
    .forEach((track) => runSafely(() => track.stop()));
  runSafely(() => connection.dataChannel?.close());
  runSafely(() => connection.peerConnection?.close());
  runSafely(() => connection.audioElement?.pause?.());
  runSafely(() => {
    if (connection.audioElement) connection.audioElement.srcObject = null;
  });
}

function runSafely(action: () => void) {
  try {
    action();
  } catch {
    // Cleanup should never block retrying or leaving the lesson safely.
  }
}

function muteLiveAvatarVideo(video: HTMLVideoElement) {
  video.defaultMuted = true;
  video.muted = true;
  video.volume = 0;
}

function readProgressSummary(value: unknown): ProgressSummary | null {
  if (!isRecord(value)) return null;

  const { totalXp, completedLessons, lastAwardedAt } = value;

  if (!isSafeProgressCount(totalXp) || !isSafeProgressCount(completedLessons)) {
    return null;
  }

  if (lastAwardedAt !== null && typeof lastAwardedAt !== "string") {
    return null;
  }

  return { totalXp, completedLessons, lastAwardedAt };
}

function isSafeProgressCount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
