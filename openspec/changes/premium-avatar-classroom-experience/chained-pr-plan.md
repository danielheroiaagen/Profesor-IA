# Chained PR Plan — premium-avatar-classroom-experience

Date: 2026-05-17

## Decision

Use a **feature-branch chain**. The implementation and SDD review are valid, but the working tree is too large and mixed for one PR. No `size:exception` is recorded.

## Current Gate

| Gate              | Status                                                             |
| ----------------- | ------------------------------------------------------------------ |
| SDD tasks         | Complete, including task 5.2 fresh-context review                  |
| Full verification | `npm run verify` passed after the LiveAvatar `LITE` correction     |
| Product contract  | OpenAI Realtime 2 owns voice/microphone; LiveAvatar is visual-only |
| PR readiness      | Not ready as one PR; must be sliced                                |

## Strategy

```text
tracker: codex/premium-avatar-classroom-experience
├─ PR 0: codex/premium-avatar-00-sdd-cleanup 📍
├─ PR 1: codex/premium-avatar-01-liveavatar-lite
├─ PR 2: codex/premium-avatar-02-lesson-ui
├─ PR 3: codex/premium-avatar-03-progress
├─ PR 4: codex/premium-avatar-04-security-guards
└─ PR 5: codex/premium-avatar-05-release-evidence
```

- Tracker PR: draft/no-merge branch for integration.
- Child PR #1 targets the tracker branch.
- Each later child targets the immediately previous child branch.
- Keep tests and evidence with the behavior they verify.
- Do not include `.env` values or provider primary keys in any PR.

## Slice Manifest

| Slice | Goal                                        | Include                                                                                                                                                                                                                                                                                               | Exclude / notes                                                                                     | Verification                                                                                                                                                                                              |
| ----- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | SDD/tooling cleanup                         | `.gitignore`, `.prettierignore`, `openspec/config.yaml`, `sdd-init-report.md`, SDD planning/review artifacts                                                                                                                                                                                          | `.atl/skill-registry.md` is local registry churn; include only if intentionally reviewed as tooling | `npm run format`                                                                                                                                                                                          |
| 1     | Premium lesson UI scaffold                  | `app/lesson/lesson-client.tsx`, `tests/app/lesson-client.test.tsx`                                                                                                                                                                                                                                    | No provider/token changes, no progress API                                                          | `npm test -- tests/app/lesson-client.test.tsx` then `npm run verify`                                                                                                                                      |
| 2     | LiveAvatar visual-only boundary             | `src/integrations/avatar/liveavatar.ts`, `app/api/avatar/live-session/route.ts`, `tests/integrations/avatar/liveavatar.test.ts`, `tests/api/avatar/live-session.test.ts`, `next.config.ts` if required                                                                                                | No progress persistence or landing copy                                                             | `npm test -- tests/integrations/avatar/liveavatar.test.ts tests/api/avatar/live-session.test.ts` then `npm run verify`                                                                                    |
| 3     | Anonymous progress persistence              | `src/domain/progress.ts`, `src/server/progress-store.ts`, `app/api/progress/route.ts`, `app/api/lessons/complete/route.ts`, `app/api/lessons/start/route.ts`, `tests/domain/progress.test.ts`, `tests/server/progress-store.test.ts`, `tests/api/progress/route.test.ts`, affected lesson route tests | No avatar/provider work                                                                             | `npm test -- tests/domain/progress.test.ts tests/server/progress-store.test.ts tests/api/progress/route.test.ts tests/api/lessons/complete.test.ts tests/api/lessons/start.test.ts` then `npm run verify` |
| 4     | Security/request guard/rate-limit hardening | `src/server/request-guard.ts`, `src/server/rate-limit.ts`, `tests/server/request-guard.test.ts`, `tests/config/security-headers.test.ts`, affected route tests                                                                                                                                        | No UI redesign                                                                                      | `npm test -- tests/server/request-guard.test.ts tests/config/security-headers.test.ts` then `npm run verify`                                                                                              |
| 5     | Landing polish + final release evidence     | `app/page.tsx`, `tests/app/home-page.test.tsx`, `openspec/changes/premium-avatar-classroom-experience/release-evidence.md`, `verify-report.md`, `apply-progress.md`, `tasks.md`                                                                                                                       | New backend behavior                                                                                | `npm test -- tests/app/home-page.test.tsx`, browser validation, then `npm run verify`                                                                                                                     |

## Current Diff Risk

Tracked diff is approximately **2,158 additions / 279 deletions** across 22 files, plus untracked implementation/evidence files. The largest review-load drivers are:

| Area                                          | Approximate risk                                             |
| --------------------------------------------- | ------------------------------------------------------------ |
| Lesson UI + component tests                   | Very high; split into its own PR                             |
| Local skill registry `.atl/skill-registry.md` | High noise; keep out of product PRs unless intentional       |
| LiveAvatar `LITE` boundary                    | Medium; provider-focused PR                                  |
| Progress persistence                          | Medium; backend-focused PR                                   |
| SDD evidence docs                             | Medium; keep with release/evidence slice or separate cleanup |

## Next Safe Action

After PR 0, prepare PR 1 as the smaller LiveAvatar `LITE` boundary slice. Before committing each slice:

1. Stage only PR 0 files.
2. Confirm `git diff --cached --stat` is focused and reviewable.
3. Run the PR 0 verification command.
4. Create a conventional commit without AI attribution.
5. Repeat slices in order; do not create one large PR.
