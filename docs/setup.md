# Setup

## Quick Start

```bash
npm install
npm run dev
```

## Required Configuration Names

Create local environment variables on the server only. Do not paste values into docs, commits, browser code, screenshots, or logs.

| Name                    |         Required | Purpose                                                                     |
| ----------------------- | ---------------: | --------------------------------------------------------------------------- |
| `OPENAI_API_KEY`        |              Yes | Server-only primary OpenAI key used to mint ephemeral Realtime credentials. |
| `OPENAI_REALTIME_MODEL` |               No | Defaults to `gpt-realtime-2`.                                               |
| `HEYGEN_API_KEY`        | No for voice MVP | Server-only HeyGen key for avatar spike.                                    |
| `HEYGEN_AVATAR_ID`      |               No | Defaults to `552426f4e4584a24871c5ffad2a97f73`.                             |

## Verification Commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Verified on 2026-05-13 after Phase 5 hardening:

- `npm test` — Vitest unit, route integration, and jsdom UI smoke coverage.
- `npm run typecheck` — TypeScript no-emit check.
- `npm run lint` — ESLint project scan.
- `npm run build` — Next.js production build.

Playwright is not installed in this slice. Browser smoke coverage uses the existing Vitest/jsdom stack to keep the PR small; add Playwright later only when the team is ready to own browser binaries and audio permission mocks.

## Browser/audio Validation

Use `docs/browser-audio-validation.md` for the local opt-in browser validation workflow. It covers microphone permission, WebRTC connection attempts, Realtime provider dependencies, and share-safe evidence rules.

## Security Checklist

- Do not inspect or print `.env` contents.
- Validate missing configuration with variable names only.
- Never send primary OpenAI or HeyGen keys to the browser.
- Use voice-only or static-avatar fallback when avatar integration is unavailable.

## Current Slice

The current SDD chain has foundation, domain/API, Realtime voice, and HeyGen fallback slices. The next production hardening step is real browser/audio validation with provider credentials configured server-side.
