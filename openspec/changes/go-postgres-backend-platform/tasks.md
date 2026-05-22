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

- [ ] 2.1 Add `db/migrations/*` structure.
- [ ] 2.2 Define initial schema for users, lesson attempts, lesson events, progress awards, and curriculum units.
- [ ] 2.3 Add local development PostgreSQL setup.
- [ ] 2.4 Add database configuration by variable name only: `POSTGRES_URL`.
- [ ] 2.5 Add repository-layer tests with safe test database strategy.

## Phase 3: Durable Progress Migration

- [ ] 3.1 Preserve current XP domain rules.
- [ ] 3.2 Move progress persistence from process-local store to Go + PostgreSQL.
- [ ] 3.3 Preserve idempotent award by lesson/attempt.
- [ ] 3.4 Keep existing `/lesson` completion UI behavior valid.
- [ ] 3.5 Update tests for the new persistence boundary.

## Phase 4: Auth / Session Ownership

- [ ] 4.1 Define session model and cookie policy.
- [ ] 4.2 Associate progress with user identity.
- [ ] 4.3 Add logout/session invalidation behavior.
- [ ] 4.4 Add tests for session security and progress isolation.

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

- [ ] Current Next.js gate: `npm run verify`.
- [x] Go gate when backend exists: `go test ./...`.
- [ ] Live browser/audio validation before public release.
- [ ] Fresh-context review before PR/merge for any non-trivial implementation slice.

Note: Go files were added in the GitHub branch. Local execution is still required before merge because this session cannot run shell commands in the workspace.
