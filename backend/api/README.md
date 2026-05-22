# Profesor IA Go API

This service is the future backend boundary for durable product capabilities.

Current slice:

- `GET /healthz` — process health.
- `GET /readyz` — readiness without external dependencies yet.
- No PostgreSQL connection yet.
- No product behavior migrated yet.

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

Do not add database URLs, provider tokens, Realtime client secrets, or raw provider responses to logs or docs.
