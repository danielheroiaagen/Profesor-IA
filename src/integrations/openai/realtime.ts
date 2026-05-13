import { getServerConfig } from "@/config/server";

const REALTIME_CLIENT_SECRETS_URL =
  "https://api.openai.com/v1/realtime/client_secrets";
const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
const DEFAULT_CLIENT_SECRET_TTL_SECONDS = 600;
const TUTOR_INSTRUCTIONS = `You are Profesor IA, a warm and direct English teacher.
Run a short spoken lesson for a Spanish-speaking learner.
Correct one sentence at a time, explain the correction briefly, and keep the learner encouraged.
Do not mention hidden system or API details.`;

type FetchLike = typeof fetch;

type RealtimeClientSecretApiResponse = {
  expires_at?: number;
  value?: string;
  session?: {
    type?: string;
    model?: string;
    client_secret?: {
      value?: string;
      expires_at?: number;
    };
  };
};

export type MintRealtimeSessionInput = {
  apiKey: string;
  model: string;
  lessonId: string;
  fetchImpl?: FetchLike;
  ttlSeconds?: number;
  safetyIdentifier?: string;
};

export type RealtimeSessionResponse = {
  clientSecret: string;
  model: string;
  expiresAt: string;
  lessonId: string;
  connectUrl: typeof REALTIME_CALLS_URL;
};

export class RealtimeSessionError extends Error {
  constructor(message = "Unable to mint a realtime session.") {
    super(message);
    this.name = "RealtimeSessionError";
  }
}

export async function mintRealtimeSessionFromConfig({
  lessonId,
  fetchImpl,
  safetyIdentifier,
}: {
  lessonId: string;
  fetchImpl?: FetchLike;
  safetyIdentifier?: string;
}): Promise<RealtimeSessionResponse> {
  const config = getServerConfig();

  return mintRealtimeSession({
    apiKey: config.openai.apiKey,
    model: config.openai.realtimeModel,
    lessonId,
    fetchImpl,
    safetyIdentifier,
  });
}

export async function mintRealtimeSession({
  apiKey,
  model,
  lessonId,
  fetchImpl = fetch,
  ttlSeconds = DEFAULT_CLIENT_SECRET_TTL_SECONDS,
  safetyIdentifier,
}: MintRealtimeSessionInput): Promise<RealtimeSessionResponse> {
  const response = await fetchImpl(REALTIME_CLIENT_SECRETS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(safetyIdentifier
        ? { "OpenAI-Safety-Identifier": safetyIdentifier }
        : {}),
    },
    body: JSON.stringify({
      expires_after: {
        anchor: "created_at",
        seconds: ttlSeconds,
      },
      session: {
        type: "realtime",
        model,
        instructions: TUTOR_INSTRUCTIONS,
        audio: {
          output: {
            voice: "marin",
          },
        },
      },
    }),
  });

  const data = await readJsonSafely(response);

  if (!response.ok) {
    throw new RealtimeSessionError();
  }

  const clientSecret = readClientSecret(data);
  const expiresAt = readExpiresAt(data);

  if (!clientSecret || !expiresAt) {
    throw new RealtimeSessionError();
  }

  return {
    clientSecret,
    model,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    lessonId,
    connectUrl: REALTIME_CALLS_URL,
  };
}

async function readJsonSafely(
  response: Response,
): Promise<RealtimeClientSecretApiResponse> {
  try {
    const data: unknown = await response.json();
    return isRecord(data) ? data : {};
  } catch {
    return {};
  }
}

function readClientSecret(
  data: RealtimeClientSecretApiResponse,
): string | null {
  if (typeof data.session?.client_secret?.value === "string") {
    return data.session.client_secret.value;
  }

  return typeof data.value === "string" ? data.value : null;
}

function readExpiresAt(data: RealtimeClientSecretApiResponse): number | null {
  if (typeof data.session?.client_secret?.expires_at === "number") {
    return data.session.client_secret.expires_at;
  }

  return typeof data.expires_at === "number" ? data.expires_at : null;
}

function isRecord(value: unknown): value is RealtimeClientSecretApiResponse {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
