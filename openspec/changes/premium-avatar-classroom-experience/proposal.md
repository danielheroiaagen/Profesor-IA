# Proposal: Premium Avatar Classroom Experience

GitHub issue: #73

## Intent

The current `/lesson` screen is validated but unpublishable: it feels like a debug form instead of a futuristic private AI tutor. This change defines a surgical redesign: premium avatar-first class experience bound to the configured HeyGen avatar ID `e29e792a-41e7-4df0-84a8-349e099fb50f`, using OpenAI `gpt-realtime-2`, with no regression to WebRTC, XP, or security.

## Scope

### In Scope

- Define a premium, accessible visual system for `/lesson`.
- Make the configured HeyGen avatar/teacher stage the primary surface.
- Show clear live states: connecting, listening, speaking, correcting, completed, fallback.
- Use Google Stitch for design ideation before implementation, but do not accept generic avatar placeholders as final direction.
- Preserve existing APIs, credential boundaries, tests, and fallback behavior.

### Out of Scope

- New curriculum/dashboard/auth/payments.
- Replacing HeyGen/OpenAI vendors or changing the `gpt-realtime-2` model.
- Reading, exposing, or changing `.env` secrets.
- Rewriting the app architecture beyond the presentation layer.

## Capabilities

### New Capabilities

- `premium-avatar-classroom-experience`: hard visual, accessibility, and avatar-first acceptance criteria.

### Modified Capabilities

- `avatar-presenter`: the selected design must represent the configured HeyGen avatar identity, not an anonymous stock tutor.
- `realtime-voice-tutor`: the design must keep OpenAI `gpt-realtime-2` voice states explicit and testable.

## Approach

Run a design-first SDD slice: freeze validated behavior, lock the visual brief, generate/score Stitch variants, map one selected design to React/Next, then implement in reviewable PRs with tests and Computer Use/browser validation.

## Affected Areas

| Area                               | Impact         | Description                                                                   |
| ---------------------------------- | -------------- | ----------------------------------------------------------------------------- |
| `app/lesson/lesson-client.tsx`     | Modified       | Premium avatar-first UI over existing state machine.                          |
| `app/page.tsx`                     | Modified       | Landing copy/CTA aligned with premium class promise.                          |
| `tests/app/lesson-client.test.tsx` | Modified       | Assertions for premium states, accessibility labels, and regression behavior. |
| `docs/release-evidence.md`         | Modified later | Add final visual/live evidence if validation passes.                          |

## Risks

| Risk                                   | Likelihood | Mitigation                                                          |
| -------------------------------------- | ---------- | ------------------------------------------------------------------- |
| UI polish breaks voice/avatar flow     | Med        | Freeze APIs/state logic; run `npm run verify` and live validation.  |
| Design becomes pretty but inaccessible | Med        | Accessibility spec and keyboard/contrast gates.                     |
| Diff exceeds review budget             | High       | Split into chained PRs before implementation.                       |
| Avatar unavailable in some runs        | Med        | Premium fallback state; never pretend video is live when it is not. |

## Rollback Plan

Revert presentation/test/doc changes only. Existing server APIs, credentials, Realtime, HeyGen, and XP logic remain untouched.

## Dependencies

- Existing Next.js app, Vitest tests, Realtime flow, HeyGen avatar status, and Computer Use/browser validation.
- Google Stitch MCP for ideation, not direct production authority.

## Success Criteria

- [ ] `/lesson` visually reads as a premium private AI tutor session.
- [ ] Configured HeyGen avatar identity dominates the first viewport.
- [ ] Voice/avatar states are understandable without raw debug wording.
- [ ] Keyboard, focus, contrast, and touch-target checks pass.
- [ ] `npm run verify` passes and live browser validation confirms `gpt-realtime-2`, WebRTC, and real avatar behavior/no-fake-live fallback.
