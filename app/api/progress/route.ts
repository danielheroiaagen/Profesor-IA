import { NextResponse } from "next/server";

import {
  getOrCreateAnonymousProgressId,
  readAnonymousProgress,
  writeAnonymousProgressCookie,
} from "@/server/progress-store";
import { enforceSameOriginRequest } from "@/server/request-guard";

export async function GET(request: Request) {
  const crossSiteBlocked = enforceSameOriginRequest(request);

  if (crossSiteBlocked) {
    return crossSiteBlocked;
  }

  const progressId = getOrCreateAnonymousProgressId(request);
  const response = NextResponse.json({
    progress: readAnonymousProgress(progressId),
  });

  writeAnonymousProgressCookie({
    response,
    request,
    progressId,
  });

  return response;
}
