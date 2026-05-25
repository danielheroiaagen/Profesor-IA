export type TutorStateLabel =
  | "Ready"
  | "Conectando"
  | "Escuchando"
  | "Hablando"
  | "Corrigiendo"
  | "Completada"
  | "Modo voz seguro"
  | "Reintento seguro";

export type TutorMotionCue =
  | "idle"
  | "connecting"
  | "listening"
  | "speaking"
  | "correcting"
  | "fallback"
  | "completed";

export type TutorStageViewModel = {
  title: string;
  stateLabel: TutorStateLabel;
  stateDescription: string;
  motionCue: TutorMotionCue;
  isLiveAvatar: boolean;
  avatarId: string;
  realtimeModel: string;
};

interface AvatarStageProps {
  stage: TutorStageViewModel;
  rememberLiveAvatarVideo: (video: HTMLVideoElement | null) => void;
  onVideoVolumeChange: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
}

export function AvatarStage({
  stage,
  rememberLiveAvatarVideo,
  onVideoVolumeChange,
}: AvatarStageProps) {
  return (
    <article
      id="lesson-stage"
      className={`avatarStage avatarStage--${stage.motionCue}`}
      aria-labelledby="avatar-stage-title"
    >
      <div className="stageMeta">
        <span className="liveBadge">
          <span aria-hidden="true" /> Avatar visual · LiveAvatar LITE
        </span>
        {/* Session ID preserved for test assertions - visually de-emphasized */}
        <span className="stageMetaId">
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
          ref={rememberLiveAvatarVideo}
          className={
            stage.isLiveAvatar
              ? "avatarVideo avatarVideo--ready"
              : "avatarVideo"
          }
          playsInline
          autoPlay
          muted
          onVolumeChange={onVideoVolumeChange}
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

      {/* Model badge preserved for test assertions - visually de-emphasized */}
      <div className="poweredBadge">Voz principal: {stage.realtimeModel}</div>
      <h2 id="avatar-stage-title" className="stageTitle">
        {stage.title}
      </h2>
      <p className="stageDescription" role="status" aria-live="polite">
        {stage.stateDescription}
      </p>
      <p className="stageIntegrityNote">
        {stage.isLiveAvatar
          ? "Avatar visual conectado; voz y micrófono pertenecen solo a Realtime 2."
          : "Escenario premium configurado; no afirmamos movimiento live si LiveAvatar no está disponible."}
      </p>
    </article>
  );
}
