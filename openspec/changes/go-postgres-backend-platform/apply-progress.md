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

### Phase 2b: Go PostgreSQL Connection Foundation

Added Go connection/readiness support for PostgreSQL without migrating product behavior.

Files changed/added:

- `backend/api/go.mod`
- `backend/api/internal/database/postgres.go`
- `backend/api/internal/database/postgres_test.go`
- `backend/api/internal/server/server.go`
- `backend/api/internal/server/server_test.go`
- `backend/api/cmd/server/main.go`
- `backend/api/README.md`

Behavior added:

- Uses `github.com/jackc/pgx/v5` as the PostgreSQL driver/pool library.
- Reads `POSTGRES_URL` server-side only.
- Starts without PostgreSQL when `POSTGRES_URL` is unset.
- Reports `/readyz` as `postgres: not_configured` when no database is configured.
- Pings PostgreSQL on startup and readiness when `POSTGRES_URL` is configured.
- Returns degraded readiness without exposing database URL if PostgreSQL is unavailable.
- Adds deterministic fake-pinger unit tests for database checks and readiness states.

### Phase 3a: Go Progress Domain

Added Go domain rules for server-trusted XP awards without changing current Next.js lesson behavior.

Files added:

- `backend/api/internal/progress/progress.go`
- `backend/api/internal/progress/progress_test.go`

Behavior added:

- Preserves the current completion XP amount: 50 XP.
- Awards XP only when completion evidence is verified, not interrupted, has at least one learner turn, and has at least one feedback event.
- Denies awards with explicit reasons for unverified, interrupted, missing learner turn, and missing feedback cases.
- Applies awards idempotently by attempt ID in the domain snapshot.
- Adds deterministic unit tests for all award/deny paths.

### Phase 3b: Progress Award Repository

Added a PostgreSQL repository boundary for writing server-trusted progress awards.

Files added:

- `backend/api/internal/progress/repository.go`
- `backend/api/internal/progress/repository_test.go`

Behavior added:

- Records awarded decisions into `progress_awards`.
- Uses `ON CONFLICT (attempt_id) DO NOTHING` to preserve idempotency at the persistence layer.
- Supports exactly one identity per award: `user_id` or `anonymous_progress_id`.
- Skips denied awards without database writes.
- Rejects missing attempt IDs and ambiguous/missing identities.
- Adds deterministic fake-store unit tests using pgx command tags.

### Phase 3c: Progress Award Endpoint

Added a Go HTTP endpoint for recording server-trusted progress awards through the existing domain and repository boundary.

Files changed/added:

- `backend/api/internal/progress/handler.go`
- `backend/api/internal/progress/handler_test.go`
- `backend/api/internal/server/server.go`
- `backend/api/internal/server/progress_awards_test.go`
- `backend/api/internal/database/postgres.go`
- `backend/api/cmd/server/main.go`
- `backend/api/README.md`

Behavior added:

- `POST /v1/progress/awards` accepts strict JSON completion evidence.
- The endpoint awards only server-validated completion evidence and returns denial reasons for incomplete evidence.
- The endpoint writes through `PostgresAwardRepository` when `POSTGRES_URL` is configured.
- The endpoint returns `progress_awards_unavailable` when PostgreSQL is not configured.
- The response reports whether an award was newly inserted or was already idempotently recorded.
- Recorder/storage errors are mapped to safe public error codes without leaking database URLs or provider details.
- Added unit coverage for handler success, denied evidence, invalid requests, unavailable repository, hidden storage errors, unsupported methods, and mux route integration.

Important boundaries:

- No `/lesson` UI integration yet.
- No browser access to PostgreSQL.
- No auth/session behavior yet.
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

This session could not run local shell commands because command execution is unavailable in the Codex desktop thread. Run the gates locally or in CI before PR/merge. `go.sum` may need to be generated by `go mod tidy` when local verification runs.

## Deferred

- Real repository-layer tests against migrated schema.
- Durable progress migration from Next.js process memory to Go.
- Auth/session ownership.
- RAIO/YouTalk curriculum seed/import workflow.
- Live avatar event bridge.

## Next Recommended

Run local verification, generate `go.sum` if needed, then continue with a small integration slice that lets the current Next.js `/lesson` completion flow call the Go progress award endpoint without breaking the existing in-memory fallback.
