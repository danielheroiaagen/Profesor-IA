# Proposal: Professional Lesson Experience

## Intent

The current lesson screen proves the voice MVP, but it looks like an engineering debug panel. This change makes the MVP feel like a professional AI English class while preserving the secure Realtime, avatar fallback, feedback, and XP flow.

## Scope

### In Scope

- Replace MVP/debug wording with learner-facing lesson experience copy.
- Redesign `/lesson` into teacher presence, lesson objective, speaking prompt, visible correction, progress/XP, and safe status areas.
- Keep Realtime credential, avatar fallback, and XP behavior intact.
- Update tests to verify learner-facing states instead of raw debug controls.

### Out of Scope

- Full dashboard, curriculum system, auth, persistence, payments, or live HeyGen expansion.
- New styling framework or heavy UI dependency.
- Changing primary vendor credential handling.

## Capabilities

### New Capabilities

- `professional-lesson-experience`: learner-facing class UI, professional hierarchy, and non-debug interaction states.

### Modified Capabilities

- `realtime-voice-tutor`: voice states must be presented as actionable learner guidance, not raw internals.
- `gamified-learning-session`: XP/progress feedback must feel like class completion, not a server result dump.
- `avatar-presenter`: fallback teacher presence must still feel intentional when live avatar is unavailable.

## Approach

Keep `LessonClient` as the behavior owner, but split the view into clear presentation sections and copy. Use existing CSS/React only. Preserve current APIs and safe fallback logic; change the learner surface from “buttons and statuses” to “start class, speak, receive feedback, finish lesson.”

## Affected Areas

| Area                               | Impact       | Description                                                  |
| ---------------------------------- | ------------ | ------------------------------------------------------------ |
| `app/page.tsx`                     | Modified     | Professional landing copy and CTA.                           |
| `app/lesson/lesson-client.tsx`     | Modified     | Learner-facing class layout and controls.                    |
| `tests/app/lesson-client.test.tsx` | Modified     | Assertions for professional UI states and fallback behavior. |
| `openspec/specs/*`                 | Modified/New | Add professional lesson experience contract.                 |

## Risks

| Risk                                        | Likelihood | Mitigation                         |
| ------------------------------------------- | ---------- | ---------------------------------- |
| Cosmetic work hides important safe failures | Med        | Keep concise status/evidence area. |
| Scope grows into dashboard/curriculum       | Med        | Limit to `/` and `/lesson`.        |
| Test fragility from copy assertions         | Low        | Prefer roles and stable labels.    |

## Rollback Plan

Revert the UI/test/spec changes; existing API routes and domain behavior remain untouched.

## Dependencies

- Existing Realtime session, avatar adapter, lesson completion, and XP endpoints.

## Success Criteria

- [ ] `/lesson` reads as a professional class experience, not a debug panel.
- [ ] Existing secure credential and fallback tests still pass.
- [ ] UX exposes start, guidance, feedback, completion, and retry states clearly.
