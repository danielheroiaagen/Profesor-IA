# Setup

## Quick Start

```bash
npm install
npm run dev
```

## Required Configuration Names

Create local environment variables on the server only. Do not paste values into docs, commits, browser code, screenshots, or logs.

| Name | Required | Purpose |
|---|---:|---|
| `OPENAI_API_KEY` | Yes | Server-only primary OpenAI key used to mint ephemeral Realtime credentials. |
| `OPENAI_REALTIME_MODEL` | No | Defaults to `gpt-realtime-2`. |
| `HEYGEN_API_KEY` | No for voice MVP | Server-only HeyGen key for avatar spike. |
| `HEYGEN_AVATAR_ID` | No | Defaults to `552426f4e4584a24871c5ffad2a97f73`. |

## Verification Commands

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Verified on 2026-05-12: all four commands passed after `npm install`.

## Security Checklist

- Do not inspect or print `.env` contents.
- Validate missing configuration with variable names only.
- Never send primary OpenAI or HeyGen keys to the browser.
- Use voice-only or static-avatar fallback when avatar integration is unavailable.

## Current Slice

This foundation slice creates tooling, safe server configuration, and review/security docs only. Domain logic, API routes, voice UI, and HeyGen integration belong to later PR slices.
