# Apply Progress: Go Backend + PostgreSQL Platform

## Status

completed-slice

## Completed Slice

### Phase 1: Go Backend Foundation

Implemented a minimal Go backend service under `backend/api/*`.

Files added:

- `backend/api/go.mod`
- `backend/api/cmd/server/main.go`
- `backend/api/internal/server/server.go`
- `backend/api/internal/server/server_test.go`
- `backend/api/README.md`

## Behavior Added

- `GET /healthz` returns safe JSON process health.
- `GET /readyz` returns safe JSON readiness with only the current HTTP check.
- Unsupported methods on health routes are rejected by the Go HTTP mux.
- Basic response hardening headers are applied: `X-Content-Type-Options: nosniff` and `Cache-Control: no-store`.
- The service uses non-secret configuration names only: `GO_API_ADDR`, `GO_API_VERSION`.

## Verification

Planned gate:

```bash
cd backend/api
go test ./...
```

The test suite was written for deterministic coverage, but this session could not run local shell commands because command execution is unavailable in the Codex desktop thread. Run the gate locally or in CI before PR/merge.

## Deferred

- PostgreSQL migrations and DB connection.
- Durable progress migration.
- Auth/session ownership.
- RAIO/YouTalk curriculum tables.
- Live avatar event bridge.

## Next Recommended

Run local verification, then either:

1. split this branch into reviewable chained PRs, or
2. accept a `size:exception` if keeping the docs + Go foundation in one PR.
