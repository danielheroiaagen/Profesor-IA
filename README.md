# Profesor IA

Profesor IA is a validated voice-first English lesson MVP. A learner starts a
short spoken class, talks to an AI tutor through OpenAI Realtime, receives
visible correction, and earns XP only after server-recorded participation and
feedback evidence.

## Quick path

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create server-only environment variables:

   ```bash
   cp .env.example .env
   ```

   Fill values locally. Do not paste keys into chat, commits, screenshots, or
   browser code.

3. Run the app:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000/lesson`, click **Empezar clase**, and say:

   ```text
   I am practicing English today.
   ```

5. A successful real-browser run shows `Prácticas: 1 · Feedback: 1`, `sesión
cerrada`, and `+50 XP ganados`.

## What is in scope

| Area          | Current behavior                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| Voice tutor   | OpenAI Realtime session is minted server-side and used through a browser WebRTC connection.              |
| Feedback      | Realtime tutor feedback is shown in the lesson UI.                                                       |
| XP gate       | XP is awarded only after trusted server evidence for learner speech and tutor feedback.                  |
| Avatar        | HeyGen avatar status is resolved server-side; voice remains usable if avatar support is unavailable.     |
| Secret safety | Primary OpenAI and HeyGen keys stay server-only; the browser receives only limited Realtime credentials. |

## Verification

Run the full deterministic gate before opening a PR:

```bash
npm run verify
```

For live microphone/WebRTC validation, use
[`docs/browser-audio-validation.md`](docs/browser-audio-validation.md).

For release/deployment checks, use the readiness smoke that matches the
runtime you want to prove:

| Command                          | Use when                                                              | Expected safe output                                    |
| -------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| `npm run smoke:readiness`        | An app is already running or deployed.                                | `readiness=ready http=200`                              |
| `npm run smoke:readiness:server` | You want to start the built production server and test it end-to-end. | `readiness=ready http=200` and `readiness-server=ready` |

Both paths call `GET /api/readiness` and return only safe status plus non-secret
model/provider metadata.

## Key docs

- [`docs/PRD.md`](docs/PRD.md) — product scope and acceptance criteria.
- [`docs/setup.md`](docs/setup.md) — local setup, environment names, and safety rules.
- [`docs/browser-audio-validation.md`](docs/browser-audio-validation.md) — opt-in live browser/audio evidence workflow.
