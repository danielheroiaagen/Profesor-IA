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
- Reference configuration by name only: `OPENAI_API_KEY`, `OPENAI_REALTIME_MODEL`, `LIVEAVATAR_API_KEY`, `HEYGEN_API_KEY`, `HEYGEN_AVATAR_ID`.
- Browser code must never receive primary OpenAI, LiveAvatar, HeyGen, Supabase service-role, database, or storage keys.
- Browser access must use ephemeral OpenAI credentials, Supabase anon/RLS-safe access, or server-mediated avatar credentials.
- Realtime client secrets, SDP payloads, lesson access tokens, provider session tokens, and raw provider responses must not be logged into docs, PRs, screenshots, or telemetry.

## Deployment Decision

Default production direction:

| Layer                       | Recommended choice                                                                                 | Reason                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| App hosting                 | Hostinger VPS with Docker/PM2 + reverse proxy, or Vercel if speed matters more than server control | Next.js route handlers need a normal Node/Next runtime.                           |
| Database/Auth/Storage       | Supabase hosted                                                                                    | Fastest professional path with managed Postgres, Auth, Storage, backups, and RLS. |
| Self-hosted Supabase on VPS | Not first choice                                                                                   | Higher ops burden: backups, upgrades, Auth, Storage, Realtime, security patches.  |
| Standalone managed Postgres | Good later if Supabase services are not needed                                                     | Use when Auth/Storage/RLS are replaced by custom services.                        |

Do **not** self-host Supabase on Hostinger VPS for the first real-product release unless the user explicitly accepts the operational cost. Prefer Supabase hosted for Postgres/Auth/Storage and keep the app runtime separate.

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
- database schema redesign,
- avatar-speaking behavior,
- Agents SDK or GPT Image.

Acceptance evidence:

- `npm run verify` passes,
- readiness endpoint is `ready`,
- browser validation records `voz lista`, `gpt-realtime-2 · credencial limitada`, `Prácticas: 1 · Feedback: 1`, `sesión cerrada`, and `+50 XP ganados`,
- no secret values appear in artifacts.

### Phase 2 — Auth and durable progress

Goal: replace process-local anonymous progress with real user-owned durable progress.

Recommended stack:

- Supabase hosted Postgres,
- Supabase Auth,
- Row Level Security,
- migrations checked into the repo,
- server-side progress award rules.

Rules:

- Keep XP awarding server-trusted.
- Never trust client-submitted XP totals.
- Browser may use Supabase anon access only with RLS-safe policies.
- Service-role keys stay server-only.

### Phase 3 — Real curriculum and longer lessons

Goal: turn the single short demo lesson into a real learning product.

Include:

- lesson units and levels,
- attempt history,
- visible correction history,
- teacher prompts/instructions by level,
- progress milestones.

Rules:

- Keep domain rules in `src/domain/*`.
- Keep persistence access in `src/server/*` or dedicated data modules.
- Keep vendor calls in `src/integrations/*`.

### Phase 4 — Advanced avatar, only after a new spec

Goal: decide whether the avatar remains visual-only or becomes speaking/synchronized.

Allowed only with a new approved issue/spec.

Options to evaluate one at a time:

| Pattern                                | Status                                                    |
| -------------------------------------- | --------------------------------------------------------- |
| Realtime audio primary + silent avatar | Current safe default.                                     |
| Realtime text to avatar TTS            | Future spike; higher latency and interruption complexity. |
| Realtime audio to avatar lipsync       | Future spike; highest sync and provider risk.             |

Do not add `/api/avatar/speak`, `/api/avatar/interrupt`, avatar microphone access, or avatar TTS inside unrelated PRs.

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

- Product rules: `src/domain/*`.
- Server state and persistence: `src/server/*` or adjacent server-only modules.
- Vendor calls: `src/integrations/*`.
- Server-only config: `src/config/server.ts` or adjacent server-only modules.
- Browser UI: `app/*` client/server components with explicit boundaries.
- Tests should live beside the behavior area under `tests/*`.

## Review Budget and PR Strategy

- Keep PR slices under 400 changed lines when practical.
- Use one deliverable work unit per PR.
- Keep tests with the behavior they verify.
- Before merging to `main`, every PR must link an approved issue and have exactly one `type:*` label.
- Do not create a large rollup PR unless the user explicitly accepts a `size:exception`.

## Quality Bar

Before marking work ready:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Before release or merge of substantial work:

```bash
npm run verify
OPENAI_API_KEY=ci-readiness-placeholder npm run smoke:readiness:server
```

For deploy/public launch, also run the real browser/audio workflow in `docs/browser-audio-validation.md`.

## Agent Behavior Rules

- Do not expand scope from one phase into the next.
- Do not implement avatar-speaking, Agents SDK, GPT Image, or durable database work without a new approved issue/spec.
- When touching auth, database, storage, or payments, prefer a short design note before code.
- When in doubt, preserve the current safe MVP behavior and ask for a decision.
