import { getLiveAvatarServerConfig } from "@/config/server";

const LIVEAVATAR_API_URL = "https://api.liveavatar.com";
const LIVEAVATAR_MODE = "LITE";
const LIVEAVATAR_PROVIDER = "liveavatar";
const LIVEAVATAR_VIDEO_QUALITY = "high";
const LIVEAVATAR_VIDEO_ENCODING = "H264";
const DEFAULT_MAX_SESSION_DURATION_SECONDS = 300;

type FetchLike = typeof fetch;

type LiveAvatarSessionTokenOptions = {
  apiKey?: string;
  avatarId: string;
  fetchImpl?: FetchLike;
  apiBaseUrl?: string;
  maxSessionDurationSeconds?: number;
};

type LiveAvatarTokenPayload = {
  code?: number;
  data?: unknown;
  message?: string;
};

export type LiveAvatarSessionToken = {
  provider: typeof LIVEAVATAR_PROVIDER;
  mode: "live";
  avatarId: string;
  sessionId: string;
  sessionToken: string;
};

export class LiveAvatarSessionError extends Error {
  constructor(
    message: string,
    readonly reason: string,
  ) {
    super(message);
    this.name = "LiveAvatarSessionError";
  }
}

export async function mintLiveAvatarSessionFromConfig(
  options: Partial<
    Omit<LiveAvatarSessionTokenOptions, "apiKey" | "avatarId">
  > = {},
): Promise<LiveAvatarSessionToken> {
  const config = getLiveAvatarServerConfig();

  return mintLiveAvatarSessionToken({
    apiKey: config.apiKey,
    avatarId: config.avatarId,
    ...options,
  });
}

export async function mintLiveAvatarSessionToken({
  apiKey,
  avatarId,
  fetchImpl = fetch,
  apiBaseUrl = LIVEAVATAR_API_URL,
  maxSessionDurationSeconds = DEFAULT_MAX_SESSION_DURATION_SECONDS,
}: LiveAvatarSessionTokenOptions): Promise<LiveAvatarSessionToken> {
  const normalizedAvatarId = avatarId.trim();

  if (!apiKey?.trim()) {
    throw new LiveAvatarSessionError(
      "Live avatar provider is not configured.",
      "avatar-live-provider-not-configured",
    );
  }

  if (!normalizedAvatarId) {
    throw new LiveAvatarSessionError(
      "Live avatar id is not configured.",
      "avatar-live-id-not-configured",
    );
  }

  const response = await fetchImpl(`${apiBaseUrl}/v1/sessions/token`, {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: LIVEAVATAR_MODE,
      avatar_id: normalizedAvatarId,
      max_session_duration: maxSessionDurationSeconds,
      video_settings: {
        quality: LIVEAVATAR_VIDEO_QUALITY,
        encoding: LIVEAVATAR_VIDEO_ENCODING,
      },
    }),
  });

  if (!response.ok) {
    throw new LiveAvatarSessionError(
      "Live avatar session token was rejected.",
      "avatar-live-provider-rejected",
    );
  }

  const payload: unknown = await response.json();
  const token = readSessionToken(payload);

  if (!token) {
    throw new LiveAvatarSessionError(
      "Live avatar session token response was invalid.",
      "avatar-live-provider-invalid-response",
    );
  }

  return {
    provider: LIVEAVATAR_PROVIDER,
    mode: "live",
    avatarId: normalizedAvatarId,
    sessionId: token.sessionId,
    sessionToken: token.sessionToken,
  };
}

function readSessionToken(payload: unknown) {
  if (!isLiveAvatarTokenPayload(payload)) return null;
  if (!isRecord(payload.data)) return null;

  const sessionId = payload.data.session_id;
  const sessionToken = payload.data.session_token;

  return typeof sessionId === "string" && typeof sessionToken === "string"
    ? { sessionId, sessionToken }
    : null;
}

function isLiveAvatarTokenPayload(
  payload: unknown,
): payload is LiveAvatarTokenPayload {
  return isRecord(payload);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
