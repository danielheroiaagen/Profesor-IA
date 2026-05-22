# Apply Progress: Go Backend + PostgreSQL Platform

## Status

completed-slices

## Completed Slices

### Phase 1: Go Backend Foundation

Implemented a minimal Go backend service under `backend/api/*`.

Files added:

- `backend/api/go.mod`
- `backend/api/cmd/server/main.go`
- `backend/api/internal/server/server.go`
- `backend/api/internal/server/server_test.go`
- `backend/api/README.md`

Behavior added:

- `GET /healthz` returns safe JSON process health.
- `GET /readyz` returns safe JSON readiness with only the current HTTP check.
- Unsupported methods on health routes are rejected by the Go HTTP mux.
- Basic response hardening headers are applied: `X-Content-Type-Options: nosniff` and `Cache-Control: no-store`.
- The service uses non-secret configuration names only: `GO_API_ADDR`, `GO_API_VERSION`.

### Phase 2: PostgreSQL Migration Foundation

Added a migration-only PostgreSQL foundation under `db/*`.

Files added:

- `db/README.md`
- `db/migrations/0001_learning_core.up.sql`
- `db/migrations/0001_learning_core.down.sql`

Schema areas added:

- users and server-managed sessions,
- curriculum units and lesson plans,
- lesson attempts and lesson events,
- visible feedback events,
- idempotent XP progress awards.

Important boundaries:

- No Go database connection yet.
- No production progress migration yet.
- No browser access to PostgreSQL.
- No avatar-live behavior included.

## Verification

Planned Go gate:

```bash
cd backend/api
go test ./...
```

Planned PostgreSQL migration gate:

```bash
createdb profesor_ia_dev
export POSTGRES_URL="postgres://USER:PASSWORD@localhost:5432/profesor_ia_dev?sslmode=disable"
psql "$POSTGRES_URL" -f db/migrations/0001_learning_core.up.sql
psql "$POSTGRES_URL" -f db/migrations/0001_learning_core.down.sql
```

This session could not run local shell commands because command execution is unavailable in the Codex desktop thread. Run the gates locally or in CI before PR/merge.

## Deferred

- Repository-layer tests with a safe test database strategy.
- Go PostgreSQL connection and health readiness dependency checks.
- Durable progress migration.
- Auth/session ownership.
- RAIO/YouTalk curriculum seed/import workflow.
- Live avatar event bridge.

## Next Recommended

Review the chained PRs in order, then continue with a small slice for PostgreSQL repository tests and connection handling before moving progress persistence.
