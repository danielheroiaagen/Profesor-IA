# Tasks: Go Backend + PostgreSQL Platform

## Review Workload Forecast

| Field | Value |
| --- | --- |
| Estimated changed lines | 800-2000 across the full platform migration |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | docs decision -> Go skeleton -> PostgreSQL foundation -> durable progress -> auth/session -> curriculum -> avatar bridge |
| Delivery strategy | ask-on-risk |

Decision needed before apply: Yes for any slice that exceeds the 400-line review budget.
Chained PRs recommended: Yes.
400-line budget risk: High.

## Phase 0: Architecture Decision

- [x] 0.1 Verify current repo roadmap and MVP contract.
- [x] 0.2 Replace Supabase product direction with PostgreSQL + Go backend in project guidance.
- [x] 0.3 Update deployment guidance with the new platform target.
- [x] 0.4 Add SDD proposal/design/tasks for the Go PostgreSQL platform change.

## Phase 1: Go Backend Foundation

- [x] 1.1 Add Go module under `backend/api/*`.
- [x] 1.2 Add `/healthz` and `/readyz` endpoints.
- [x] 1.3 Add deterministic `go test ./...` coverage.
- [x] 1.4 Document local run commands without secrets.
- [x] 1.5 Add CI/local verification note for Go backend.

## Phase 2: PostgreSQL Foundation

- [x] 2.1 Add `db/migrations/*` structure.
- [x] 2.2 Define initial schema for users, lesson attempts, lesson events, progress awards, and curriculum units.
- [x] 2.3 Add local development PostgreSQL setup.
- [x] 2.4 Add database configuration by variable name only: `POSTGRES_URL`.
- [x] 2.5 Add PostgreSQL connection checks with safe fake-pinger tests.

## Phase 3: Durable Progress Migration

- [x] 3.1 Preserve current XP domain rules in Go.
- [x] 3.2 Add PostgreSQL repository for idempotent progress awards.
- [x] 3.3 Preserve idempotent award by lesson/attempt at the domain and repository layers.
- [x] 3.4 Keep existing `/lesson` completion UI behavior valid.
- [x] 3.5 Add tests for the new progress award persistence boundary.
- [x] 3.6 Add Go API endpoint for server-trusted progress awards.
- [x] 3.7 Bridge Next.js lesson completion to the Go progress award endpoint with in-memory fallback.

## Phase 4: Auth / Session Ownership

- [x] 4.1 Define session model and cookie policy.
- [x] 4.2 Add session persistence repository with hashed-token identity lookup.
- [ ] 4.3 Associate progress awards with resolved user identity.
- [x] 4.4 Add repository-level session invalidation behavior.
- [ ] 4.5 Add logout endpoint and session cookie clearing.
- [ ] 4.6 Add tests for session security and progress isolation.

## Phase 5: RAIO / YouTalk Curriculum

- [ ] 5.1 Define lesson plan schema: level, objective, phonetic focus, linking rule, matrix drill, story prompt, rubric, correction criteria.
- [ ] 5.2 Add curriculum seed/import strategy.
- [ ] 5.3 Add API for selecting the next lesson.
- [ ] 5.4 Keep prompts auditable and versioned.

## Phase 6: Live Avatar Event Bridge

- [ ] 6.1 Write separate avatar-live spec before implementation.
- [ ] 6.2 Define Realtime tutor event -> avatar action contract.
- [ ] 6.3 Add backend-mediated avatar action endpoints only after provider spike.
- [ ] 6.4 Preserve fallback: avatar failure must not break voice lesson.

## Verification Gates

- [x] Chained GitHub Actions gate: Next.js verify/readiness plus Go `go mod tidy` and `go test ./...`.
- [x] Go gate when backend exists: `go test ./...`.
- [ ] PostgreSQL migration gate: apply `db/migrations/0001_learning_core.up.sql` against a local test database.
- [ ] Live browser/audio validation before public release.
- [ ] Fresh-context review before PR/merge for any non-trivial implementation slice.

Note: GitHub Actions now verifies the Go backend on chained PRs. Local shell execution remains unavailable in this Codex desktop thread, so local-only database migration gates still need a separate environment.
