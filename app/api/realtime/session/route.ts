import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { mintRealtimeSessionFromConfig, RealtimeSessionError } from "@/integrations/openai/realtime";

type RealtimeSessionRequest = {
  lessonId?: string;
};

export async function POST(request: Request) {
  const body = await readRequestBody(request);
  const lessonId = readLessonId(body) ?? randomUUID();

  try {
    const realtime = await mintRealtimeSessionFromConfig({
      lessonId,
      safetyIdentifier: lessonId,
    });

    return NextResponse.json({ realtime }, { status: 201 });
  } catch (error) {
    const code = error instanceof RealtimeSessionError ? "realtime-session-unavailable" : "realtime-session-failed";

    return NextResponse.json(
      {
        error: {
          code,
          message: "Voice session could not start. Please retry.",
        },
      },
      { status: 502 },
    );
  }
}

async function readRequestBody(request: Request): Promise<RealtimeSessionRequest> {
  try {
    const data: unknown = await request.json();
    return isRecord(data) ? data : {};
  } catch {
    return {};
  }
}

function readLessonId(body: RealtimeSessionRequest): string | null {
  return typeof body.lessonId === "string" && body.lessonId.trim() ? body.lessonId.trim() : null;
}

function isRecord(value: unknown): value is RealtimeSessionRequest {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
