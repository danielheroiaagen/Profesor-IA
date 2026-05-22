# Public deployment runbook

Profesor IA is ready for a public deployment only after the deployed URL proves the same gates that passed locally: readiness, real browser/audio, XP, avatar fallback safety, and no secret leakage.

## Quick path

1. Deploy the GitHub `main` branch to the chosen Next.js runtime.
2. Add server-side environment variable names in the provider/VPS secret manager.
3. Run deployed readiness smoke against `/api/readiness`.
4. Run one live browser/audio lesson on the deployed `/lesson` URL.
5. Update `docs/release-evidence.md` with the deployed URL result.

## Platform target decision

The current MVP can still be deployed as the existing Next.js app. The real-product platform direction after this decision is **Next.js frontend + Go backend + PostgreSQL**.

| Option                      | Decision                    | Why                                                                                                        |
| --------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Hostinger VPS app runtime   | Recommended for Phase 1     | Gives server control for `next start`, reverse proxy, logs, and future Go service co-location if needed.  |
| Go backend API              | Recommended for Phase 2     | Owns durable progress, auth/session, curriculum, lesson attempts, and later avatar orchestration.         |
| PostgreSQL                  | Recommended for Phase 2     | User-selected durable data store; use managed Postgres in production unless VPS database ops are accepted. |
| Supabase hosted             | Removed from roadmap        | Replaced by standalone PostgreSQL plus Go backend.                                                         |
| Self-hosted Supabase        | Do not use                  | Adds Supabase-specific operational complexity that no longer matches the selected architecture.            |
| Vercel                      | Valid frontend fallback     | Fastest Next.js deployment if server control is less important than speed.                                 |

The Phase 1 deployment does not require PostgreSQL or Go backend credentials yet. Phase 2 starts when durable auth/progress replaces process-local anonymous progress.

## Hostinger VPS app runtime

Recommended first VPS shape for the current MVP:

- Ubuntu LTS VPS.
- Node.js 22 LTS.
- `npm ci`, `npm run build`, `npm run start` or PM2-managed `next start`.
- Nginx or Caddy as HTTPS reverse proxy.
- Environment variables stored in the VPS provider/secrets mechanism, not in the repo.
- Optional deploy user with least privilege.

Minimal deployment flow:

```bash
git clone <repo-url> profesor-ia
cd profesor-ia
npm ci
npm run verify
npm run build
OPENAI_API_KEY=ci-readiness-placeholder npm run smoke:readiness:server
```

Then configure the real server-only environment variable values outside the repo and start the production app:

```bash
npm run start
```

Use PM2/systemd only after the manual production smoke is understood.

## Future Go + PostgreSQL runtime

When Phase 2 begins, add the Go backend as a separately testable service rather than mixing large backend migration work into the deployed MVP validation.

Target runtime shape:

- Next.js frontend service.
- Go HTTP API service.
- PostgreSQL database.
- Reverse proxy routes public traffic to Next.js and internal API traffic to Go.
- Go owns durable progress, auth/session, curriculum, lesson attempts, and backend-mediated provider actions approved by spec.

Recommended rollout order:

1. Add Go health/readiness endpoint and deterministic tests.
2. Add PostgreSQL migrations and local development setup.
3. Move progress persistence from process memory to PostgreSQL through Go.
4. Add auth/session ownership in Go.
5. Add curriculum tables and lesson-attempt history.
6. Only then revisit live avatar event orchestration.

## Server-side environment names

Set these on the host. Record names only in issues, PRs, docs, screenshots, and logs.

| Name                    | Scope       | Required for public MVP | Notes                                                                     |
| ----------------------- | ----------- | ----------------------- | ------------------------------------------------------------------------- |
| `OPENAI_API_KEY`        | Server only | Yes                     | Primary key used only by API routes to mint limited Realtime credentials. |
| `OPENAI_REALTIME_MODEL` | Server only | No                      | Defaults to `gpt-realtime-2`; set explicitly for release clarity.         |
| `LIVEAVATAR_API_KEY`    | Server only | No for voice MVP        | Required only when validating live streaming avatar provider behavior.    |
| `HEYGEN_API_KEY`        | Server only | No for voice MVP        | Required only when validating generated/static HeyGen avatar behavior.    |
| `HEYGEN_AVATAR_ID`      | Server only | No                      | Defaults to `e29e792a-41e7-4df0-84a8-349e099fb50f`.                       |
| `POSTGRES_URL`          | Server only | Phase 2                 | PostgreSQL connection string; never expose to browser code or logs.       |
| `GO_API_INTERNAL_URL`   | Server only | Phase 2                 | Internal URL used by Next.js/server infrastructure to reach the Go API.   |
| `SESSION_SECRET`        | Server only | Phase 2                 | Secret for server-managed sessions when auth begins.                      |

Do not create `NEXT_PUBLIC_*` versions of these values. The browser should receive only non-secret status and limited Realtime credentials.

## PostgreSQL preparation

Do not wire PostgreSQL into Phase 1 app code. Prepare it only when the Phase 2 Go backend change begins:

- choose managed PostgreSQL or explicitly accept VPS database operations,
- define migrations in `db/migrations/*`,
- keep database URLs server-only,
- design indexes and constraints before writing repository code,
- model XP awards as idempotent server-owned records,
- keep backups and restore drills documented before public user data exists.

## Deployed verification

Run the readiness smoke against the public deployment:

```bash
READINESS_URL="https://your-deployment.example/api/readiness" npm run smoke:readiness
```

A passing deployment prints:

```text
readiness=ready http=200
```

Then open the public lesson URL in a browser with microphone access:

```text
https://your-deployment.example/lesson
```

A passing live run shows:

- `voz lista` during the lesson,
- `gpt-realtime-2 · credencial limitada`,
- `sesión cerrada` after completion,
- `Prácticas: 1 · Feedback: 1` or higher,
- `+50 XP ganados`,
- avatar available, static, or voice-only with safe fallback copy.

## Ship decision

| Decision                   | Criteria                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Ship                       | Deployed readiness passes, live lesson passes, and evidence is secret-safe.                                                       |
| Do not ship                | Readiness is degraded, WebRTC/audio fails due to app behavior, XP is denied after valid participation, or evidence leaks secrets. |
| Ship with known limitation | Voice lesson passes but avatar provider is unavailable; acceptable only when fallback keeps practice usable.                      |

## Rollback

Keep the previous known-good deployment available until the browser/audio validation passes.

Rollback options:

1. redeploy the previous Git commit,
2. restore the previous PM2/systemd release directory,
3. disable optional avatar provider variables while keeping Realtime voice available,
4. point DNS/proxy back to the previous service if the new release fails live validation.

For future Go/PostgreSQL phases, rollback must also include database migration rollback or forward-fix instructions before the PR is considered releasable.

## Evidence update

After deployed validation, update `docs/release-evidence.md`:

- Replace `Public/deployed MVP` with the deployed result.
- Add the deployed URL checked.
- Record whether the app ran on Hostinger VPS or a fallback host.
- Keep only visible states and variable names.
- Do not record `.env` values, primary keys, Realtime client secrets, SDP payloads, database URLs, screenshots with secrets, or raw provider responses.
