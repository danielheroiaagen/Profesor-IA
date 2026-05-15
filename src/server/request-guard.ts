import "server-only";

import { NextResponse } from "next/server";

export function enforceSameOriginRequest(
  request: Request,
): NextResponse | null {
  const origin = request.headers.get("origin");
  const secFetchSite = request.headers.get("sec-fetch-site");

  if (secFetchSite === "cross-site") {
    return forbiddenResponse();
  }

  if (!origin) {
    return null;
  }

  const requestUrl = new URL(request.url);
  const originUrl = safeUrl(origin);

  if (!originUrl || originUrl.origin !== requestUrl.origin) {
    return forbiddenResponse();
  }

  return null;
}

function forbiddenResponse() {
  return NextResponse.json(
    {
      error: {
        code: "cross-site-request-denied",
        message: "Cross-site requests are not allowed for this endpoint.",
      },
    },
    { status: 403 },
  );
}

function safeUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
