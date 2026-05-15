import { NextResponse } from "next/server";

import {
  LiveAvatarSessionError,
  mintLiveAvatarSessionFromConfig,
} from "@/integrations/avatar/liveavatar";

export async function POST() {
  try {
    const liveAvatar = await mintLiveAvatarSessionFromConfig();

    return NextResponse.json({ liveAvatar }, { status: 201 });
  } catch (error) {
    const code =
      error instanceof LiveAvatarSessionError
        ? error.reason
        : "avatar-live-session-failed";

    return NextResponse.json(
      {
        error: {
          code,
          message:
            "Live avatar session could not start. Voice mode remains available.",
        },
      },
      { status: 502 },
    );
  }
}
