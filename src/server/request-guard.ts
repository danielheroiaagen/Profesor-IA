import "server-only";

import { NextResponse } from "next/server";

export function enforceSameOriginRequest(
  request: Request,
): NextResponse | null {
  const origin = request.headers.get("origin");
  const secFetchSite = request.headers.get("sec-fetch-site");
  const requestUrl = new URL(request.url);

  if (origin) {
    const originUrl = safeUrl(origin);

    if (!originUrl || !sameTrustedOrigin(originUrl, requestUrl)) {
      return forbiddenResponse();
    }

    return null;
  }

  if (secFetchSite === "cross-site") {
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

function sameTrustedOrigin(originUrl: URL, requestUrl: URL): boolean {
  if (originUrl.origin === requestUrl.origin) return true;

  return (
    originUrl.protocol === requestUrl.protocol &&
    originUrl.port === requestUrl.port &&
    isLoopbackHost(originUrl.hostname) &&
    isLoopbackHost(requestUrl.hostname)
  );
}

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}
