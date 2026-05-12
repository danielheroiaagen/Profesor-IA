import "server-only";

const DEFAULT_OPENAI_REALTIME_MODEL = "gpt-realtime-2";
const DEFAULT_HEYGEN_AVATAR_ID = "552426f4e4584a24871c5ffad2a97f73";

const REQUIRED_NAMES = ["OPENAI_API_KEY"] as const;

export type ServerConfig = {
  openai: {
    apiKey: string;
    realtimeModel: string;
  };
  heygen: {
    apiKey?: string;
    avatarId: string;
  };
};

export type HeyGenServerConfig = ServerConfig["heygen"];

export class SafeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeConfigError";
  }
}

type Env = Record<string, string | undefined>;

export function getServerConfig(env: Env = process.env): ServerConfig {
  assertServerRuntime();

  const missing = REQUIRED_NAMES.filter((name) => !env[name]?.trim());

  if (missing.length > 0) {
    throw new SafeConfigError(
      `Missing required server configuration: ${missing.join(", ")}. Set the variable name on the server; never expose or log secret values.`,
    );
  }

  return {
    openai: {
      apiKey: env.OPENAI_API_KEY as string,
      realtimeModel:
        env.OPENAI_REALTIME_MODEL?.trim() || DEFAULT_OPENAI_REALTIME_MODEL,
    },
    heygen: {
      apiKey: optionalSecret(env.HEYGEN_API_KEY),
      avatarId: env.HEYGEN_AVATAR_ID?.trim() || DEFAULT_HEYGEN_AVATAR_ID,
    },
  };
}

export function getHeyGenServerConfig(
  env: Env = process.env,
): HeyGenServerConfig {
  assertServerRuntime();

  return {
    apiKey: optionalSecret(env.HEYGEN_API_KEY),
    avatarId: env.HEYGEN_AVATAR_ID?.trim() || DEFAULT_HEYGEN_AVATAR_ID,
  };
}

export function getSafeConfigStatus(env: Env = process.env) {
  return {
    openaiApiKeyConfigured: Boolean(env.OPENAI_API_KEY?.trim()),
    heygenApiKeyConfigured: Boolean(env.HEYGEN_API_KEY?.trim()),
    openaiRealtimeModel:
      env.OPENAI_REALTIME_MODEL?.trim() || DEFAULT_OPENAI_REALTIME_MODEL,
    heygenAvatarId: env.HEYGEN_AVATAR_ID?.trim() || DEFAULT_HEYGEN_AVATAR_ID,
  };
}

function optionalSecret(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function assertServerRuntime() {
  if (typeof window !== "undefined") {
    throw new SafeConfigError(
      "Server configuration can only be read on the server. Browser code must use ephemeral or server-mediated credentials.",
    );
  }
}
