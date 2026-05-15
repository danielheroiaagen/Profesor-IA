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
const DEFAULT_HEYGEN_AVATAR_ID = "552426f4e4584a24871c5ffad2a97f73";
const DEFAULT_OPENAI_REALTIME_MODEL = "gpt-realtime-2";
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
  const lessonEnded = status === "completed" || status === "failed";
  const canCompleteLesson =
    Boolean(lesson) && !lessonEnded && hasCompletionEvidence;
  const practiceControlsDisabled = !lesson || lessonEnded;

  async function startLesson() {
    replaceRealtimeConnection(null);
    let lessonStarted = false;

    setStatus("starting");
    setConnectionStatus("requesting-mic");
    setLesson(null);
    setAvatar(null);
    setRealtime(null);
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
      lessonStarted = true;
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
      setConnectionStatus(lessonStarted ? "fallback" : "failed");
      setStatus(lessonStarted ? "active" : "failed");
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
  const avatarStatusLabel = formatAvatarStatus(avatar);
  const stage = readTutorStage(status, connectionStatus, avatar);
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
          <span aria-current="page">Clase</span>
          <span>Práctica</span>
          <span>Progreso</span>
        </nav>
        <p className="xpPill" aria-label={`${totalXp} XP guardados`}>
          ✦ {totalXp} XP
        </p>
      </header>

      <section className="classroomHero" aria-labelledby="lesson-title">
        <div className={`avatarStage avatarStage--${stage.motionCue}`}>
          <div className="stageMeta">
            <span className="liveBadge">{stage.stateLabel}</span>
            <span>
              Avatar HeyGen ·{" "}
              <code className="identityCode">{stage.avatarId}</code>
            </span>
          </div>

          <h2 className="stageTitle">{stage.title}</h2>

          <div
            className="avatarPortrait"
            aria-label={`Escenario del avatar HeyGen configurado ${stage.avatarId}`}
          >
            <div className="avatarAura" aria-hidden="true" />
            <div className="avatarSilhouette" aria-hidden="true">
              <span className="avatarFace">IA</span>
            </div>
            <div className="voiceWave" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>

          <p className="stageDescription" role="status" aria-live="polite">
            {stage.stateDescription}
          </p>
          <p className="stageIntegrityNote">
            {stage.isLiveAvatar
              ? "Avatar live verificado para esta sesión."
              : "Escenario premium configurado; no afirmamos movimiento live si HeyGen no está disponible."}
          </p>

          <div className="stateChipRow" aria-label="Estados del tutor">
            {TUTOR_STATE_LABELS.map((label) => (
              <span
                className={
                  stage.stateLabel === label ? "stateChip active" : "stateChip"
                }
                key={label}
              >
                <span aria-hidden="true">●</span>
                {label}
              </span>
            ))}
          </div>
        </div>

        <aside className="lessonHud" aria-label="Panel de progreso de sesión">
          <section className="objectiveCard" aria-labelledby="lesson-title">
            <p className="eyebrow">Clase guiada · Speaking A1</p>
            <h1 id="lesson-title">
              Practicá inglés con una mini clase de voz.
            </h1>
            <p className="targetIntro">Practicá diciendo:</p>
            <p className="targetPhrase">“I am practicing English today.”</p>
          </section>

          <section className="progressCard" aria-labelledby="progress-title">
            <div className="cardTitleRow">
              <h2 id="progress-title">Progreso</h2>
              <span>{totalXp} XP guardados</span>
            </div>
            <div className="progressTrack" aria-hidden="true">
              <span style={{ width: `${Math.min(100, totalXp)}%` }} />
            </div>
            <p className="evidenceLine">
              Evidencia: {learnerTurns} prácticas / {feedbackEvents} feedback
            </p>
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
            className="statusCard"
            aria-label="Estado protegido de sesión"
          >
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
        </aside>
      </section>

      {error ? (
        <p role="alert" className="alertCard">
          {error} Podés reintentar sin exponer valores secretos.
        </p>
      ) : null}

      <section className="controlDock" aria-label="Controles de clase">
        <button
          className="primaryButton"
          type="button"
          onClick={startLesson}
          disabled={status === "starting"}
        >
          {formatStartLessonAction(status)}
        </button>
        <button
          className="secondaryButton"
          type="button"
          onClick={recordLearnerTurn}
          disabled={practiceControlsDisabled}
        >
          Ya practiqué la frase
        </button>
        <button
          className="secondaryButton"
          type="button"
          onClick={recordVisibleFeedback}
          disabled={practiceControlsDisabled}
        >
          Ver corrección sugerida
        </button>
        <button
          className="secondaryButton"
          type="button"
          onClick={completeLesson}
          disabled={!canCompleteLesson}
        >
          {formatCompleteLessonAction(
            status,
            Boolean(lesson),
            hasCompletionEvidence,
          )}
        </button>
        <p className="controlHint">{completionHint}</p>
      </section>

      <section className="feedbackGrid" aria-label="Feedback de clase">
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
): TutorStageViewModel {
  const isLiveAvatar = avatar?.available === true && avatar.mode === "live";

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
        "Preparando micrófono, WebRTC y sesión protegida para empezar.",
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

const premiumClassroomStyles = `
  .classroomShell {
    min-height: 100vh;
    margin: 0;
    padding: 1.25rem;
    color: #e5edff;
    background:
      radial-gradient(circle at 18% 12%, rgba(34, 211, 238, 0.2), transparent 28rem),
      radial-gradient(circle at 78% 22%, rgba(139, 92, 246, 0.24), transparent 30rem),
      linear-gradient(135deg, #020617 0%, #07111f 42%, #090c1a 100%);
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .classroomTopbar,
  .classroomHero,
  .feedbackGrid {
    width: min(1180px, 100%);
    margin-inline: auto;
  }

  .classroomTopbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.85rem 0 1.35rem;
  }

  .brandMark,
  .eyebrow,
  .liveBadge,
  .xpPill,
  .stateChip,
  .targetIntro {
    font-size: 0.76rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .brandMark { color: #67e8f9; margin: 0; }

  .classroomNav {
    display: flex;
    gap: 0.75rem;
    color: #94a3b8;
    font-size: 0.82rem;
  }

  .classroomNav span[aria-current="page"] { color: #e0f2fe; }

  .xpPill,
  .liveBadge,
  .stateChip {
    border: 1px solid rgba(125, 211, 252, 0.3);
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.72);
    color: #dff7ff;
  }

  .xpPill { margin: 0; padding: 0.55rem 0.8rem; }

  .classroomHero {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(320px, 0.75fr);
    gap: 1.25rem;
    align-items: stretch;
  }

  .avatarStage,
  .objectiveCard,
  .progressCard,
  .statusCard,
  .controlDock,
  .feedbackCard,
  .rewardCard,
  .alertCard {
    border: 1px solid rgba(148, 163, 184, 0.18);
    border-radius: 1.25rem;
    background: rgba(8, 13, 31, 0.78);
    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.42);
    backdrop-filter: blur(18px);
  }

  .avatarStage {
    position: relative;
    overflow: hidden;
    min-height: 520px;
    padding: 1rem;
    background:
      linear-gradient(180deg, rgba(15, 23, 42, 0.3), rgba(2, 6, 23, 0.94)),
      radial-gradient(circle at 50% 35%, rgba(34, 211, 238, 0.18), transparent 18rem);
  }

  .avatarStage--correcting { box-shadow: 0 0 0 1px rgba(167, 139, 250, 0.45), 0 24px 80px rgba(0, 0, 0, 0.42); }
  .avatarStage--fallback { box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.4), 0 24px 80px rgba(0, 0, 0, 0.42); }
  .avatarStage--completed { box-shadow: 0 0 0 1px rgba(16, 185, 129, 0.5), 0 24px 80px rgba(0, 0, 0, 0.42); }

  .stageMeta,
  .stateChipRow,
  .cardTitleRow {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .liveBadge { padding: 0.42rem 0.7rem; color: #99f6e4; }
  .stageMeta span:last-child { color: #94a3b8; font-size: 0.82rem; }
  .identityCode,
  .statusCard code {
    color: #e0f2fe;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    font-size: 0.78em;
  }

  .stageTitle {
    margin: 1.1rem 0 0;
    color: #f8fafc;
    font-size: clamp(1.5rem, 3vw, 2.4rem);
    line-height: 1.05;
    text-align: center;
    font-family: "Space Grotesk", Inter, system-ui, sans-serif;
  }

  .avatarPortrait {
    position: relative;
    display: grid;
    place-items: center;
    min-height: 365px;
    margin-top: 1rem;
    border-radius: 1rem;
    background:
      linear-gradient(90deg, rgba(34, 211, 238, 0.1), transparent 22%, transparent 78%, rgba(34, 211, 238, 0.08)),
      radial-gradient(circle, rgba(148, 163, 184, 0.16), rgba(15, 23, 42, 0.2) 34%, rgba(2, 6, 23, 0.92) 72%);
    overflow: hidden;
  }

  .avatarAura {
    position: absolute;
    width: 18rem;
    aspect-ratio: 1;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(139, 92, 246, 0.28), transparent 62%);
    filter: blur(4px);
  }

  .avatarSilhouette {
    position: relative;
    display: grid;
    place-items: center;
    width: min(42vw, 17rem);
    aspect-ratio: 0.78;
    border-radius: 44% 44% 20% 20%;
    background:
      radial-gradient(circle at 50% 20%, #cbd5e1 0 18%, transparent 19%),
      linear-gradient(180deg, #172554, #020617 70%);
    border: 1px solid rgba(125, 211, 252, 0.22);
    box-shadow: 0 0 60px rgba(34, 211, 238, 0.2);
  }

  .avatarFace {
    display: grid;
    place-items: center;
    width: 4.5rem;
    aspect-ratio: 1;
    border-radius: 999px;
    background: rgba(2, 6, 23, 0.62);
    color: #67e8f9;
    font-weight: 900;
  }

  .voiceWave {
    position: absolute;
    bottom: 2rem;
    display: flex;
    align-items: center;
    gap: 0.28rem;
  }

  .voiceWave span {
    display: block;
    width: 0.38rem;
    height: 1.2rem;
    border-radius: 999px;
    background: #22d3ee;
    box-shadow: 0 0 20px rgba(34, 211, 238, 0.8);
  }

  .voiceWave span:nth-child(2), .voiceWave span:nth-child(4) { height: 2rem; }
  .voiceWave span:nth-child(3) { height: 2.7rem; }

  .stageDescription {
    margin: 1rem 0 0;
    color: #cbd5e1;
    text-align: center;
  }

  .stageIntegrityNote {
    max-width: 42rem;
    margin: 0.45rem auto 0;
    color: #94a3b8;
    text-align: center;
    font-size: 0.9rem;
  }

  .stateChipRow { justify-content: center; margin-top: 1rem; }
  .stateChip { padding: 0.5rem 0.72rem; color: #94a3b8; }
  .stateChip.active { color: #020617; background: #67e8f9; border-color: #a5f3fc; }

  .lessonHud,
  .feedbackGrid { display: grid; gap: 1rem; }

  .objectiveCard,
  .progressCard,
  .statusCard,
  .feedbackCard,
  .rewardCard { padding: 1rem; }

  .objectiveCard h1 {
    margin: 0.35rem 0 1rem;
    color: #f8fafc;
    font-size: clamp(1.85rem, 4vw, 3rem);
    line-height: 1.04;
    font-family: "Space Grotesk", Inter, system-ui, sans-serif;
  }

  .eyebrow,
  .targetIntro { color: #67e8f9; margin: 0; }
  .targetPhrase { margin: 0.35rem 0 0; color: #f8fafc; font-size: 1.4rem; font-weight: 850; }

  .progressTrack {
    height: 0.55rem;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(148, 163, 184, 0.18);
  }

  .progressTrack span {
    display: block;
    height: 100%;
    min-width: 0.35rem;
    border-radius: inherit;
    background: linear-gradient(90deg, #34d399, #67e8f9);
  }

  .evidenceLine { color: #cbd5e1; font-weight: 700; }

  .statusCard dl { display: grid; gap: 0.8rem; margin: 0; }
  .statusCard div { display: flex; justify-content: space-between; gap: 1rem; }
  .statusCard dt { color: #94a3b8; }
  .statusCard dd { margin: 0; color: #f8fafc; text-align: right; }

  .controlDock {
    width: min(1180px, 100%);
    margin: 1rem auto 0;
    display: grid;
    grid-template-columns: 1.2fr repeat(3, 1fr);
    gap: 0.75rem;
    padding: 0.85rem;
  }

  button {
    min-height: 44px;
    border: 0;
    border-radius: 0.85rem;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }

  button:focus-visible {
    outline: 3px solid #f8fafc;
    outline-offset: 3px;
    box-shadow: 0 0 0 6px rgba(34, 211, 238, 0.35);
  }

  button:disabled { cursor: not-allowed; opacity: 0.58; }

  .primaryButton { color: #022c22; background: linear-gradient(135deg, #6ee7b7, #67e8f9); }
  .secondaryButton, .ghostButton { color: #dbeafe; background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(148, 163, 184, 0.18); }
  .compact { min-height: 36px; padding-inline: 0.75rem; }
  .controlHint { grid-column: 1 / -1; margin: 0.1rem 0 0; color: #cbd5e1; font-size: 0.92rem; }

  .feedbackGrid {
    grid-template-columns: 1fr 1fr;
    margin-top: 1rem;
  }

  .feedbackCard h2,
  .rewardCard h2 { margin: 0.35rem 0 0.6rem; }
  .rewardCard.success { border-color: rgba(16, 185, 129, 0.5); background: rgba(6, 78, 59, 0.35); }
  .rewardCard.warning { border-color: rgba(251, 191, 36, 0.45); background: rgba(120, 53, 15, 0.35); }
  .alertCard { width: min(1180px, 100%); margin: 1rem auto 0; padding: 1rem; color: #fecaca; border-color: rgba(248, 113, 113, 0.45); }

  @media (max-width: 860px) {
    .classroomShell { padding: 0.85rem; }
    .classroomTopbar, .classroomHero, .feedbackGrid, .controlDock { width: 100%; }
    .classroomHero, .feedbackGrid, .controlDock { grid-template-columns: 1fr; }
    .avatarStage { min-height: 430px; }
    .classroomNav { display: none; }
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
