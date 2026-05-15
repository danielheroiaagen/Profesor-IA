import "server-only";

const rateLimitStoreKey = "__profesorIaRateLimitStore";

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

export type RateLimitPolicy = {
  name: string;
  limit: number;
  windowMs: number;
};

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

const store = getProcessRateLimitStore();

export const rateLimitPolicies = {
  lessonStart: { name: "lesson-start", limit: 20, windowMs: 60_000 },
  realtimeSession: { name: "realtime-session", limit: 10, windowMs: 60_000 },
  liveAvatarSession: {
    name: "live-avatar-session",
    limit: 10,
    windowMs: 60_000,
  },
  lessonEvidence: { name: "lesson-evidence", limit: 60, windowMs: 60_000 },
  lessonCompletion: { name: "lesson-completion", limit: 20, windowMs: 60_000 },
} as const satisfies Record<string, RateLimitPolicy>;

export function checkRateLimit({
  request,
  policy,
  scope,
  now = Date.now(),
}: {
  request: Request;
  policy: RateLimitPolicy;
  scope?: string;
  now?: number;
}): RateLimitResult {
  const key = createRateLimitKey({ request, policy, scope });
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + policy.windowMs });
    return { allowed: true };
  }

  if (current.count >= policy.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  store.set(key, current);
  return { allowed: true };
}

export function resetRateLimitsForTests() {
  store.clear();
}

function createRateLimitKey({
  request,
  policy,
  scope,
}: {
  request: Request;
  policy: RateLimitPolicy;
  scope?: string;
}) {
  return [policy.name, readClientIp(request), scope?.trim() || "global"].join(
    ":",
  );
}

function readClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstForwardedIp = forwardedFor?.split(",")[0]?.trim();

  return (
    firstForwardedIp ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    "unknown-client"
  );
}

function getProcessRateLimitStore(): Map<string, RateLimitRecord> {
  const processGlobal = globalThis as typeof globalThis & {
    [rateLimitStoreKey]?: Map<string, RateLimitRecord>;
  };

  processGlobal[rateLimitStoreKey] ??= new Map<string, RateLimitRecord>();

  return processGlobal[rateLimitStoreKey];
}
