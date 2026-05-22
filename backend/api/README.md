# Profesor IA Go API

This service is the future backend boundary for durable product capabilities.

Current slice:

- `GET /healthz` — process health.
- `GET /readyz` — readiness with optional PostgreSQL health when `POSTGRES_URL` is configured.
- `POST /v1/progress/awards` — records a server-trusted lesson completion XP award when PostgreSQL is configured.
- Progress award domain and persistence exist in Go, but the current Next.js lesson UI is not integrated yet.
- No auth, curriculum, or avatar-live behavior has moved to Go yet.

## Local commands

```bash
cd backend/api
go test ./...
go run ./cmd/server
```

Optional non-secret configuration names:

| Name | Purpose | Default |
| --- | --- | --- |
| `GO_API_ADDR` | HTTP listen address | `:8080` |
| `GO_API_VERSION` | Safe version label returned by health endpoints | `dev` |
| `POSTGRES_URL` | Server-only PostgreSQL connection string | unset |

When `POSTGRES_URL` is unset, `/readyz` reports `postgres: not_configured` and remains ready. The progress award endpoint returns `progress_awards_unavailable` until PostgreSQL is configured. When `POSTGRES_URL` is set, startup and readiness validate database availability without logging the connection string.

## Progress award request

```json
{
  "attemptId": "attempt-1",
  "anonymousProgressId": "anonymous-1",
  "evidence": {
    "verified": true,
    "learnerTurns": 1,
    "feedbacks": 1,
    "interrupted": false
  }
}
```

Use exactly one identity per request: `userId` or `anonymousProgressId`.

Do not add database URLs, provider tokens, Realtime client secrets, or raw provider responses to logs or docs.
