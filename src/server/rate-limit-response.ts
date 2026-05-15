import "server-only";

import { NextResponse } from "next/server";

import { checkRateLimit, type RateLimitPolicy } from "@/server/rate-limit";

export function checkRateLimitResponse({
  request,
  policy,
  scope,
}: {
  request: Request;
  policy: RateLimitPolicy;
  scope?: string;
}): NextResponse | null {
  const result = checkRateLimit({ request, policy, scope });

  if (result.allowed) {
    return null;
  }

  return NextResponse.json(
    {
      error: {
        code: "rate-limit-exceeded",
        message: "Too many requests. Please wait before retrying.",
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
      },
    },
  );
}
