# Profesor IA — Agent Guidance

## Current Status

The technical MVP is complete and merged to `main`. The next work is the real product roadmap, not more MVP patching.

Current MVP contract:

- Short realtime English voice lesson.
- Visible correction.
- XP/progress feedback.
- Non-blocking avatar surface.
- OpenAI Realtime owns voice, microphone capture, and lesson audio.
- LiveAvatar/HeyGen remains visual-only unless a future approved spec changes that contract.

## Security Rules

- Never read, print, commit, or expose `.env` values.
- Reference configuration by name only: `OPENAI_API_KEY`, `OPENAI_REALTIME_MODEL`, `LIVEAVATAR_API_KEY`, `HEYGEN_API_KEY`, `HEYGEN_AVATAR_ID`, `POSTGRES_URL`, `GO_API_INTERNAL_URL`, `SESSION_SECRET`.
- Browser code must never receive primary OpenAI, LiveAvatar, HeyGen, PostgreSQL, database, storage, or service keys.
- Browser access must use ephemeral OpenAI credentials, server-managed session cookies, or server-mediated avatar credentials.
- Realtime client secrets, SDP payloads, lesson access tokens, provider session tokens, database URLs, and raw provider responses must not be logged into docs, PRs, screenshots, or telemetry.

## Deployment Decision

Default production direction:

| Layer                 | Recommended choice                                                                                  | Reason                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Frontend/app hosting  | Hostinger VPS with reverse proxy, or Vercel if speed matters more than server control               | Next.js remains the browser-facing frontend and can keep the current MVP route handlers during migration. |
| Backend API           | Go HTTP service                                                                                     | The real-product backend should own durable progress, auth/session, curriculum, and avatar orchestration. |
| Database              | PostgreSQL                                                                                          | User-selected durable data store; use managed Postgres for production unless VPS ops are explicitly accepted. |
| Supabase              | Not used for the product roadmap unless a future approved spec reverses this decision                | PostgreSQL + Go replaces the previous Supabase-hosted recommendation.                          |

Do **not** add Supabase Auth, Supabase client code, Supabase RLS policies, or Supabase service-role keys unless a future approved issue/spec reverses this architecture decision.

## Real Product Roadmap — Required Order

Work in this order unless the user explicitly changes priorities.

### Phase 1 — Deploy and live validation

Goal: get the merged MVP running in a real environment and prove the live voice path.

Include:

- production environment setup,
- deployed readiness smoke,
- real browser/microphone/WebRTC validation,
- secure environment-variable checklist,
- rollback notes.

Do not include:

- new product features,
- PostgreSQL schema redesign,
- Go backend migration,
- avatar-speaking behavior,
- Agents SDK or GPT Image.

Acceptance evidence:

- `npm run verify` passes,
- readiness endpoint is `ready`,
- browser validation records `voz lista`, `gpt-realtime-2 · credencial limitada`, `Prácticas: 1 · Feedback: 1`, `sesión cerrada`, and `+50 XP ganados`,
- no secret values appear in artifacts.

### Phase 2 — Go backend, PostgreSQL, auth, and durable progress

Goal: replace process-local anonymous progress with real user-owned durable progress through a Go backend and PostgreSQL.

Target stack:

- Go HTTP API service,
- PostgreSQL,
- migrations checked into the repo,
- server-managed auth/session cookies or an approved external identity provider mediated by Go,
- server-side progress award rules.

Rules:

- Keep XP awarding server-trusted.
- Never trust client-submitted XP totals.
- Browser must never receive PostgreSQL credentials.
- Next.js may temporarily proxy or call the Go API, but durable backend ownership belongs in Go.
- Prefer small migration slices: Go health/readiness -> PostgreSQL migrations -> progress persistence -> auth/session -> lesson attempts.

### Phase 3 — Real curriculum and longer lessons

Goal: turn the single short demo lesson into a real learning product using PostgreSQL-backed curriculum content.

Include:

- lesson units and levels,
- RAIO/YouTalk lesson plans,
- attempt history,
- visible correction history,
- teacher prompts/instructions by level,
- progress milestones.

Rules:

- Keep product rules in `src/domain/*` until moved behind the Go service.
- Keep Go product rules in `backend/api/internal/*` or the chosen Go service package layout.
- Keep persistence access in Go repositories backed by PostgreSQL.
- Keep vendor calls in `src/integrations/*` during migration, then move backend-owned integrations to Go only with an approved spec.

### Phase 4 — Advanced avatar, only after a new spec

Goal: decide whether the avatar remains visual-only or becomes speaking/synchronized.

Allowed only with a new approved issue/spec.

Options to evaluate one at a time:

| Pattern                                | Status                                                    |
| -------------------------------------- | --------------------------------------------------------- |
| Realtime audio primary + silent avatar | Current safe default.                                     |
| Realtime text to avatar TTS            | Future spike; higher latency and interruption complexity. |
| Realtime audio to avatar lipsync       | Future spike; highest sync and provider risk.             |

Do not add `/api/avatar/speak`, `/api/avatar/interrupt`, avatar microphone access, or avatar TTS inside unrelated PRs. If implemented later, avatar orchestration should be backend-mediated and compatible with the Go API boundary.

### Phase 5 — Agents SDK, tools, and GPT Image

Goal: add agentic tool workflows only after the core learning loop is deployed and validated.

Possible future tools:

- curriculum search,
- personalized practice generation,
- GPT Image visual learning cards,
- teacher analytics,
- admin workflows.

Rules:

- Tool execution must be backend-mediated.
- Add guardrails, validation, timeouts, and audit logs before tool actions.
- GPT Image must use backend routes and private/signed storage URLs.
- Do not expose OpenAI primary keys or raw generated asset payloads to unsafe clients.

## Code Organization

- Product rules: `src/domain/*` until migrated.
- Current Next.js server state and persistence: `src/server/*` or adjacent server-only modules.
- Future Go backend: `backend/api/*`.
- Future PostgreSQL migrations: `db/migrations/*`.
- Vendor calls: `src/integrations/*` during the MVP; move to Go only through approved specs.
- Server-only config: `src/config/server.ts` or adjacent server-only modules.
- Browser UI: `app/*` client/server components with explicit boundaries.
- Tests should live beside the behavior area under `tests/*`; future Go tests should live with Go packages.

## Review Budget and PR Strategy

- Keep PR slices under 400 changed lines when practical.
- Use one deliverable work unit per PR.
- Keep tests with the behavior they verify.
- Before merging to `main`, every PR must link an approved issue and have exactly one `type:*` label.
- Do not create a large rollup PR unless the user explicitly accepts a `size:exception`.

## Quality Bar

Before marking current Next.js work ready:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Before release or merge of substantial current work:

```bash
npm run verify
OPENAI_API_KEY=ci-readiness-placeholder npm run smoke:readiness:server
```

When Go backend code exists, also run the Go test/build gate defined by that change, starting with:

```bash
go test ./...
```

For deploy/public launch, also run the real browser/audio workflow in `docs/browser-audio-validation.md`.

## Agent Behavior Rules

- Do not expand scope from one phase into the next.
- Do not implement avatar-speaking, Agents SDK, GPT Image, or durable database work without a new approved issue/spec.
- When touching auth, database, storage, or payments, prefer a short design note before code.
- When in doubt, preserve the current safe MVP behavior and ask for a decision.
