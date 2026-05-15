# Public deployment runbook

Profesor IA is ready for a public deployment only after the deployed URL proves the same gates that passed locally: readiness, real browser/audio, XP, avatar fallback safety, and no secret leakage.

## Quick path

1. Deploy the GitHub `main` branch to a Next.js-capable host.
2. Add the server-side environment variable names below in the provider dashboard.
3. Run deployed readiness smoke against `/api/readiness`.
4. Run one live browser/audio lesson on the deployed `/lesson` URL.
5. Update `docs/release-evidence.md` with the deployed URL result.

## Recommended first target

| Target | Why                                                                                                                                                                                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Vercel | This is a small Next.js app with App Router routes and no container-specific infrastructure. Vercel documents Next.js deployments as zero-configuration for existing Next.js projects, and its environment variable dashboard supports Production/Preview scoping. |

Official references:

- [Next.js on Vercel](https://vercel.com/docs/concepts/next.js/overview)
- [Vercel environment variables](https://vercel.com/docs/environment-variables)
- [Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables)

If another platform is chosen, keep the same release gates. The platform must run Next.js server routes and protect server-only environment variables.

## Server-side environment names

Set these in the deployment provider. Record names only in issues, PRs, docs, screenshots, and logs.

| Name                    | Scope       | Required for public MVP | Notes                                                                     |
| ----------------------- | ----------- | ----------------------- | ------------------------------------------------------------------------- |
| `OPENAI_API_KEY`        | Server only | Yes                     | Primary key used only by API routes to mint limited Realtime credentials. |
| `OPENAI_REALTIME_MODEL` | Server only | No                      | Defaults to `gpt-realtime-2`; set explicitly for release clarity.         |
| `HEYGEN_API_KEY`        | Server only | No for voice MVP        | Required only when validating live/generated avatar provider behavior.    |
| `HEYGEN_AVATAR_ID`      | Server only | No                      | Defaults to `552426f4e4584a24871c5ffad2a97f73`.                           |

Do not create `NEXT_PUBLIC_*` versions of these values. The browser should receive only non-secret status and limited Realtime credentials.

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

- `voz lista` during the lesson
- `sesión cerrada` after completion
- `Prácticas: 1 · Feedback: 1` or higher
- `+50 XP ganados`
- avatar available, static, or voice-only with safe fallback copy

## Ship decision

| Decision                   | Criteria                                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Ship                       | Deployed readiness passes, live lesson passes, and evidence is secret-safe.                                                       |
| Do not ship                | Readiness is degraded, WebRTC/audio fails due to app behavior, XP is denied after valid participation, or evidence leaks secrets. |
| Ship with known limitation | Voice lesson passes but avatar provider is unavailable; acceptable only when fallback keeps practice usable.                      |

## Evidence update

After deployed validation, update `docs/release-evidence.md`:

- Replace `Public/deployed MVP` with the deployed result.
- Add the deployed URL checked.
- Keep only visible states and variable names.
- Do not record `.env` values, primary keys, Realtime client secrets, SDP payloads, screenshots with secrets, or raw provider responses.
