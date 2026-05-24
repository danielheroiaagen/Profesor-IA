import { getServerConfig } from "@/config/server";
import {
  buildRaioRealtimeTutorInstructions,
  getDefaultRaioSpeakingLesson,
  type RaioSpeakingLesson,
} from "@/domain/raio-curriculum";

const REALTIME_CLIENT_SECRETS_URL =
  "https://api.openai.com/v1/realtime/client_secrets";
const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
const DEFAULT_CLIENT_SECRET_TTL_SECONDS = 600;

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
  lessonPlan?: RaioSpeakingLesson;
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
  lessonPlan,
  fetchImpl,
  safetyIdentifier,
}: {
  lessonId: string;
  lessonPlan?: RaioSpeakingLesson;
  fetchImpl?: FetchLike;
  safetyIdentifier?: string;
}): Promise<RealtimeSessionResponse> {
  const config = getServerConfig();

  return mintRealtimeSession({
    apiKey: config.openai.apiKey,
    model: config.openai.realtimeModel,
    lessonId,
    lessonPlan,
    fetchImpl,
    safetyIdentifier,
  });
}

export async function mintRealtimeSession({
  apiKey,
  model,
  lessonId,
  lessonPlan = getDefaultRaioSpeakingLesson(),
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
        instructions: buildRaioRealtimeTutorInstructions(lessonPlan),
        audio: {
          input: {
            transcription: {
              model: "gpt-4o-mini-transcribe",
              language: "en",
              prompt:
                "The learner is practicing short A1 English phrases in a guided lesson.",
            },
            turn_detection: {
              type: "server_vad",
              create_response: true,
              interrupt_response: true,
            },
          },
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
