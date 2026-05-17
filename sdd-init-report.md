# SDD Init/Re-init Report — Profesor IA

Date: 2026-05-16

## Phase Envelope

- **status:** completed-with-findings
- **executive_summary:** Existing OpenSpec state was preserved. `openspec/config.yaml` existed but had stale derived context from the initial empty-stack state, so it was safely updated to reflect the current Next.js/Vitest project and strict TDD capability. The project already contains a validated AI English lesson MVP plus an active premium avatar classroom change with substantial uncommitted work. The skill registry exists, but its registered skill paths are Windows-local and do not resolve on this macOS workspace.
- **artifacts:**
  - Updated: `openspec/config.yaml`
  - Created: `sdd-init-report.md`
  - Existing OpenSpec specs and changes inspected; no specs/changes overwritten.
- **next_recommended:** Finish/decide the active `premium-avatar-classroom-experience` SDD change before starting another apply phase. Because current uncommitted work is already over the 400-line review budget, use a chained PR/fresh review step before continuing implementation or merge prep.
- **risks:** Current working tree contains large uncommitted implementation changes; `npm run verify` fails at formatting; `.atl/skill-registry.md` contains stale absolute paths; `artifact_store.mode: hybrid` remains from prior config although this session has no callable memory tools.
- **skill_resolution:** injected

## Project Context

Profesor IA is a professional AI English teacher MVP. The repo currently presents a short voice-first lesson where a learner speaks with an AI tutor, receives visible correction, and earns XP only after trusted participation/feedback evidence.

Current stack detected:

- Next.js 15 App Router
- React 19
- TypeScript 5
- Vitest 3 + Testing Library
- ESLint 9
- Prettier 3
- Server-side config boundary in `src/config/server.ts`
- Domain logic under `src/domain/*`
- Vendor integrations under `src/integrations/*`

Security constraints observed and preserved:

- `.env` was not read.
- Secrets must only be referenced by variable name.
- Browser code must not receive primary OpenAI, LiveAvatar, or HeyGen keys.
- Browser access uses ephemeral/server-mediated credentials.

## Testing and Tooling Capability

`package.json` exposes these main scripts:

| Capability             | Command                                                     | Result observed                                                                                                                  |
| ---------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Format check           | `npm run format`                                            | **fails**: Prettier reports formatting issues in `.pi/*`, `app/lesson/lesson-client.tsx`, and `tests/app/lesson-client.test.tsx` |
| Unit/integration tests | `npm test`                                                  | **passes**: 22 files, 71 tests                                                                                                   |
| Typecheck              | `npm run typecheck`                                         | **passes**                                                                                                                       |
| Lint                   | `npm run lint`                                              | **passes**                                                                                                                       |
| Build                  | `npm run build`                                             | **passes**                                                                                                                       |
| Full gate              | `npm run verify`                                            | **fails** because the first step, `npm run format`, fails                                                                        |
| Readiness smoke        | `npm run smoke:readiness`, `npm run smoke:readiness:server` | Available; not run during init                                                                                                   |

`openspec/config.yaml` was updated from the stale "no application stack detected" state to the current stack and now enables strict TDD for future implementation slices.

## Current OpenSpec State

### Existing specs

- `openspec/specs/project-foundation/spec.md`
- `openspec/specs/realtime-voice-tutor/spec.md`
- `openspec/specs/avatar-presenter/spec.md`
- `openspec/specs/gamified-learning-session/spec.md`
- `openspec/specs/professional-lesson-experience/spec.md`
- `openspec/specs/browser-audio-validation/spec.md`

### Archived changes

- `2026-05-13-browser-audio-validation`
- `2026-05-13-profesor-ingles-ia-gamificado`
- `2026-05-14-professional-lesson-experience`

### Active change

`openspec/changes/premium-avatar-classroom-experience/` is active and includes:

- `proposal.md`
- `design.md`
- `tasks.md`
- `implementation-handoff.md`
- Stitch prompts/assets/scorecard

Active change status from `tasks.md`:

- Review workload forecast: **450–850 estimated changed lines**, high budget risk.
- Chained PRs recommended: **yes**.
- Suggested split: SDD/Stitch brief → visual scaffold → full lesson states + validation.
- Some presentation scaffold, fallback, security-message, regression, verify, and visual validation tasks are checked.
- Still open: landing CTA alignment, several state-copy tasks, final real browser mic/WebRTC/HeyGen validation, release evidence update, fresh-context review.

## Built Capabilities Detected

From specs, README, routes, source layout, and tests, the project already includes:

- Landing page and `/lesson` experience.
- Server-minted OpenAI Realtime session flow for browser WebRTC.
- Visible tutor feedback in the lesson UI.
- Trusted lesson evidence/completion flow.
- XP/progress domain and progress API work in progress/untracked.
- Avatar provider/status/session integration boundaries, including HeyGen/LiveAvatar code.
- Voice-only/honest fallback behavior when avatar support is unavailable.
- Readiness API plus smoke scripts.
- Security headers/request guard/rate limit work in progress.
- Documentation for setup, PRD, deployment, release checklist/evidence, and browser audio validation.

## Uncommitted Work Summary

Branch: `main`

Current modified tracked files:

- `.gitignore`
- `app/api/lessons/complete/route.ts`
- `app/api/lessons/start/route.ts`
- `app/lesson/lesson-client.tsx`
- `next.config.ts`
- `openspec/config.yaml` — updated during this init/re-init
- `src/integrations/avatar/liveavatar.ts`
- `src/server/rate-limit.ts`
- `src/server/request-guard.ts`
- `tests/api/avatar/live-session.test.ts`
- `tests/api/lessons/complete.test.ts`
- `tests/api/lessons/start.test.ts`
- `tests/app/lesson-client.test.tsx`
- `tests/integrations/avatar/liveavatar.test.ts`

Current untracked files/directories:

- `.pi/`
- `app/api/progress/`
- `src/domain/progress.ts`
- `src/server/progress-store.ts`
- `tests/api/progress/`
- `tests/config/security-headers.test.ts`
- `tests/domain/progress.test.ts`
- `tests/server/`
- `sdd-init-report.md` — this report

Diff size observed before this report: 14 tracked files, about 1,571 insertions and 149 deletions. This exceeds the 400-line review budget and should be treated as a chained-PR/fresh-review situation.

Ignored local/generated items include `.env`, `.next/`, `.profesor-ia-data/`, `node_modules/`, `.DS_Store`, and `tsconfig.tsbuildinfo`.

## Skill Registry Status

`.atl/skill-registry.md` exists and contains compact rules for:

- `branch-pr`
- `chained-pr`
- `cognitive-doc-design`
- `comment-writer`
- `go-testing`
- `issue-creation`
- `judgment-day`
- `skill-creator`
- `work-unit-commits`

Validation result: registry content is usable as compact guidance, but every registered `Path:` points to a Windows-local path under `C:\Users\Danie\.config\opencode\skills\...`, and those paths do **not** resolve in this macOS workspace. The registry should be regenerated on this machine when file-path loading is needed. For this run, project/user skill rules were available through injected project standards and registry compact rules were inspected only as requested.

## Stale Config Needing Update

Updated safely:

- `openspec/config.yaml` previously claimed no application stack/test runner existed.
- It now records Next.js/React/TypeScript/Vitest/ESLint/Prettier tooling.
- It now marks `strict_tdd: true` with `npm test` as the apply-phase test command and `npm run verify` as the full gate.

Left intact but worth noting:

- `artifact_store.mode` remains `hybrid` because it was existing user-maintained config. This Pi session says OpenSpec-only and no callable memory tools are available, so the config now includes a note rather than destructively changing the mode.

## Recommended Next SDD Step

1. Do **not** start a new implementation slice until the current uncommitted premium-avatar/progress/security work is triaged.
2. Run an SDD **verify/review** pass for `premium-avatar-classroom-experience` focused on:
   - formatting failure,
   - review-slice boundaries,
   - unfinished tasks in `tasks.md`,
   - whether progress/security changes belong to the same PR chain.
3. After formatting is fixed, rerun `npm run verify`.
4. Before merge/PR, use fresh-context review because current diff size is above budget.

## Memory Persistence

No callable Engram/memory tool was available in this subagent toolset, so no memory write was performed. Findings are persisted in this OpenSpec-adjacent report and the updated `openspec/config.yaml`.
