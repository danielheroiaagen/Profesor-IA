# Design: Professional Lesson Experience

## Technical Approach

Keep the existing Realtime/session behavior in `LessonClient`, but replace the learner surface with a product-quality class shell. The implementation should introduce small presentation helpers inside the same file first: state-to-copy mapping, teacher/avatar display, lesson checklist, feedback card, and progress result. This avoids premature component sprawl while making the UI professional and testable.

## Architecture Decisions

| Decision            | Choice                                                                             | Alternatives                             | Rationale                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| Scope               | Polish `/` and `/lesson` only                                                      | Add dashboard/curriculum                 | The requirement is professional MVP experience, not a platform expansion.                    |
| Styling             | Continue inline style objects for this slice                                       | Add Tailwind/CSS framework               | Repo currently uses inline styles and no CSS system; adding a framework would inflate scope. |
| State display       | Map raw states to learner-facing copy                                              | Render `active/fallback/failed` directly | Raw states are useful internally but unprofessional as primary UX.                           |
| Component shape     | Keep behavior in `LessonClient`; extract local render helpers/types only if needed | New component tree/design system         | Keeps diff reviewable and preserves existing tests/API flow.                                 |
| Security visibility | Show safe “protected session” message, never credential details                    | Display model/expiry prominently         | Specs require hidden credentials; technical evidence belongs in tests/docs, not learner UI.  |

## Data Flow

```text
Learner opens /lesson
  -> sees class shell: teacher, objective, prompt, progress
  -> Start class calls existing /api/lessons/start + /api/realtime/session
  -> UI maps internal setup state to learner guidance
  -> Realtime feedback updates correction card
  -> Complete lesson calls existing /api/lessons/complete
  -> UI maps XP result to progress outcome
```

Failure path:

```text
mic/network/provider error
  -> keep lesson usable when possible
  -> show safe retry guidance
  -> do not expose .env, primary keys, raw SDP, clientSecret, or provider payloads
```

## File Changes

| File                                                       | Action       | Description                                                                                                                     |
| ---------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `app/page.tsx`                                             | Modify       | Replace MVP/debug CTA copy with focused professional voice-class positioning.                                                   |
| `app/lesson/lesson-client.tsx`                             | Modify       | Reframe layout into teacher panel, class objective, speaking prompt, feedback, progress, and safe status areas.                 |
| `tests/app/lesson-client.test.tsx`                         | Modify       | Update assertions from raw debug labels/buttons to learner-facing labels while preserving secure credential and fallback tests. |
| `openspec/changes/professional-lesson-experience/tasks.md` | Create later | Break implementation into reviewable UI/test/spec tasks.                                                                        |

## Interfaces / Contracts

No API contract changes. Existing endpoints remain:

```ts
POST / api / lessons / start;
POST / api / realtime / session;
POST / api / lessons / complete;
```

Recommended local UI view model inside `LessonClient`:

```ts
type LessonPhaseCopy = {
  eyebrow: string;
  title: string;
  guidance: string;
  tone: "idle" | "working" | "ready" | "success" | "warning";
};
```

Mapping rules:

- `idle` -> invite learner to start class.
- `starting` / `requesting-mic` -> explain setup in progress.
- `active` / `connected` -> prompt learner to speak.
- `feedback` -> highlight correction/reinforcement.
- `completed` -> show progress earned.
- `failed` / `fallback` -> show safe retry or voice-only guidance.

## Testing Strategy

| Layer        | What to Test                                                  | Approach                                                                     |
| ------------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Component    | Initial professional class surface and CTA                    | Testing Library role/text assertions.                                        |
| Component    | Mic denied/provider unavailable maps to safe learner guidance | Existing mocked `getUserMedia`/fetch tests, updated labels.                  |
| Component    | Connect URL + limited credential still used                   | Preserve current low-level assertion; this is security-critical.             |
| Component    | Completion/XP reads as progress outcome                       | Mock completion response and assert learner-facing reward/no-reward message. |
| Verification | Formatting, unit tests, typecheck, lint, build                | `npm run verify`.                                                            |

## Migration / Rollout

No data migration required. This is a presentation-layer change over existing APIs. Rollback is a normal git revert of UI/tests/spec artifacts.

## Open Questions

- [ ] Should the “I spoke” and “show correction” debug helpers remain hidden for demo/testing, or be removed from learner UI entirely in this slice?
