# Tasks: Browser Audio Validation

## Review Workload Forecast
Estimated changed lines: 180-320. Risk: Low. Chained PRs: No. Delivery: ask-on-risk. Decision needed before apply: No.

## Work Units
1. Browser/audio validation docs and safe evidence template.
2. Deterministic mocked lesson-client tests.

## Tasks
- [x] 1.1 Create `docs/browser-audio-validation.md` with local `/lesson` workflow, config names, outcomes, and failure categories.
- [x] 1.2 Add safe evidence rules forbidding `.env`, keys, client secrets, SDP, and raw provider responses.
- [x] 1.3 Link workflow from `docs/setup.md`.
- [x] 2.1 Keep `package.json` free of Playwright/browser-binary dependency.
- [x] 2.2 Avoid env-reading preflight scripts.
- [x] 2.3 Classify failures as `microphone`, `network`, `provider`, or `app`.
- [x] 3.1 Test microphone permission rejection fallback.
- [x] 3.2 Test server-returned `connectUrl` and limited credential path.
- [x] 3.3 Keep provider mocked; no live OpenAI or hardware mic in tests.
- [x] 4.1-4.5 Passed `npm test`, `typecheck`, `lint`, `build`, `npm audit`.
