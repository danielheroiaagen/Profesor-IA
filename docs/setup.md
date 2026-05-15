# Setup

Use this guide to run Profesor IA locally without leaking secrets. The current
MVP has been validated with real browser microphone/WebRTC, server-side
Realtime evidence, and XP completion.

## Quick start

```bash
npm install
npm run dev
```

Open `http://localhost:3000/lesson`, click **Empezar clase**, and speak the
lesson phrase when the UI shows **voz lista**.

## Required Configuration Names

Create local environment variables on the server only. Do not paste values into docs, commits, browser code, screenshots, or logs.

| Name                    |         Required | Purpose                                                                     |
| ----------------------- | ---------------: | --------------------------------------------------------------------------- |
| `OPENAI_API_KEY`        |              Yes | Server-only primary OpenAI key used to mint ephemeral Realtime credentials. |
| `OPENAI_REALTIME_MODEL` |               No | Defaults to `gpt-realtime-2`.                                               |
| `HEYGEN_API_KEY`        | No for voice MVP | Server-only HeyGen key for avatar spike.                                    |
| `HEYGEN_AVATAR_ID`      |               No | Defaults to `552426f4e4584a24871c5ffad2a97f73`.                             |

## Expected live result

A successful browser run shows:

- `clase completada`
- `sesión cerrada`
- `Prácticas: 1 · Feedback: 1`
- `+50 XP ganados`

If any of those are missing, treat it as a product or environment validation
finding and record it with `docs/browser-audio-validation.md`.

## Readiness check

Use the safe readiness endpoint in deployments and local smoke checks:

```bash
npm run smoke:readiness
```

The command expects a running app at `http://localhost:3000/api/readiness` by
default. To check a deployed environment:

```bash
READINESS_URL="https://your-app.example/api/readiness" npm run smoke:readiness
```

The underlying endpoint returns `200` with `status: "ready"` when required
OpenAI configuration is present, or `503` with `status: "degraded"` when voice
configuration is missing. The response and smoke command output contain only
booleans or non-secret metadata; they must never include API keys, client
secrets, `.env` values, SDP payloads, or raw provider responses.

## Verification Commands

```bash
npm run verify
```

`npm run verify` includes:

- `npm run format` — Prettier check.
- `npm test` — Vitest unit, route integration, and jsdom UI smoke coverage.
- `npm run typecheck` — TypeScript no-emit check.
- `npm run lint` — ESLint project scan.
- `npm run build` — Next.js production build.

Verified on 2026-05-15 after real browser/audio validation.

Playwright is not installed. Browser smoke coverage uses the existing
Vitest/jsdom stack to keep CI deterministic; live audio validation remains an
opt-in local workflow.

## Browser/audio Validation

Use `docs/browser-audio-validation.md` for the local opt-in browser validation workflow. It covers microphone permission, WebRTC connection attempts, Realtime provider dependencies, and share-safe evidence rules.

## Security Checklist

- Do not inspect or print `.env` contents.
- Validate missing configuration with variable names only.
- Never send primary OpenAI or HeyGen keys to the browser.
- Use voice-only or static-avatar fallback when avatar integration is unavailable.
- Do not record SDP payloads, Realtime client secrets, or raw provider responses
  as evidence.
