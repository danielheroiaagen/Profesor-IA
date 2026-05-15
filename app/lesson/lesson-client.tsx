"use client";

import type { LiveAvatarSession as LiveAvatarSessionType } from "@heygen/liveavatar-web-sdk";
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

type AvatarLiveSession = {
  provider: "liveavatar";
  mode: "live";
  avatarId: string;
  sessionId: string;
  sessionToken: string;
};

type LessonStartResponse = {
  lesson: LessonSession;
  lessonAccessToken: string;
  avatar: AvatarStatus;
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

type LiveAvatarStatus = "idle" | "starting" | "ready" | "unavailable";

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
const DEFAULT_HEYGEN_AVATAR_ID = "e29e792a-41e7-4df0-84a8-349e099fb50f";
const DEFAULT_OPENAI_REALTIME_MODEL = "gpt-realtime-2";
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
  const [error, setError] = useState<string | null>(null);
  const connectionRef = useRef<RealtimeConnection | null>(null);
  const lessonAccessTokenRef = useRef<string | null>(null);
  const liveAvatarRef = useRef<LiveAvatarSessionType | null>(null);
  const liveAvatarVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    setTotalXp(readSavedTotalXp());

    return () => {
      closeRealtimeConnection(connectionRef.current);
      void stopLiveAvatarSession({ resetState: false });
    };
  }, []);

  const hasCompletionEvidence =
    learnerTurns >= REQUIRED_LEARNER_TURNS &&
    feedbackEvents >= REQUIRED_FEEDBACK_EVENTS;
  const lessonEnded = status === "completed" || status === "failed";
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
    setAvatar(null);
    setLiveAvatarStatus("idle");
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
      lessonAccessTokenRef.current = lessonResponse.lessonAccessToken;
      setLesson(lessonResponse.lesson);
      setAvatar(lessonResponse.avatar);
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
        (payload) => {
          void recordRealtimeEvidence(lessonResponse.lesson.id, payload);
        },
      );

      replaceRealtimeConnection(connection);
      setConnectionStatus("connected");
      setStatus("active");
    } catch (startError) {
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
    if (!nextAvatar.available || !nextAvatar.avatarId) return;

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
          session.attach(liveAvatarVideoRef.current);
        }
        setLiveAvatarStatus("ready");
      });
      session.on(SessionEvent.SESSION_DISCONNECTED, () => {
        if (liveAvatarRef.current !== session) return;
        setLiveAvatarStatus("unavailable");
      });

      await session.start();
    } catch {
      liveAvatarRef.current = null;
      setLiveAvatarStatus("unavailable");
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
          lessonAccessToken: lessonAccessTokenRef.current,
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
      void stopLiveAvatarSession();
      setConnectionStatus("ended");
    }
  }

  function resetLocalProgress() {
    clearSavedTotalXp();
    setTotalXp(0);
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

  const lessonStatusLabel = formatLessonStatus(status);
  const voiceStatusLabel = formatConnectionStatus(connectionStatus);
  const avatarStatusLabel = formatAvatarStatus(avatar, liveAvatarStatus);
  const stage = readTutorStage(
    status,
    connectionStatus,
    avatar,
    liveAvatarStatus,
  );
  const protectedSessionLabel = realtime
    ? `${realtime.model} · credencial limitada`
    : "sin emitir";
  const completionHint = !lesson
    ? "Empezá la clase para desbloquear práctica, corrección y cierre."
    : hasCompletionEvidence
      ? "Ya hay práctica y feedback: podés cerrar la clase."
      : "Para cerrar la clase con XP, esperá a que el servidor registre una práctica y una corrección.";

  return (
    <main className="classroomShell">
      <style>{premiumClassroomStyles}</style>

      <header
        className="classroomTopbar"
        aria-label="Profesor IA lesson header"
      >
        <p className="brandMark">Profesor IA</p>
        <nav className="classroomNav" aria-label="Secciones de clase">
          <ul>
            <li>
              <a aria-current="page" href="#lesson-stage">
                Clase
              </a>
            </li>
            <li>
              <a href="#practice-controls">Práctica</a>
            </li>
            <li>
              <a href="#progress-panel">Progreso</a>
            </li>
            <li>
              <a href="#session-status">Estado</a>
            </li>
          </ul>
        </nav>
        <div className="topbarActions" aria-label="Progreso y perfil">
          <p className="streakPill" aria-label="Racha de 7 días">
            <span aria-hidden="true">◌</span> 7
          </p>
          <p className="xpPill" aria-label={`${totalXp} XP guardados`}>
            ✦ {totalXp} XP
          </p>
          <span className="profileOrb" aria-label="Perfil de estudiante">
            IA
          </span>
        </div>
      </header>

      <section className="classroomHero" aria-labelledby="lesson-title">
        <div className="lessonStageColumn">
          <article
            id="lesson-stage"
            className={`avatarStage avatarStage--${stage.motionCue}`}
            aria-labelledby="avatar-stage-title"
          >
            <div className="stageMeta">
              <span className="liveBadge">
                <span aria-hidden="true" /> Avatar configurado · HeyGen
              </span>
              <span>
                ID: <code className="identityCode">{stage.avatarId}</code>
              </span>
            </div>

            <div
              className="avatarPortrait"
              aria-label={`Escenario del avatar HeyGen configurado ${stage.avatarId}`}
            >
              <div className="avatarPoster" aria-hidden="true" />
              <div className="avatarShade" aria-hidden="true" />
              <div className="avatarAura" aria-hidden="true" />
              <video
                ref={liveAvatarVideoRef}
                className={
                  stage.isLiveAvatar
                    ? "avatarVideo avatarVideo--ready"
                    : "avatarVideo"
                }
                playsInline
                autoPlay
                aria-label={`Video live del avatar HeyGen ${stage.avatarId}`}
              />
              {!stage.isLiveAvatar ? (
                <div className="avatarCenterBadge" aria-hidden="true">
                  <span>◇</span>
                </div>
              ) : null}
              <div className="voiceMeter" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className="poweredBadge">Powered by {stage.realtimeModel}</div>
            <h2 id="avatar-stage-title" className="stageTitle">
              {stage.title}
            </h2>
            <p className="stageDescription" role="status" aria-live="polite">
              {stage.stateDescription}
            </p>
            <p className="stageIntegrityNote">
              {stage.isLiveAvatar
                ? "Avatar live verificado para esta sesión."
                : "Escenario premium configurado; no afirmamos movimiento live si HeyGen no está disponible."}
            </p>
          </article>

          <div className="stateChipRow" aria-label="Estados del tutor">
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
          </div>

          <section
            id="practice-controls"
            className="controlDock"
            aria-label="Controles de clase"
          >
            <div className="targetPrompt">
              <p className="targetIntro">Practicá diciendo:</p>
              <h1 id="lesson-title">
                Practicá inglés con una mini clase de voz.
              </h1>
              <p className="targetPhrase">“I am practicing English today.”</p>
            </div>
            <div className="startPanel">
              <span>Clase guiada por voz</span>
              <button
                className="primaryButton startLessonButton"
                type="button"
                onClick={startLesson}
                disabled={status === "starting"}
              >
                <span aria-hidden="true">▷</span>
                {formatStartLessonAction(status)}
              </button>
            </div>
            <div className="controlActions">
              <button
                className="secondaryButton"
                type="button"
                onClick={recordLearnerTurn}
                disabled={practiceControlsDisabled}
              >
                <span aria-hidden="true">🎙</span>
                Ya practiqué la frase
              </button>
              <button
                className="secondaryButton"
                type="button"
                onClick={recordVisibleFeedback}
                disabled={practiceControlsDisabled}
              >
                <span aria-hidden="true">✦</span>
                Ver corrección sugerida
              </button>
              <button
                className="dangerButton"
                type="button"
                onClick={completeLesson}
                disabled={!canCompleteLesson}
              >
                <span aria-hidden="true">×</span>
                {formatCompleteLessonAction(
                  status,
                  Boolean(lesson),
                  hasCompletionEvidence,
                )}
              </button>
            </div>
            <p className="controlHint">{completionHint}</p>
          </section>
        </div>

        <aside className="lessonHud" aria-label="Panel de progreso de sesión">
          <section
            id="progress-panel"
            className="progressCard"
            aria-labelledby="progress-title"
          >
            <div className="cardTitleRow">
              <h2 id="progress-title">Progreso de Sesión</h2>
              <span>+{xp?.awarded ? xp.xp : 0} XP ganado</span>
            </div>
            <div className="xpScoreLine">
              <span>Total XP</span>
              <strong>
                {totalXp}
                <small>/500</small>
              </strong>
            </div>
            <div className="progressTrack" aria-hidden="true">
              <span
                style={{ width: `${Math.min(100, (totalXp / 500) * 100)}%` }}
              />
            </div>
            <div className="statGrid" aria-label="Evidencia de sesión">
              <article>
                <span>Turnos</span>
                <strong>{learnerTurns} / 10</strong>
              </article>
              <article>
                <span>Feedback</span>
                <strong>{feedbackEvents}</strong>
              </article>
            </div>
            <div className="activityList">
              <p>Actividad Reciente</p>
              <div>
                <span aria-hidden="true">✓</span>
                <strong>Corrección visible</strong>
                <small>{feedbackSummary}</small>
              </div>
              <div>
                <span aria-hidden="true">○</span>
                <strong>Próximo objetivo</strong>
                <small>Usar la frase objetivo con voz clara.</small>
              </div>
            </div>
            {totalXp > 0 ? (
              <button
                className="ghostButton compact"
                type="button"
                onClick={resetLocalProgress}
              >
                Borrar progreso local
              </button>
            ) : null}
          </section>

          <section
            id="session-status"
            className="statusCard"
            aria-label="Estado protegido de sesión"
          >
            <p className="eyebrow">Estado protegido</p>
            <dl>
              <div>
                <dt>Momento</dt>
                <dd>{lessonStatusLabel}</dd>
              </div>
              <div>
                <dt>Voz</dt>
                <dd>{voiceStatusLabel}</dd>
              </div>
              <div>
                <dt>Avatar</dt>
                <dd>
                  {avatarStatusLabel}
                  {avatar && !avatar.available ? (
                    <span>
                      {" "}
                      La clase sigue por voz; el avatar no bloquea la práctica.
                    </span>
                  ) : null}
                </dd>
              </div>
              <div>
                <dt>Sesión protegida</dt>
                <dd>{protectedSessionLabel}</dd>
              </div>
              <div>
                <dt>Modelo objetivo</dt>
                <dd>
                  <code>{stage.realtimeModel}</code>
                </dd>
              </div>
            </dl>
          </section>
          <section className="tipCard" aria-labelledby="teacher-tip-title">
            <span className="tipIcon" aria-hidden="true">
              ?
            </span>
            <h2 id="teacher-tip-title">Tip del Profesor</h2>
            <p>
              No te preocupes por la velocidad. Lo importante es que tu voz sea
              clara para que la IA detecte tu pronunciación correctamente.
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
    return withTutorIdentity({
      title: isLiveAvatar
        ? "Avatar HeyGen escuchando"
        : "Profesor IA escuchando por voz",
      stateLabel: "Escuchando",
      stateDescription:
        "Tu profesor está listo: practicá la frase en voz alta.",
      motionCue: "listening",
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

  return withTutorIdentity({
    title: "Avatar configurado para tu clase",
    stateLabel: "Ready",
    stateDescription:
      "Tu profesor IA está listo para abrir una clase de speaking.",
    motionCue: "idle",
    isLiveAvatar: false,
  });
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

const premiumClassroomStyles = `
  body {
    margin: 0;
    background: #070d1f;
  }

  .classroomShell,
  .classroomShell * {
    box-sizing: border-box;
  }

  .classroomShell {
    min-height: 100vh;
    color: #dfe4fe;
    background:
      radial-gradient(circle at 14% 10%, rgba(58, 223, 250, 0.16), transparent 28rem),
      radial-gradient(circle at 86% 18%, rgba(172, 138, 255, 0.18), transparent 32rem),
      linear-gradient(180deg, #070d1f 0%, #080f21 52%, #050916 100%);
    font-family: var(--font-body), Inter, ui-sans-serif, system-ui, sans-serif;
    padding-bottom: 2rem;
  }

  .classroomTopbar,
  .classroomHero,
  .feedbackGrid {
    width: min(1600px, calc(100% - 3rem));
    margin-inline: auto;
  }

  .classroomTopbar {
    position: sticky;
    top: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    min-height: 4.5rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid rgba(65, 71, 91, 0.45);
    background: rgba(7, 13, 31, 0.84);
    box-shadow: 0 18px 60px rgba(58, 223, 250, 0.06);
    backdrop-filter: blur(24px);
  }

  .brandMark,
  .eyebrow,
  .liveBadge,
  .streakPill,
  .xpPill,
  .stateChip,
  .targetIntro {
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .brandMark {
    margin: 0;
    color: #3adffa;
    font-family: var(--font-display), "Space Grotesk", sans-serif;
    font-size: 1.3rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    text-transform: none;
  }

  .classroomNav {
    color: #a5aac2;
    font-family: var(--font-display), "Space Grotesk", sans-serif;
    font-size: 0.86rem;
    font-weight: 700;
  }

  .classroomNav ul {
    display: flex;
    align-items: center;
    gap: clamp(0.7rem, 2vw, 1.45rem);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .classroomNav a {
    display: inline-flex;
    align-items: center;
    min-height: 2.35rem;
    padding: 0 0.85rem;
    border: 1px solid transparent;
    border-radius: 999px;
    color: inherit;
    text-decoration: none;
    transition: color 160ms ease, border-color 160ms ease, background 160ms ease;
  }

  .classroomNav a:hover,
  .classroomNav a:focus-visible,
  .classroomNav a[aria-current="page"] {
    border-color: rgba(58, 223, 250, 0.28);
    background: rgba(58, 223, 250, 0.08);
    color: #3adffa;
    outline: none;
  }

  .topbarActions {
    display: flex;
    align-items: center;
    gap: 0.8rem;
  }

  .xpPill,
  .streakPill,
  .liveBadge,
  .stateChip {
    border: 1px solid rgba(65, 71, 91, 0.7);
    border-radius: 999px;
    background: rgba(17, 25, 46, 0.7);
    color: #dff7ff;
  }

  .xpPill,
  .streakPill {
    margin: 0;
    padding: 0.55rem 0.8rem;
  }

  .profileOrb {
    display: grid;
    place-items: center;
    width: 2.5rem;
    aspect-ratio: 1;
    border: 2px solid rgba(58, 223, 250, 0.24);
    border-radius: 999px;
    background:
      radial-gradient(circle at 50% 35%, rgba(58, 223, 250, 0.95), transparent 0.5rem),
      linear-gradient(135deg, #003d46, #5516be);
    color: #dff7ff;
    font-size: 0.7rem;
    font-weight: 900;
  }

  .classroomHero {
    display: grid;
    grid-template-columns: minmax(0, 8fr) minmax(330px, 4fr);
    gap: 1.5rem;
    align-items: start;
    padding-top: 1.5rem;
  }

  .lessonStageColumn,
  .lessonHud,
  .feedbackGrid {
    display: grid;
    gap: 1.25rem;
  }

  .avatarStage,
  .progressCard,
  .statusCard,
  .controlDock,
  .feedbackCard,
  .rewardCard,
  .tipCard,
  .alertCard {
    border: 1px solid rgba(65, 71, 91, 0.58);
    border-radius: 1.5rem;
    background: rgba(17, 25, 46, 0.78);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(20px);
  }

  .avatarStage {
    position: relative;
    overflow: hidden;
    scroll-margin-top: 6rem;
    min-height: clamp(520px, 67vh, 720px);
    padding: 0;
    background:
      linear-gradient(180deg, rgba(12, 19, 38, 0.8), rgba(0, 0, 0, 0.94)),
      #0c1326;
  }

  .avatarStage--listening { border-color: rgba(58, 223, 250, 0.42); }
  .avatarStage--speaking,
  .avatarStage--correcting { border-color: rgba(172, 138, 255, 0.55); }
  .avatarStage--fallback { border-color: rgba(255, 193, 95, 0.48); }
  .avatarStage--completed { border-color: rgba(155, 255, 206, 0.55); }

  .stageMeta,
  .cardTitleRow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .stageMeta {
    position: absolute;
    inset: 1.5rem 1.5rem auto;
    z-index: 5;
  }

  .liveBadge {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.5rem 0.82rem;
    color: #dfe4fe;
    background: rgba(7, 13, 31, 0.62);
    backdrop-filter: blur(14px);
  }

  .liveBadge span {
    width: 0.45rem;
    aspect-ratio: 1;
    border-radius: 999px;
    background: #3adffa;
    box-shadow: 0 0 18px rgba(58, 223, 250, 0.95);
  }

  .stageMeta > span:last-child {
    color: #6f758b;
    font-size: 0.7rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  .identityCode,
  .statusCard code {
    color: #e0f2fe;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    font-size: 0.78em;
  }

  .stageTitle {
    position: absolute;
    left: 1.5rem;
    bottom: 5.2rem;
    z-index: 5;
    max-width: 32rem;
    margin: 0;
    color: #f8fafc;
    font-size: clamp(1.6rem, 3vw, 2.7rem);
    line-height: 1.05;
    font-family: var(--font-display), "Space Grotesk", sans-serif;
    letter-spacing: -0.04em;
    text-shadow: 0 10px 40px rgba(0, 0, 0, 0.65);
  }

  .avatarPortrait {
    position: relative;
    min-height: inherit;
    height: 100%;
    overflow: hidden;
  }

  .avatarPoster,
  .avatarVideo,
  .avatarShade {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .avatarPoster {
    background-image: url("${STITCH_TUTOR_POSTER_URL}");
    background-position: center;
    background-size: cover;
    opacity: 0.86;
    transform: scale(1.02);
  }

  .avatarShade {
    z-index: 1;
    background:
      radial-gradient(circle at 50% 50%, transparent 0 16rem, rgba(7, 13, 31, 0.42) 27rem),
      linear-gradient(180deg, rgba(7, 13, 31, 0.02) 0%, rgba(7, 13, 31, 0.16) 52%, rgba(7, 13, 31, 0.95) 100%);
  }

  .avatarAura {
    position: absolute;
    z-index: 2;
    left: 50%;
    top: 48%;
    width: 7rem;
    aspect-ratio: 1;
    transform: translate(-50%, -50%);
    border-radius: 999px;
    background: rgba(58, 223, 250, 0.12);
    border: 1px solid rgba(58, 223, 250, 0.32);
    backdrop-filter: blur(8px);
    box-shadow: 0 0 42px rgba(58, 223, 250, 0.22);
  }

  .avatarVideo {
    z-index: 3;
    object-fit: cover;
    opacity: 0;
    transition: opacity 220ms ease;
  }

  .avatarVideo--ready {
    opacity: 1;
  }

  .avatarCenterBadge {
    position: absolute;
    z-index: 4;
    display: grid;
    place-items: center;
    left: 50%;
    top: 48%;
    width: 5.6rem;
    aspect-ratio: 1;
    transform: translate(-50%, -50%);
    border-radius: 999px;
    background: rgba(58, 223, 250, 0.08);
    border: 1px solid rgba(58, 223, 250, 0.38);
    color: #3adffa;
    font-weight: 900;
    font-size: 2rem;
    backdrop-filter: blur(12px);
  }

  .voiceMeter {
    position: absolute;
    z-index: 5;
    left: 50%;
    top: calc(50% + 4.6rem);
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 8.4rem;
    min-height: 2.95rem;
    padding: 0 1rem;
    transform: translate(-50%, -50%);
    gap: 0.32rem;
    border: 1px solid rgba(58, 223, 250, 0.24);
    border-radius: 999px;
    background: rgba(7, 13, 31, 0.48);
    box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
    backdrop-filter: blur(14px);
  }

  .voiceMeter span {
    display: block;
    width: 0.32rem;
    height: 0.5rem;
    border-radius: 999px;
    background: #3adffa;
    box-shadow: 0 0 22px rgba(58, 223, 250, 0.8);
    animation: classroom-wave 1.2s ease-in-out infinite;
  }

  .voiceMeter span:nth-child(2), .voiceMeter span:nth-child(4) { animation-delay: 120ms; }
  .voiceMeter span:nth-child(3) { animation-delay: 240ms; }

  @keyframes classroom-wave {
    0%, 100% { height: 0.45rem; opacity: 0.62; }
    50% { height: 2.15rem; opacity: 1; }
  }

  .poweredBadge {
    position: absolute;
    right: 1.3rem;
    bottom: 1.1rem;
    z-index: 5;
    padding: 0.38rem 0.55rem;
    border: 1px solid rgba(65, 71, 91, 0.45);
    border-radius: 0.65rem;
    background: rgba(28, 37, 62, 0.54);
    color: #a5aac2;
    font-size: 0.68rem;
    font-weight: 700;
    backdrop-filter: blur(12px);
  }

  .stageDescription {
    position: absolute;
    left: 1.5rem;
    right: 10rem;
    bottom: 3.35rem;
    z-index: 5;
    margin: 0;
    color: #dfe4fe;
    font-weight: 700;
  }

  .stageIntegrityNote {
    position: absolute;
    left: 1.5rem;
    right: 10rem;
    bottom: 1.55rem;
    z-index: 5;
    margin: 0;
    color: #a5aac2;
    font-size: 0.82rem;
  }

  .stateChipRow {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 0.75rem;
  }

  .stateChip {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    min-height: 3.35rem;
    padding: 0.7rem 0.78rem;
    color: #a5aac2;
    background: rgba(17, 25, 46, 0.88);
    border-radius: 1rem;
  }

  .stateChip.active {
    color: #003d46;
    background: #00cbe6;
    border-color: rgba(58, 223, 250, 0.9);
    box-shadow: 0 0 30px rgba(58, 223, 250, 0.18);
  }

  .progressCard,
  .statusCard,
  .feedbackCard,
  .tipCard,
  .rewardCard { padding: 1.35rem; }

  .controlDock {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(17rem, 0.32fr);
    gap: 1rem;
    align-items: center;
    padding: 1.25rem;
    background: #171f36;
    scroll-margin-top: 6rem;
  }

  .targetPrompt h1 {
    margin: 0.28rem 0 0;
    color: #f8fafc;
    font-family: var(--font-display), "Space Grotesk", sans-serif;
    font-size: clamp(1.2rem, 2vw, 1.75rem);
    line-height: 1.08;
    letter-spacing: -0.03em;
  }

  .eyebrow,
  .targetIntro { color: #67e8f9; margin: 0; }
  .targetPhrase {
    margin: 0.35rem 0 0;
    color: #ffffff;
    font-family: var(--font-display), "Space Grotesk", sans-serif;
    font-size: clamp(1.35rem, 2.2vw, 2.05rem);
    font-weight: 850;
  }

  .startPanel {
    display: grid;
    gap: 0.7rem;
    align-self: stretch;
    padding: 0.85rem;
    border: 1px solid rgba(155, 255, 206, 0.18);
    border-radius: 1.15rem;
    background:
      radial-gradient(circle at 100% 0%, rgba(155, 255, 206, 0.16), transparent 7rem),
      rgba(7, 13, 31, 0.34);
  }

  .startPanel > span {
    color: #9bffce;
    font-size: 0.72rem;
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .controlActions {
    display: grid;
    grid-column: 1 / -1;
    grid-template-columns: repeat(3, minmax(9rem, 1fr));
    gap: 0.75rem;
    align-items: stretch;
  }

  button {
    min-height: 3.5rem;
    border: 0;
    border-radius: 1rem;
    font: inherit;
    font-family: var(--font-display), "Space Grotesk", sans-serif;
    font-weight: 800;
    cursor: pointer;
  }

  button:focus-visible {
    outline: 3px solid #f8fafc;
    outline-offset: 3px;
    box-shadow: 0 0 0 6px rgba(58, 223, 250, 0.35);
  }

  button:disabled { cursor: not-allowed; opacity: 0.58; }

  .primaryButton,
  .secondaryButton,
  .dangerButton,
  .ghostButton {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.55rem;
    padding: 0.8rem 1rem;
    transition: transform 160ms ease, background 160ms ease, border-color 160ms ease;
  }

  .primaryButton {
    color: #00452d;
    background: #9bffce;
    box-shadow: 0 16px 36px rgba(155, 255, 206, 0.12);
  }

  .startLessonButton {
    min-height: 4.1rem;
    width: 100%;
    font-size: 1.02rem;
    box-shadow: 0 18px 48px rgba(155, 255, 206, 0.2);
  }

  .secondaryButton,
  .ghostButton {
    color: #dfe4fe;
    background: #1c253e;
    border: 1px solid rgba(65, 71, 91, 0.7);
  }

  .dangerButton {
    color: #ff716c;
    background: rgba(159, 5, 25, 0.2);
    border: 1px solid rgba(255, 113, 108, 0.32);
  }

  .primaryButton:not(:disabled):hover,
  .secondaryButton:not(:disabled):hover,
  .dangerButton:not(:disabled):hover,
  .ghostButton:not(:disabled):hover {
    transform: translateY(-1px);
  }

  .compact { min-height: 2.5rem; padding-inline: 0.75rem; }
  .controlHint { grid-column: 1 / -1; margin: 0; color: #a5aac2; font-size: 0.9rem; }

  .cardTitleRow h2,
  .tipCard h2,
  .feedbackCard h2,
  .rewardCard h2 {
    margin: 0;
    color: #f8fafc;
    font-family: var(--font-display), "Space Grotesk", sans-serif;
    letter-spacing: -0.03em;
  }

  .cardTitleRow span {
    color: #9bffce;
    font-size: 0.75rem;
    font-weight: 900;
  }

  .progressCard,
  .statusCard,
  .feedbackGrid {
    scroll-margin-top: 6rem;
  }

  .xpScoreLine {
    display: flex;
    align-items: end;
    justify-content: space-between;
    margin-top: 1rem;
    padding: 1rem;
    border: 1px solid rgba(65, 71, 91, 0.24);
    border-radius: 1rem;
    background: rgba(0, 0, 0, 0.18);
  }

  .xpScoreLine span,
  .statGrid span,
  .activityList > p {
    color: #a5aac2;
    font-size: 0.68rem;
    font-weight: 900;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .xpScoreLine strong {
    color: #f8fafc;
    font-family: var(--font-display), "Space Grotesk", sans-serif;
    font-size: 2rem;
    line-height: 0.9;
  }

  .xpScoreLine small {
    color: #6f758b;
    font-size: 1rem;
  }

  .progressTrack {
    height: 0.65rem;
    margin-top: 0.75rem;
    overflow: hidden;
    border-radius: 999px;
    background: #1c253e;
  }

  .progressTrack span {
    display: block;
    height: 100%;
    min-width: 0.35rem;
    border-radius: inherit;
    background: #9bffce;
    box-shadow: 0 0 18px rgba(155, 255, 206, 0.55);
  }

  .evidenceLine { color: #cbd5e1; font-weight: 700; }

  .statGrid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.85rem;
    margin-top: 1rem;
  }

  .statGrid article {
    display: grid;
    gap: 0.45rem;
    padding: 1rem;
    border: 1px solid rgba(65, 71, 91, 0.24);
    border-radius: 1rem;
    background: rgba(0, 0, 0, 0.2);
  }

  .statGrid strong {
    color: #f8fafc;
    font-family: var(--font-display), "Space Grotesk", sans-serif;
    font-size: 1.3rem;
  }

  .activityList {
    display: grid;
    gap: 0.75rem;
    margin-top: 1.25rem;
  }

  .activityList > p { margin: 0; }

  .activityList div {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.15rem 0.75rem;
    padding: 0.8rem;
    border-left: 2px solid #9bffce;
    border-radius: 0.85rem;
    background: rgba(28, 37, 62, 0.52);
  }

  .activityList span { grid-row: span 2; color: #9bffce; }
  .activityList strong { color: #dfe4fe; font-size: 0.9rem; }
  .activityList small { color: #a5aac2; line-height: 1.35; }

  .statusCard dl { display: grid; gap: 0.8rem; margin: 0; }
  .statusCard div { display: flex; justify-content: space-between; gap: 1rem; }
  .statusCard dt { color: #94a3b8; }
  .statusCard dd { margin: 0; color: #f8fafc; text-align: right; }

  .tipCard {
    position: relative;
    overflow: hidden;
    display: grid;
    gap: 0.75rem;
    background:
      radial-gradient(circle at 100% 0%, rgba(58, 223, 250, 0.22), transparent 9rem),
      linear-gradient(135deg, rgba(0, 203, 230, 0.16), rgba(85, 22, 190, 0.18));
    border-color: rgba(58, 223, 250, 0.24);
  }

  .tipIcon {
    display: grid;
    place-items: center;
    width: 2.5rem;
    aspect-ratio: 1;
    border-radius: 0.7rem;
    background: rgba(58, 223, 250, 0.16);
    color: #3adffa;
    font-weight: 900;
  }

  .tipCard p,
  .feedbackCard p,
  .rewardCard p { color: #cbd5e1; line-height: 1.55; }

  .feedbackGrid {
    grid-template-columns: 1fr 1fr;
    margin-top: 1.25rem;
  }

  .rewardCard.success { border-color: rgba(155, 255, 206, 0.5); background: rgba(0, 90, 60, 0.28); }
  .rewardCard.warning { border-color: rgba(255, 193, 95, 0.45); background: rgba(120, 53, 15, 0.35); }
  .alertCard { width: min(1600px, calc(100% - 3rem)); margin: 1.25rem auto 0; padding: 1rem; color: #fecaca; border-color: rgba(255, 113, 108, 0.45); }

  @media (max-width: 1100px) {
    .classroomHero,
    .feedbackGrid,
    .controlDock,
    .controlActions { grid-template-columns: 1fr; }
    .startPanel { order: -1; }
    .lessonHud { grid-template-columns: 1fr 1fr; }
    .statusCard,
    .tipCard { min-height: 100%; }
  }

  @media (max-width: 760px) {
    .classroomTopbar, .classroomHero, .feedbackGrid, .alertCard { width: calc(100% - 1rem); }
    .classroomTopbar { border-radius: 0 0 1.25rem 1.25rem; padding-inline: 1rem; }
    .classroomNav { display: none; }
    .topbarActions { gap: 0.45rem; }
    .streakPill { display: none; }
    .classroomHero { padding-top: 1rem; }
    .avatarStage { min-height: 460px; }
    .stageMeta { inset: 1rem 1rem auto; }
    .stageMeta > span:last-child { display: none; }
    .stageTitle { left: 1rem; right: 1rem; bottom: 6.1rem; font-size: 1.55rem; }
    .stageDescription { left: 1rem; right: 1rem; bottom: 3.85rem; }
    .stageIntegrityNote { left: 1rem; right: 1rem; bottom: 1.35rem; }
    .voiceMeter { top: 52%; }
    .poweredBadge { display: none; }
    .stateChipRow { grid-template-columns: 1fr 1fr; }
    .stateChip:last-child { grid-column: 1 / -1; }
    .lessonHud,
    .statGrid { grid-template-columns: 1fr; }
  }

  @media (prefers-reduced-motion: reduce) {
    .voiceMeter span,
    .liveBadge span {
      animation: none;
    }
  }
`;

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

function formatStartLessonAction(status: LessonStatus) {
  if (status === "starting") return "Preparando clase...";
  if (status === "completed") return "Practicar otra vez";
  if (status === "failed") return "Reintentar clase";

  return "Empezar clase";
}

function formatCompleteLessonAction(
  status: LessonStatus,
  hasLesson: boolean,
  hasCompletionEvidence: boolean,
) {
  if (status === "completed") return "Clase cerrada";
  if (status === "failed") return "Reintento necesario";
  if (hasLesson && !hasCompletionEvidence) return "Esperando evidencia de voz";

  return "Finalizar clase";
}

function formatAvatarStatus(
  avatar: AvatarStatus | null,
  liveAvatarStatus: LiveAvatarStatus,
) {
  if (!avatar) return "tutor listo para empezar";
  if (liveAvatarStatus === "ready") return "avatar live conectado";
  if (liveAvatarStatus === "starting") return "avatar live iniciando";
  if (liveAvatarStatus === "unavailable") return "avatar live no disponible";
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
    closeRealtimeConnection({ peerConnection, dataChannel, stream });

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

function clearSavedTotalXp() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(LOCAL_XP_STORAGE_KEY);
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
