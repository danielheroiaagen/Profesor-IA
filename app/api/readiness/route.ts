import { NextResponse } from "next/server";

import { getSafeConfigStatus } from "@/config/server";

export function GET() {
  const config = getSafeConfigStatus();
  const ready = config.openaiApiKeyConfigured;

  return NextResponse.json(
    {
      status: ready ? "ready" : "degraded",
      checks: {
        openaiApiKeyConfigured: config.openaiApiKeyConfigured,
        heygenApiKeyConfigured: config.heygenApiKeyConfigured,
        liveAvatarApiKeyConfigured: config.liveAvatarApiKeyConfigured,
      },
      realtime: {
        model: config.openaiRealtimeModel,
      },
      avatar: {
        configured: Boolean(config.heygenAvatarId),
        providerConfigured:
          config.heygenApiKeyConfigured || config.liveAvatarApiKeyConfigured,
        liveProviderConfigured: config.liveAvatarApiKeyConfigured,
      },
    },
    {
      status: ready ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
