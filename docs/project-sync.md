# Project Sync Snapshot

Date: 2026-05-23

## Current Direction

Profesor IA is moving from Supabase product dependency to a Go backend with PostgreSQL. The frontend remains Next.js. Voice lessons target `gpt-realtime-2`; live avatar behavior is being built behind a provider-neutral event/action contract before selecting or expanding avatar providers.

## Active PR Stack

1. `codex/avatar-live-event-contract` -> avatar event/action contract.
2. `codex/avatar-action-reducer` -> provider-neutral avatar action reducer.
3. `codex/avatar-runtime-dispatcher` -> trusted browser runtime dispatcher.
4. `codex/avatar-runtime-lesson-client` -> Realtime signal adapter for avatar runtime events.
5. `codex/avatar-lesson-runtime-controller` -> lesson-level runtime controller for UI wiring.

## Completed Avatar Foundation

- Live avatar events are normalized into provider-neutral `avatar.action` envelopes.
- Runtime identity is trusted from lesson state, not event payloads.
- Raw learner audio is excluded from avatar actions.
- Realtime speech, transcript evidence, tutor text, feedback, and degraded connection paths have typed adapters.
- Lesson-level runtime controller can initialize `lesson.ready`, reduce Realtime payloads, and handle manual completion/fallback events.

## Next Slice

Wire `src/integrations/avatar/avatar-lesson-runtime.ts` into `app/lesson/lesson-client.tsx` so the UI state chips and avatar stage react to runtime status in live lessons.

## Verification Source

GitHub Actions is the trusted verification source in this Codex desktop thread because local shell execution is currently unavailable. CI verifies:

- `npm run verify`
- `cd backend/api && go mod tidy`
- `cd backend/api && go test ./...`

## Persistence Note

This file is intentionally committed to the repository so the current project state is accessible from both macOS and Windows through GitHub, even if local Engram tools are unavailable in a given Codex session.
