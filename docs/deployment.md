# Public deployment runbook

Profesor IA is ready for a public deployment only after the deployed URL proves the same gates that passed locally: readiness, real browser/audio, XP, avatar fallback safety, and no secret leakage.

## Quick path

1. Deploy the GitHub `main` branch to the chosen Next.js runtime.
2. Add server-side environment variable names in the provider/VPS secret manager.
3. Run deployed readiness smoke against `/api/readiness`.
4. Run one live browser/audio lesson on the deployed `/lesson` URL.
5. Update `docs/release-evidence.md` with the deployed URL result.

## Phase 1 target decision

Use **Hostinger VPS for the Next.js app runtime** and **Supabase hosted for managed Postgres/Auth/Storage in later phases**.

| Option                            | Decision                                  | Why                                                                                                                                   |
| --------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Hostinger VPS app runtime         | Recommended for Phase 1                   | Gives server control for `next start`, reverse proxy, logs, and future background jobs.                                               |
| Supabase hosted                   | Recommended for Phase 2 data/Auth/Storage | Managed Postgres, Auth, Storage, backups, and RLS without operating the full Supabase stack.                                          |
| Self-hosted Supabase on Hostinger | Defer                                     | Too much operations burden for the first real-product release: upgrades, backups, Auth, Storage, Realtime, TLS, and security patches. |
| Standalone managed Postgres       | Later alternative                         | Useful only if Supabase Auth/Storage/RLS are intentionally replaced.                                                                  |
| Vercel                            | Valid fallback                            | Fastest Next.js deployment if server-control is less important than speed.                                                            |

The Phase 1 deployment does not require Supabase credentials yet. Supabase becomes active in Phase 2 when durable auth/progress replaces process-local anonymous progress.

## Hostinger VPS app runtime

Recommended first VPS shape:

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

## Server-side environment names

Set these on the host. Record names only in issues, PRs, docs, screenshots, and logs.

| Name                    | Scope       | Required for public MVP | Notes                                                                     |
| ----------------------- | ----------- | ----------------------- | ------------------------------------------------------------------------- |
| `OPENAI_API_KEY`        | Server only | Yes                     | Primary key used only by API routes to mint limited Realtime credentials. |
| `OPENAI_REALTIME_MODEL` | Server only | No                      | Defaults to `gpt-realtime-2`; set explicitly for release clarity.         |
| `LIVEAVATAR_API_KEY`    | Server only | No for voice MVP        | Required only when validating live streaming avatar provider behavior.    |
| `HEYGEN_API_KEY`        | Server only | No for voice MVP        | Required only when validating generated/static HeyGen avatar behavior.    |
| `HEYGEN_AVATAR_ID`      | Server only | No                      | Defaults to `e29e792a-41e7-4df0-84a8-349e099fb50f`.                       |

Do not create `NEXT_PUBLIC_*` versions of these values. The browser should receive only non-secret status and limited Realtime credentials.

## Supabase hosted preparation

Do not wire Supabase into Phase 1 app code. Prepare only the account/project decision for Phase 2:

- create a Supabase hosted project,
- choose the production region,
- enable Auth only when Phase 2 begins,
- keep service-role keys server-only,
- design RLS policies before exposing browser access,
- check migrations into the repo when durable progress work starts.

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

## Evidence update

After deployed validation, update `docs/release-evidence.md`:

- Replace `Public/deployed MVP` with the deployed result.
- Add the deployed URL checked.
- Record whether the app ran on Hostinger VPS or a fallback host.
- Keep only visible states and variable names.
- Do not record `.env` values, primary keys, Realtime client secrets, SDP payloads, screenshots with secrets, or raw provider responses.
