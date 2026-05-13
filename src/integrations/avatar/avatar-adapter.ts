export const AVATAR_MODES = [
  "live",
  "generated",
  "static",
  "voice-only",
] as const;

export type AvatarMode = (typeof AVATAR_MODES)[number];

export type AvatarStatus = {
  mode: AvatarMode;
  available: boolean;
  reason?: string;
  avatarId?: string;
};

export type AvatarAdapterContext = {
  lessonId: string;
  avatarId?: string;
};

export type AvatarAdapter = {
  getStatus(
    context: AvatarAdapterContext,
  ): Promise<AvatarStatus> | AvatarStatus;
};

export function createVoiceOnlyAvatarAdapter(
  reason = "avatar-provider-not-configured",
): AvatarAdapter {
  return {
    getStatus() {
      return {
        mode: "voice-only",
        available: false,
        reason,
      };
    },
  };
}

export function createStaticAvatarStatus(
  avatarId: string,
  reason: string,
): AvatarStatus {
  return {
    mode: "static",
    available: false,
    avatarId,
    reason,
  };
}
