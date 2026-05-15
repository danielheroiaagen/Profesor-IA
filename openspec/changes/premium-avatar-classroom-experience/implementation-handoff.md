# Implementation Handoff: Premium Avatar Classroom Experience

GitHub issue: #73

## Selected direction

Use **Final HeyGen Avatar Stage** as the implementation target.

- Stitch project: `projects/18278387050616389757`
- Stitch screen: `projects/18278387050616389757/screens/4f19d6adca1b4823891f1a3187a56e34`
- Local reference: `stitch-assets/final-heygen-avatar-stage.png`

## Frozen technical contract

Do not change these behaviors in this redesign:

- HeyGen avatar identity: `e29e792a-41e7-4df0-84a8-349e099fb50f`
- OpenAI Realtime voice model: `gpt-realtime-2`
- Existing server API routes and payload shapes
- Server-minted limited Realtime credential flow
- WebRTC connection semantics
- XP evidence/completion rules
- Safe fallback behavior and no secret exposure

## Visual target

The first viewport should read as a premium private AI tutor session:

- dark navy/black cinematic app shell;
- central configured HeyGen avatar/video stage;
- cyan voice waveform for listening/ready states;
- violet aura for AI speaking/correcting states;
- emerald XP/progress treatments;
- compact right-side progress/lesson HUD;
- secondary protected-session evidence only.

## Component map

| UI area          | Existing source state                             | Implementation notes                                                                |
| ---------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Avatar stage     | `avatar`, `connectionStatus`, `status`            | Large stage, configured-avatar label, no fake-live claim.                           |
| State chips      | `status`, `connectionStatus`                      | Ready, Conectando, Escuchando, Hablando, Corrigiendo, Modo voz seguro.              |
| Lesson objective | `INITIAL_FEEDBACK_SUMMARY` + fixed prompt copy    | Prominent target phrase: “I am practicing English today.”                           |
| Controls         | existing handlers                                 | Keep `startLesson`, `recordLearnerTurn`, `recordVisibleFeedback`, `completeLesson`. |
| Feedback panel   | `feedbackSummary`, `feedbackEvents`               | Teacher-like correction and next action.                                            |
| Gamification     | `learnerTurns`, `feedbackEvents`, `xp`, `totalXp` | XP total, earned XP, evidence counters, completion reward.                          |
| Safety evidence  | `realtime.model`, `avatar.reason`, errors         | Secondary only; exact model `gpt-realtime-2` allowed, no secrets.                   |

## Suggested internal view model

```ts
type TutorStageViewModel = {
  title: string;
  stateLabel: string;
  stateDescription: string;
  motionCue:
    | "idle"
    | "connecting"
    | "listening"
    | "speaking"
    | "correcting"
    | "fallback"
    | "completed";
  isLiveAvatar: boolean;
  avatarId: "e29e792a-41e7-4df0-84a8-349e099fb50f";
  realtimeModel: "gpt-realtime-2";
};
```

## State mapping

| App state                     | Learner-facing state | Visual cue                             |
| ----------------------------- | -------------------- | -------------------------------------- |
| `idle` + `not-started`        | Ready                | calm avatar stage, ready chip          |
| `starting` + `requesting-mic` | Conectando           | pulse ring, setup copy                 |
| `active` + `connected`        | Escuchando           | cyan waveform, mic cue                 |
| `feedback`                    | Corrigiendo          | violet correction highlight            |
| `completed`                   | Completada           | emerald XP reward                      |
| `failed`                      | Reintento seguro     | amber/red only if true failure         |
| `active` + `fallback`         | Modo voz seguro      | premium fallback, no live-avatar claim |

## Accessibility requirements

- Buttons min-height >= 44px.
- Visible `:focus-visible` outline/ring.
- Status changes exposed via `role="status"` or `role="alert"` where appropriate.
- State is never communicated by color alone.
- Disabled actions explain why they are unavailable.
- Text contrast must remain readable over glows/gradients.

## Test updates

Keep existing security/regression assertions and add UI assertions for:

- premium initial avatar-first surface;
- configured avatar label/state;
- `gpt-realtime-2` as the returned/protected Realtime model;
- fallback honesty when mic/avatar setup fails;
- visible correction panel;
- XP/completion reward presentation;
- disabled action explanation.

## Implementation boundary

This handoff is for UI/presentation code only. If real moving/speaking HeyGen avatar rendering requires a new streaming/session integration beyond the current server-side avatar-status adapter, that must become a separate SDD slice. Do not fake avatar movement as if it were the real live HeyGen stream.
