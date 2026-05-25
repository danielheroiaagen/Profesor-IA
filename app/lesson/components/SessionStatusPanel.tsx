import type {
  AvatarRuntimeState,
  AvatarRuntimeStatus,
} from "@/integrations/avatar/avatar-runtime";

type AvatarStatus = {
  mode: "live" | "generated" | "static" | "voice-only";
  available: boolean;
  reason?: string;
  avatarId?: string;
};

function formatAvatarRuntimeStatus(status: AvatarRuntimeStatus): string {
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

interface SessionStatusPanelProps {
  lessonStatusLabel: string;
  voiceStatusLabel: string;
  avatarStatusLabel: string;
  avatar: AvatarStatus | null;
  avatarRuntime: AvatarRuntimeState | null;
  protectedSessionLabel: string;
  realtimeModel: string;
}

export function SessionStatusPanel({
  lessonStatusLabel,
  voiceStatusLabel,
  avatarStatusLabel,
  avatar,
  avatarRuntime,
  protectedSessionLabel,
  realtimeModel,
}: SessionStatusPanelProps) {
  return (
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
        {avatarRuntime ? (
          <div>
            <dt>Runtime avatar</dt>
            <dd>{formatAvatarRuntimeStatus(avatarRuntime.status)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Sesión protegida</dt>
          <dd>{protectedSessionLabel}</dd>
        </div>
        <div>
          <dt>Modelo objetivo</dt>
          <dd>
            <code>{realtimeModel}</code>
          </dd>
        </div>
      </dl>
    </section>
  );
}
