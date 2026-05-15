# Tasks: Premium Avatar Classroom Experience

Planning issue: #73
Implementation issue: #77

## Review Workload Forecast

| Field                   | Value                                                                                 |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Estimated changed lines | 450-850                                                                               |
| 400-line budget risk    | High                                                                                  |
| Chained PRs recommended | Yes                                                                                   |
| Suggested split         | PR 1 SDD/Stitch brief -> PR 2 visual scaffold -> PR 3 full lesson states + validation |
| Delivery strategy       | ask-on-risk                                                                           |
| Chain strategy          | pending                                                                               |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal                        | Likely PR | Notes                                                                    |
| ---- | --------------------------- | --------- | ------------------------------------------------------------------------ |
| 1    | Lock SDD + Stitch direction | PR 1      | Planning/design only, no behavior changes.                               |
| 2    | Premium layout scaffold     | PR 2      | Avatar stage, tokens, landing copy, initial tests.                       |
| 3    | State polish + validation   | PR 3      | Fallback/listening/speaking/correction/completion states, docs evidence. |

## Phase 1: Design Lock

- [ ] 1.1 Create Stitch master prompt from `proposal.md`, `spec.md`, and `design.md`.
- [ ] 1.2 Generate 3 Stitch variants and score them against configured-avatar fidelity, accessibility, gamification, and feasibility.
- [ ] 1.3 Select one direction and record token/layout decisions before code.

## Phase 2: Premium Presentation Scaffold

- [x] 2.1 Update `app/lesson/lesson-client.tsx` with view model helpers carrying avatar ID `552426f4e4584a24871c5ffad2a97f73` and Realtime model `gpt-realtime-2`.
- [x] 2.2 Replace the status-list layout with avatar-first classroom sections and custom accessible buttons.
- [ ] 2.3 Update `app/page.tsx` so the landing CTA matches the premium private-tutor promise.

## Phase 3: State Coverage

- [ ] 3.1 Map idle, starting, connected, fallback, feedback, completed, and failed states to visible learner copy.
- [x] 3.2 Preserve honest fallback: no live-avatar claim when configured HeyGen avatar movement/speech is unavailable.
- [x] 3.3 Keep secure-session messaging secondary and never expose raw credentials, SDP, or `.env` values.

## Phase 4: Tests and Validation

- [x] 4.1 Update `tests/app/lesson-client.test.tsx` for premium initial surface and accessible state labels.
- [x] 4.2 Preserve existing Realtime credential, fallback, evidence, and XP regression assertions.
- [x] 4.3 Run `npm run verify`.
- [x] 4.4 Validate visually with Browser/Computer Use screenshot.
- [ ] 4.5 Run final real browser mic/WebRTC/HeyGen validation proving configured avatar movement/speech or block release with evidence.
- [x] 4.6 Add/keep a regression assertion that Realtime sessions return `gpt-realtime-2`.

## Phase 5: Evidence

- [ ] 5.1 Update release evidence docs only after validation passes.
- [ ] 5.2 Run fresh-context review before PR/merge.
