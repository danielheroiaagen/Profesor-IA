# Tasks: Profesor Inglés IA Gamificado

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 1,200-1,800 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 foundation → PR 2 domain/API → PR 3 voice UI → PR 4 avatar spike → PR 5 verification/docs |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Bootstrap app/tooling/docs | PR 1 | Base = feature/tracker branch; enables tests and strict checks. |
| 2 | Domain/contracts/API routes | PR 2 | Base = PR 1 branch; pure lesson/XP and safe server routes. |
| 3 | OpenAI Realtime voice MVP | PR 3 | Base = PR 2 branch; browser gets only ephemeral credentials. |
| 4 | HeyGen adapter spike | PR 4 | Base = PR 3 branch; fallback keeps voice usable. |
| 5 | Verification hardening | PR 5 | Base = PR 4 branch; smoke tests and docs polish. |

## Phase 1: Foundation / Tooling

- [x] 1.1 Create `package.json`, `next.config.ts`, `tsconfig.json`, ESLint/format scripts, Vitest setup, and test commands.
- [x] 1.2 Create `src/config/server.ts` with server-only env validation for OpenAI/HeyGen names and safe errors; never read or print `.env` values.
- [x] 1.3 Create `AGENTS.md`, `docs/PRD.md`, and `docs/setup.md` covering security, review budget, setup, and voice/avatar MVP scope.

## Phase 2: Domain and API Contracts

- [x] 2.1 Create `src/domain/lesson.ts` with lesson states, completion qualification, and failure states.
- [x] 2.2 Create `src/domain/gamification.ts` with XP rules: award only after meaningful participation and feedback.
- [x] 2.3 Create `src/integrations/avatar/avatar-adapter.ts` contract returning live/generated/static/voice-only status.
- [x] 2.4 Create `app/api/lessons/start/route.ts` and `app/api/lessons/complete/route.ts` using domain rules and safe client responses.
- [x] 2.5 Test `tests/domain/*.test.ts` for transitions, unearned XP denial, verified completion, and interrupted completion.

## Phase 3: OpenAI Realtime Voice MVP

- [x] 3.1 Create `src/integrations/openai/realtime.ts` to mint `gpt-realtime-2` ephemeral sessions server-side.
- [x] 3.2 Create `app/api/realtime/session/route.ts`; test mocked mint success/failure and assert primary keys never appear in responses.
- [x] 3.3 Create `app/page.tsx` and `app/lesson/page.tsx` with start, mic/error states, visible correction summary, completion, and XP result.

## Phase 4: HeyGen Avatar Spike / Fallback

- [x] 4.1 Create `src/integrations/avatar/heygen.ts` validating avatar `e29e792a-41e7-4df0-84a8-349e099fb50f` behind server-mediated config.
- [x] 4.2 Wire lesson UI to avatar status; show static/voice-only fallback without blocking Realtime voice.
- [x] 4.3 Test provider rejection, disabled avatar, slow/unavailable adapter, and no primary HeyGen key leakage.

## Phase 5: Verification

- [x] 5.1 Add route integration tests for safe lesson start, token mint failure, completion awarding, and no award before participation.
- [x] 5.2 Add browser smoke with existing Vitest/jsdom because Playwright is not yet installed: start lesson, avatar fallback visible, safe retry message on audio/session failure.
- [x] 5.3 Run `npm test`, typecheck, lint, build; update `docs/setup.md` with exact verified commands.
