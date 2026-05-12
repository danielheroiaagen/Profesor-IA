# Design: Profesor Inglés IA Gamificado

## Technical Approach

Bootstrap a greenfield Next.js + TypeScript MVP where Next.js owns both the React lesson UI and server route handlers. Keep product rules in `src/domain/*`, vendor calls in `src/integrations/*`, and security/configuration in server-only modules. The first releasable path is voice-only: browser obtains a server-minted OpenAI Realtime ephemeral credential for `gpt-realtime-2`, completes a short lesson, and receives XP. HeyGen remains behind an adapter so live avatar support can be spiked without blocking lessons.

## Architecture Decisions

| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| MVP boundary | Next.js app + API routes | Separate backend now | One deployable boundary is faster for greenfield MVP; route handlers still keep secrets server-side. Split later if load/auth requires it. |
| Browser credentials | Only ephemeral OpenAI client secrets and limited/server-mediated avatar tokens | Expose primary vendor keys | Required by specs; prevents `.env` leakage and keeps revocation on server. |
| HeyGen integration | `AvatarAdapter` with live/generated/static statuses | Direct SDK calls in UI | HeyGen live fit is unresolved; adapter preserves voice MVP and allows fallback. |
| Progress storage | In-memory/local profile first; DB later | Add DB immediately | XP rules can be tested as pure domain logic; persistence can wait for auth/accounts. |
| Review shape | Foundation → voice MVP → avatar spike → persistence | One large PR | Likely >400 lines, so deliver in chained reviewable work units. |

## Boundaries

- Browser UI/client session: microphone permission, WebRTC/session lifecycle, visible feedback, no primary secrets.
- Server API routes: validate lesson start, mint tokens, proxy/server-mediate vendor needs.
- OpenAI token service: server-only `OPENAI_API_KEY`, returns ephemeral Realtime session data.
- HeyGen avatar adapter: reports live/generated/static/unavailable status for avatar `552426f4e4584a24871c5ffad2a97f73`.
- Gamification/progress domain: lesson state transitions, completion qualification, XP calculation.
- Configuration/security layer: env validation, safe errors, docs, `AGENTS.md` guidance.

## Data Flow

Start lesson:

```text
Browser Start → POST /api/lessons/start
  → domain creates lesson state
  → OpenAI token service mints ephemeral Realtime credentials
  → AvatarAdapter checks presentation availability
  → Browser connects voice session and renders avatar/status
  → feedback events → domain qualifies completion → XP result
```

Avatar unavailable fallback:

```text
AvatarAdapter live check fails/disabled/slow
  → returns { mode: "static" | "voice-only", available: false }
  → UI keeps Realtime voice active
  → learner sees safe fallback message; no XP awarded unless participation completes
```

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json`, `next.config.ts`, `tsconfig.json` | Create | Next.js/TypeScript foundation and scripts. |
| `app/page.tsx`, `app/lesson/page.tsx` | Create | Landing and lesson UI shell. |
| `app/api/realtime/session/route.ts` | Create | Server-only OpenAI ephemeral token endpoint. |
| `app/api/lessons/start/route.ts`, `app/api/lessons/complete/route.ts` | Create | Lesson lifecycle and XP result routes. |
| `src/domain/lesson.ts`, `src/domain/gamification.ts` | Create | Pure state and XP rules. |
| `src/integrations/openai/realtime.ts` | Create | Token service around `gpt-realtime-2`. |
| `src/integrations/avatar/avatar-adapter.ts`, `src/integrations/avatar/heygen.ts` | Create | Adapter contract and HeyGen spike implementation. |
| `src/config/server.ts` | Create | Server-only env validation and safe errors. |
| `docs/PRD.md`, `docs/setup.md`, `AGENTS.md` | Create | Product, setup/security, and coding/review guidance. |
| `tests/**` | Create | Unit, route integration, and optional E2E smoke coverage. |

## Interfaces / Contracts

```ts
type LessonState = "idle" | "starting" | "active" | "feedback" | "completed" | "failed";
type XPResult = { awarded: boolean; xp: number; reason: "completed" | "insufficient-participation" | "unverified" };
type AvatarStatus = { mode: "live" | "generated" | "static" | "voice-only"; available: boolean; reason?: string };
type RealtimeSessionResponse = { clientSecret: string; model: "gpt-realtime-2"; expiresAt: string; lessonId: string };
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Lesson transitions, XP qualification, avatar fallback selection | Vitest against `src/domain/*` and adapter contract. |
| Integration | Token and lesson routes never expose primary secrets; mocked OpenAI/HeyGen failures | Route-handler tests with fetch mocks. |
| E2E smoke | Start voice lesson and see fallback when avatar unavailable | Playwright if browser/audio mocking is feasible after tooling setup. |

## Migration / Rollout

No data migration initially. Phase 1 creates foundation/docs/tooling. Phase 2 ships secure voice-only MVP. Phase 3 spikes HeyGen live/generated adapter with fallback. Phase 4 adds persistent progress once auth/storage decisions exist.

## Open Questions

- [ ] Which HeyGen API supports low-latency live interactive avatar for this product, and what browser credential model is safe?
- [ ] Should persistent progress use local-only storage, hosted DB, or auth-backed profiles once MVP proves value?
- [ ] Which browser/audio constraints are acceptable for the first E2E smoke test?
