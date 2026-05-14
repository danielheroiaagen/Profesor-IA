## Exploration: Professional Lesson Experience

### Current State

The lesson UI is a technical MVP panel. `app/lesson/lesson-client.tsx` exposes raw implementation state (`active`, `fallback`, `clientSecret expires`) and manual test buttons (`I spoke one answer`, `Show correction feedback`). It proves Realtime, fallback safety, visible feedback, and XP rules, but it does not feel like a professional learning product. The home page also labels the flow as `lesson MVP`, reinforcing scaffolding rather than product confidence.

### Affected Areas

- `app/page.tsx` — landing copy and entry point need learner-facing positioning, not MVP/debug wording.
- `app/lesson/lesson-client.tsx` — core interaction surface needs to become a class experience while preserving current Realtime/session behavior.
- `tests/app/lesson-client.test.tsx` — tests currently assert debug labels/buttons; they must assert learner-facing states and safe fallbacks.
- `openspec/specs/*` — existing voice, avatar, gamification, and foundation specs need UI/experience requirements.

### Approaches

1. **Polished MVP shell** — keep current state machine/API flow, redesign presentation into teacher card, lesson objective, conversation/feedback, progress/XP, and safe status area.
   - Pros: Fast, low risk, preserves existing tested behavior.
   - Cons: Still not a full product dashboard.
   - Effort: Medium.

2. **Full product redesign** — add routing, dashboard, curriculum, persistent profile, and a broader design system.
   - Pros: More impressive product direction.
   - Cons: Too much scope; risks breaking the working voice MVP and exceeding review budget.
   - Effort: High.

### Recommendation

Use **Polished MVP shell**. We should stop showing debug controls to learners, but not pretend the MVP is a complete platform. This is the right architectural move: productize the experience layer without changing vendor/security foundations.

### Risks

- UI polish could accidentally hide failure states reviewers need; keep a learner-safe status panel.
- Tests may become brittle if they assert exact marketing copy; assert roles/states instead.
- Scope creep toward dashboard/curriculum would blow up review size.

### Ready for Proposal

Yes — propose a focused `professional-lesson-experience` change that professionalizes the lesson UI while deferring full curriculum/dashboard work.
