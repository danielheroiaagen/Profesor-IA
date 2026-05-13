# Proposal: Browser Audio Validation

## Intent
Add a safe path to validate real browser microphone permission, WebRTC setup, Realtime credential use, and fallback behavior beyond Vitest/jsdom.

## Scope
In: local validation workflow, share-safe evidence rules, small deterministic UI checks. Out: production observability, live-provider CI, full HeyGen streaming.

## Capabilities
New: `browser-audio-validation`. Modified: `realtime-voice-tutor`, `project-foundation`.

## Approach
Document the live local path, define pass/block/fail evidence, and automate only provider-independent states. Server-side secrets stay server-side.

## Affected Areas
`docs/setup.md`, `docs/browser-audio-validation.md`, `tests/app/lesson-client.test.tsx`, OpenSpec specs.

## Risks
Live checks can fail from permissions, quota, config, or network; classify those separately from product failure. Avoid Playwright unless the team is ready to own browser binaries/mocks.

## Success Criteria
Developer can validate locally without secret values; evidence is reviewable; standard checks and `npm audit` stay green.
