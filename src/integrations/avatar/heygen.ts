import { getHeyGenServerConfig } from "@/config/server";
import type {
  AvatarAdapter,
  AvatarStatus,
} from "@/integrations/avatar/avatar-adapter";
import {
  createStaticAvatarStatus,
  createVoiceOnlyAvatarAdapter,
} from "@/integrations/avatar/avatar-adapter";

const LIVEAVATAR_API_URL = "https://api.liveavatar.com/v1";
const DEFAULT_TIMEOUT_MS = 1_500;

type FetchLike = typeof fetch;

type HeyGenAvatarAdapterOptions = {
  apiKey?: string;
  avatarId: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  apiBaseUrl?: string;
};

export function createHeyGenAvatarAdapterFromConfig(
  options: Partial<
    Omit<HeyGenAvatarAdapterOptions, "apiKey" | "avatarId">
  > = {},
): AvatarAdapter {
  const config = getHeyGenServerConfig();

  return createHeyGenAvatarAdapter({
    apiKey: config.apiKey,
    avatarId: config.avatarId,
    ...options,
  });
}

export function createHeyGenAvatarAdapter({
  apiKey,
  avatarId,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  apiBaseUrl = LIVEAVATAR_API_URL,
}: HeyGenAvatarAdapterOptions): AvatarAdapter {
  const normalizedAvatarId = avatarId.trim();

  if (!apiKey?.trim()) {
    return createVoiceOnlyAvatarAdapter("avatar-provider-not-configured");
  }

  if (!normalizedAvatarId) {
    return createVoiceOnlyAvatarAdapter("avatar-id-not-configured");
  }

  return {
    async getStatus(): Promise<AvatarStatus> {
      try {
        const response = await withTimeout(
          fetchImpl(
            `${apiBaseUrl}/avatars/${encodeURIComponent(normalizedAvatarId)}`,
            {
              method: "GET",
              headers: {
                "X-API-KEY": apiKey,
                Accept: "application/json",
              },
            },
          ),
          timeoutMs,
        );

        if (!response.ok) {
          return createStaticAvatarStatus(
            normalizedAvatarId,
            "avatar-provider-rejected",
          );
        }

        return {
          mode: "static",
          available: true,
          avatarId: normalizedAvatarId,
          reason: "avatar-validated",
        };
      } catch {
        return createStaticAvatarStatus(
          normalizedAvatarId,
          "avatar-provider-unavailable",
        );
      }
    },
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("avatar-provider-timeout")),
      timeoutMs,
    );

    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });
}
