# Proposal: Profesor Inglés IA Gamificado

## Intent

Users need a professional, motivating way to practice spoken English without exposing vendor secrets or waiting for a full curriculum platform. The MVP outcome is a 2-minute realtime voice lesson with a teacher-like AI, immediate correction, visible progress, and XP feedback. Success means a browser user can safely start a lesson, speak with `gpt-realtime-2`, complete the loop, and earn XP while the avatar surface remains isolated behind a validated/fallback adapter.

## Scope

### In Scope
- Realtime voice tutor flow using server-minted OpenAI ephemeral client secrets.
- Short lesson loop: start, speak, correction/feedback, complete, XP awarded.
- Avatar presenter boundary using HeyGen avatar `e29e792a-41e7-4df0-84a8-349e099fb50f` as spike/fallback, not core dependency.
- Project foundation: stack bootstrap, SDD specs/design/tasks, AGENTS.md guidance, tests/tooling plan.

### Out of Scope
- Full curriculum, auth/accounts, payments, long-term analytics.
- Production-grade HeyGen live integration until the spike proves API fit, latency, quotas, and consent flow.

## Capabilities

### New Capabilities
- `realtime-voice-tutor`: Browser voice lesson connects to OpenAI Realtime via WebRTC/SDK using only ephemeral secrets.
- `avatar-presenter`: Teacher visual surface selects live HeyGen, generated-video, or static fallback through an adapter.
- `gamified-learning-session`: Lesson lifecycle emits game events and awards XP/progress feedback.
- `project-foundation`: App/tooling/security guidance needed before implementation slices.

### Modified Capabilities
- None.

## Approach

Use a realtime-first Next.js + TypeScript vertical slice. Keep server routes responsible for secret-backed token minting and vendor calls; keep browser code limited to ephemeral secrets. Build gamification as pure domain logic. Treat HeyGen live streaming as a parallel spike behind `AvatarAdapter`; voice-only remains the MVP fallback.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/`, `app/api/` | New | UI shell and token/API routes. |
| `src/domain/` | New | Lesson and XP rules. |
| `src/integrations/` | New | OpenAI and avatar adapters. |
| `docs/`, `AGENTS.md` | New | Security, SDD, testing, review guidance. |
| `openspec/specs/` | New | Capability specs listed above. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| HeyGen live streaming unfit | High | Spike first; default to static/voice-only. |
| Browser mic/WebRTC failures | Med | Permission UX, fallback messaging, reconnect states. |
| Cost/rate limits | Med | Short lessons, quotas, server validation. |
| Secret leakage | Med | Server-only env vars, ephemeral secrets, revoke keys if leaked. |

## Rollback Plan

Disable avatar adapter and keep voice-only lessons; revoke exposed API keys if needed; roll back the stack bootstrap commit before app code depends on it.

## Dependencies

- OpenAI Realtime `gpt-realtime-2`; HeyGen avatar/spike access; future app/test tooling.

## Success Criteria

- [ ] Specs can be created for all four capabilities.
- [ ] MVP path supports secure voice lesson completion with XP feedback.
- [ ] HeyGen uncertainty is isolated and non-blocking.
