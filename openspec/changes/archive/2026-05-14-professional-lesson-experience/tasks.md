# Tasks: Professional Lesson Experience

## Review Workload Forecast

| Field                   | Value                                                                 |
| ----------------------- | --------------------------------------------------------------------- |
| Estimated changed lines | 260-380                                                               |
| 400-line budget risk    | Medium                                                                |
| Chained PRs recommended | No                                                                    |
| Suggested split         | Single PR with work-unit commits: landing copy → lesson shell → tests |
| Delivery strategy       | ask-on-risk                                                           |
| Chain strategy          | pending                                                               |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal                                    | Likely PR | Notes                                   |
| ---- | --------------------------------------- | --------- | --------------------------------------- |
| 1    | Professional learner-facing UI and copy | Single PR | Keep under 400 lines; no API changes.   |
| 2    | Component tests and verification        | Same PR   | Tests travel with behavior they verify. |

## Phase 1: Landing and UI Copy Foundation

- [x] 1.1 Update `app/page.tsx` to remove MVP/debug wording and position the product as a focused short AI English class.
- [x] 1.2 Define learner-facing state copy in `app/lesson/lesson-client.tsx` so raw statuses are mapped to guidance, not shown as primary UX.
- [x] 1.3 Replace debug helper labels with natural learner controls while preserving testable participation/feedback paths.

## Phase 2: Professional Lesson Shell

- [x] 2.1 Reframe `app/lesson/lesson-client.tsx` into teacher presence, lesson objective, speaking prompt, feedback, and progress sections.
- [x] 2.2 Present avatar unavailable states as intentional voice-only/static teacher presence, not broken provider output.
- [x] 2.3 Keep security messaging concise: mention protected session, but never show client secrets, raw SDP, `.env`, or provider payloads.
- [x] 2.4 Present completion and XP as learner progress, including a supportive no-XP retry state.

## Phase 3: Tests

- [x] 3.1 Update `tests/app/lesson-client.test.tsx` initial render assertions for class surface, objective, and primary start action.
- [x] 3.2 Update microphone/provider failure tests to assert safe learner guidance instead of raw `fallback` labels.
- [x] 3.3 Preserve the server-returned `connectUrl` and limited credential test unchanged in intent.
- [x] 3.4 Update completion tests to assert professional progress/no-progress messaging.

## Phase 4: Verification

- [x] 4.1 Run `npm run format` and fix formatting only inside changed files.
- [x] 4.2 Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- [x] 4.3 Review `git diff --stat`; if changed lines exceed ~400, split before PR or ask for `size:exception`.
