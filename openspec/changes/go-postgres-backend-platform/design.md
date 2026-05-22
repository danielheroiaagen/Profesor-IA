# Design: Go Backend + PostgreSQL Platform

## Technical Approach

Use a staged migration. The current Next.js MVP remains deployable and validated. A new Go backend is introduced as a separate service that gradually takes ownership of durable product capabilities.

```text
Browser
  -> Next.js frontend (/lesson)
  -> current Next.js API routes during transition
  -> Go API for durable product capabilities
  -> PostgreSQL
```

The Go backend becomes the durable system of record. Next.js remains the browser-facing UI and can act as a temporary bridge while endpoints are migrated.

## Architecture Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Backend language | Go | User-selected backend direction; strong fit for API boundaries, tests, deployable services, and predictable performance. |
| Data store | PostgreSQL | User-selected replacement for Supabase; durable relational model fits users, attempts, XP awards, curriculum, and lesson events. |
| Migration style | Strangler migration | Preserve validated MVP behavior while moving one backend capability at a time. |
| First Go slice | Health/readiness only | Proves toolchain, deployment, tests, and service boundary without touching product behavior. |
| Browser access | No direct DB access | Browser never receives PostgreSQL URLs or backend secrets. |
| Avatar live behavior | Separate spec | Avatar speech/gesture/interruption is high-risk and must not ride along with backend migration. |

## Target Runtime Boundaries

### Next.js frontend

- Renders landing and `/lesson` UI.
- Owns current Realtime browser/WebRTC client code during transition.
- Calls Go API through server-safe configuration or controlled browser-safe endpoints.
- Must not receive PostgreSQL credentials.

### Go backend

- Owns durable progress and XP award persistence.
- Owns auth/session once Phase 2 reaches that slice.
- Owns curriculum APIs for RAIO/YouTalk lesson plans.
- Owns lesson-attempt and correction history.
- Later may own avatar orchestration if a separate avatar spec approves it.

### PostgreSQL

Initial data areas:

- users
- sessions or auth identities
- curriculum_units
- lesson_plans
- lesson_attempts
- lesson_events
- feedback_events
- progress_awards
- learner_progress_snapshots or computed views

## Migration Strategy

### Slice 1: Go foundation

- Add `backend/api/*` Go module.
- Add `/healthz` and `/readyz`.
- Add deterministic Go tests.
- Add docs for running the service locally.
- No product behavior change.

### Slice 2: PostgreSQL foundation

- Add `db/migrations/*`.
- Add local dev PostgreSQL setup.
- Add database connection configuration by variable name only.
- Add repository tests using an approved local/test database strategy.

### Slice 3: Durable progress

- Replace process-local anonymous progress with Go-backed PostgreSQL progress.
- Preserve idempotent XP awards by lesson ID.
- Keep XP server-trusted.
- Preserve current UI states and acceptance evidence.

### Slice 4: Auth/session

- Add server-managed sessions or approved external identity provider mediated by Go.
- Associate progress with user identity.
- Keep cookies httpOnly, sameSite, secure in production.

### Slice 5: Curriculum

- Model RAIO/YouTalk lesson units, phonetic focus, matrix drills, story prompts, rubrics, and correction criteria.
- Keep generated lesson prompts auditable and versioned.

### Slice 6: Avatar event bridge

- Only after avatar-live spec approval.
- Translate tutor events into avatar actions such as greeting, listening, speaking, correcting, celebrating, or fallback.
- Do not let avatar failure break the Realtime voice lesson.

## Security Model

- `POSTGRES_URL` is server-only.
- `GO_API_INTERNAL_URL` is server-only unless an endpoint is explicitly public.
- Realtime client secrets remain short-lived and never logged.
- Provider session tokens stay server-mediated.
- Evidence docs record only visible product states and variable names.

## API Contract Direction

Prefer explicit, small JSON contracts before generated clients. Introduce generation only after contracts stabilize.

Early examples:

```text
GET /healthz
GET /readyz
GET /v1/progress/me
POST /v1/lessons/:lessonId/attempts/:attemptId/evidence
POST /v1/lessons/:lessonId/attempts/:attemptId/complete
```

## Testing Strategy

| Layer | Gate |
| --- | --- |
| Current Next.js MVP | `npm run verify` |
| Go backend | `go test ./...` |
| PostgreSQL migrations | migration up/down or forward-only validation defined in the implementation slice |
| Integration | Next.js calls Go API in a local/deployed smoke path |
| Live product | Browser/audio validation from `docs/browser-audio-validation.md` |

## Rollout / Rollback

- Keep the current MVP deployable during the Go migration.
- Ship Go foundation before product behavior moves.
- Add database migrations only with rollback/forward-fix notes.
- If Go progress migration fails, rollback to the previous process-local MVP only before public user data depends on PostgreSQL.
