# Design: Browser Audio Validation

## Technical Approach
Add a small validation layer around the existing lesson flow. Runtime stays unchanged; live provider validation is local opt-in; automated checks remain deterministic.

## Decisions
| Decision | Choice | Rationale |
|---|---|---|
| Live boundary | Local opt-in, not CI | Real mic/WebRTC/provider checks are valuable but environment-dependent. |
| Evidence | Redacted Markdown checklist | Reviewers need proof, not secrets, SDP, or raw provider payloads. |
| Automation | Vitest/jsdom mocks | Proves UI/fallback behavior without browser binaries or hardware mic. |

## Flow
`docs -> npm run dev -> /lesson -> mic grant/deny -> /api/lessons/start -> /api/realtime/session -> limited credential -> WebRTC attempt -> safe evidence`.

## Files
Create `docs/browser-audio-validation.md`; update `docs/setup.md`; extend `tests/app/lesson-client.test.tsx`; avoid `package.json` tooling changes unless Vitest/jsdom is insufficient.

## Contract & Tests
Evidence records status, browser, checked time, config names, failure category, notes; forbids `.env`, keys, client secret values, SDP, and raw provider responses. Tests use Vitest/jsdom for fallback/connect behavior; manual checklist covers real browser/provider.
