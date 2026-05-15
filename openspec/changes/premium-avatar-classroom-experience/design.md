# Design: Premium Avatar Classroom Experience

## Technical Approach

Treat this as a presentation-layer redesign over a frozen functional core. `LessonClient` keeps its current state machine and API calls; the redesign adds a view model and premium layout around existing states. Source of truth already verified in code: `DEFAULT_HEYGEN_AVATAR_ID = "e29e792a-41e7-4df0-84a8-349e099fb50f"` and `DEFAULT_OPENAI_REALTIME_MODEL = "gpt-realtime-2"`. Stitch is used before implementation to generate visual directions, then Codex maps the chosen direction into the current Next/React codebase.

## Architecture Decisions

| Decision          | Choice                                                            | Alternatives              | Rationale                                                                                      |
| ----------------- | ----------------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| Behavior boundary | Freeze Realtime/WebRTC/HeyGen/API/XP logic                        | Rewrite lesson flow       | Validated behavior is the asset; UI must wrap it, not disturb it.                              |
| Design workflow   | Stitch variants before code                                       | Code first                | We need visual intent before implementation; otherwise we repeat the current debug UI mistake. |
| UI shape          | Avatar-first stage + side/under cards                             | Status list as primary UI | The product promise is a private AI teacher, not server state inspection.                      |
| Accessibility     | Build visible focus/status semantics into the design              | Patch later               | Premium without accessibility is not premium.                                                  |
| Styling           | Use existing React/Next styling first; introduce tokens carefully | Add heavy UI framework    | Keeps review smaller and avoids framework churn.                                               |

## Data Flow

```text
Existing state/API flow stays:
startLesson -> /api/lessons/start -> /api/realtime/session -> WebRTC
Realtime events -> evidence/feedback -> completion -> XP

New presentation mapping:
LessonStatus + ConnectionStatus + AvatarStatus(e29e792a-41e7-4df0-84a8-349e099fb50f) + XP
  -> TutorStageViewModel
  -> Accessible premium classroom sections
```

## File Changes

| File                               | Action                  | Description                                                                                 |
| ---------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------- |
| `app/lesson/lesson-client.tsx`     | Modify                  | Add premium stage, state copy mapping, accessible controls, feedback/progress cards.        |
| `app/page.tsx`                     | Modify                  | Align landing promise with avatar-first private tutor experience.                           |
| `tests/app/lesson-client.test.tsx` | Modify                  | Assert premium headings, fallback honesty, secure credential regression, completion states. |
| `docs/release-evidence.md`         | Modify after validation | Add screenshot/Computer Use/live validation evidence.                                       |

## Stitch Methodology

1. Build master prompt from this SDD and explicitly include the configured HeyGen avatar ID and `gpt-realtime-2`.
2. Ask for 3 variants: cinematic tutor, glass classroom, focused coaching console.
3. Score each 0-2 for objective fit, configured-avatar fidelity, accessibility, gamification, responsive behavior, implementation feasibility.
4. Select one direction; do not blend randomly.
5. Convert selected design into implementation tasks with existing state names.

## Interfaces / Contracts

No API contract changes. Internal UI-only mapping may be introduced:

```ts
type TutorStageViewModel = {
  title: string;
  stateLabel: string;
  motionCue:
    | "idle"
    | "connecting"
    | "listening"
    | "speaking"
    | "correcting"
    | "fallback";
  isLiveAvatar: boolean;
  avatarId: "e29e792a-41e7-4df0-84a8-349e099fb50f";
  realtimeModel: "gpt-realtime-2";
};
```

## Testing Strategy

| Layer         | What to Test                                    | Approach                                                    |
| ------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| Component     | Premium initial surface                         | Testing Library role/text assertions.                       |
| Component     | Fallback honesty                                | Existing mocked avatar/mic failures.                        |
| Component     | Secure Realtime connection                      | Preserve connect URL + ephemeral credential assertions.     |
| Accessibility | Focus/status semantics                          | Role/name/status assertions plus visual Computer Use check. |
| E2E/manual    | Real mic/WebRTC/HeyGen avatar movement + speech | Browser + Computer Use validation before publish.           |

## Migration / Rollout

No data migration. Implement behind normal branch/PR review. Rollback is a git revert of UI/test/doc changes.

## Open Questions

- [ ] Current code validates the HeyGen avatar server-side, but a real moving/speaking avatar renderer may require an additional integration slice. Do not publish if the UI only fakes live avatar motion.
