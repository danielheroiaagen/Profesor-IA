## Exploration: profesor-ingles-ia-gamificado

### Current State
Greenfield repository. The only project artifacts are `.env` (not read), `.atl/skill-registry.md`, and OpenSpec init files. `openspec/config.yaml` confirms hybrid artifact storage, no app stack, no test runner, `strict_tdd: false`, OpenAI Realtime target `gpt-realtime-2`, HeyGen avatar ID `552426f4e4584a24871c5ffad2a97f73`, and the rule that browser integrations MUST use server-side env vars plus ephemeral client secrets.

Docs checked during exploration:
- OpenAI Realtime docs expose server-created Realtime client secrets via `/v1/realtime/client_secrets`; browser WebRTC clients use the short-lived `ek_...` secret, not the main API key.
- OpenAI Realtime browser examples support `gpt-realtime-2` through the Realtime SDK and WebRTC flow.
- HeyGen v3 direct video creation supports `POST /v3/videos` with `engine: { "type": "avatar_v" }` for eligible avatar looks.
- HeyGen v3 documentation found here focuses on async video generation and Video Agent workflows; live/interactive avatar streaming still needs a technical spike before it can be treated as an MVP dependency.

### Affected Areas
- `openspec/config.yaml` — source of current project constraints, security rules, and testing status.
- `openspec/changes/profesor-ingles-ia-gamificado/` — active SDD change folder for exploration/proposal/spec/design/tasks.
- Future `AGENTS.md` — should document secret handling, SDD workflow, testing expectations, and review-slice limits before implementation.
- Future Next.js app — likely boundaries: browser voice UI, server token endpoints, OpenAI Realtime session orchestration, avatar adapter, gamification state, persistence, and tests.

### Product Domains and Boundaries
| Domain | Responsibility | Boundary rule |
|---|---|---|
| Learning Session | lesson state, current objective, conversation lifecycle | owns user-facing lesson flow, not vendor SDK details |
| Voice Tutor | realtime speech-to-speech, correction prompts, feedback events | talks to OpenAI through browser WebRTC using server-minted client secrets |
| Avatar Presenter | visual teacher representation and speech/lip-sync strategy | isolated behind adapter because HeyGen live streaming is unvalidated |
| Gamification | XP, levels, streaks, quests, badges, lesson completion | domain model should not depend on UI animation library |
| Curriculum | CEFR level, lesson templates, target skills, vocabulary | feeds tutor instructions and scoring criteria |
| User Progress | persisted profile, history, achievements | can start local/server mock, later move to DB/auth |
| Safety/Security | secret handling, rate limits, abuse controls, user identity hash | server-only env vars; ephemeral Realtime tokens; no `.env` exposure |

### Likely Architecture
Recommend a Next.js + TypeScript web app because it gives one deployable product boundary for browser voice UI plus server routes that mint tokens and proxy vendor APIs.

Proposed layers:
- `app/` routes and UI shell: lesson screen, microphone permission, avatar area, game HUD.
- `features/lesson-session/`: orchestration hooks/state machine for connecting/disconnecting a lesson.
- `features/realtime-tutor/`: OpenAI Realtime client adapter; receives only ephemeral secrets from server route.
- `features/avatar/`: HeyGen adapter with three modes: live spike, generated-video fallback, static/animated placeholder fallback.
- `features/gamification/`: pure TypeScript domain functions for XP, levels, streaks, rewards, scoring.
- `server/api/`: token minting, HeyGen calls, webhook endpoints, validation, rate limiting.
- `shared/contracts/`: Zod schemas/types for session config, game events, feedback events, and vendor-safe DTOs.

### Approaches
1. **Realtime-first with avatar adapter fallback** — Build OpenAI voice lesson as the MVP core, display a HeyGen-backed avatar only if the spike validates live interactivity; otherwise use a static/animated teacher while preserving the avatar boundary.
   - Pros: delivers the hardest product value early; keeps secrets safe; avoids coupling MVP success to uncertain HeyGen streaming.
   - Cons: initial avatar may be less impressive if the spike fails.
   - Effort: Medium.

2. **Avatar-first with generated HeyGen videos** — Build async HeyGen video responses around scripted tutor turns.
   - Pros: HeyGen v3 direct video API is documented; higher visual polish for scripted content.
   - Cons: conflicts with realtime conversation; latency likely breaks the teacher experience.
   - Effort: Medium-High.

3. **Full live OpenAI + live HeyGen integration upfront** — Attempt realtime voice and interactive streaming avatar in the first slice.
   - Pros: closest to the final vision if APIs cooperate.
   - Cons: highest integration uncertainty; large PR; hard to test; likely violates review-slice budget.
   - Effort: High.

### Recommendation
Use **Approach 1: Realtime-first with avatar adapter fallback**.

The first real change should establish product architecture and a thin vertical slice: a user starts a short English practice session, grants microphone access, the browser obtains an ephemeral OpenAI Realtime client secret from a server route, connects to `gpt-realtime-2`, receives spoken tutor responses, and awards simple XP for completing the session. The avatar area should use an adapter interface from day one, but HeyGen live streaming should be a spike with a documented fallback, not a blocker.

### First MVP Vertical Slice
Goal: “Practice a 2-minute English conversation and earn XP.”

Acceptance shape for proposal/spec/design:
- Server route mints short-lived OpenAI Realtime client secret using server-only API key.
- Browser connects to OpenAI Realtime via WebRTC/SDK using only the ephemeral secret.
- Tutor prompt constrains behavior: professional English teacher, CEFR-aware, concise correction, motivating tone.
- Lesson session emits game events: `session_started`, `user_spoke`, `correction_given`, `session_completed`, `xp_awarded`.
- Gamification model supports XP total, level, streak placeholder, and completion reward.
- Avatar panel renders through an `AvatarAdapter`; MVP can use static/animated fallback while HeyGen live spike runs separately.
- Tests focus on pure gamification rules, token-route validation/mocking, and lesson state transitions once tooling exists.

### HeyGen Spike/Fallback Strategy
Spike questions:
- Can the provided avatar/look ID be used with HeyGen v3 direct video and `engine: { "type": "avatar_v" }`?
- Is there a supported live/interactive streaming API suitable for turn-by-turn realtime tutoring, or only async generated videos/Video Agent flows?
- What are latency, quota, consent, and webhook requirements?

Fallback ladder:
1. Live HeyGen avatar if validated.
2. Static/animated teacher portrait with OpenAI voice as MVP fallback.
3. Async HeyGen recap videos for post-lesson summaries, not realtime turns.

### Risks
- HeyGen live/interactive streaming may not be available or may not fit realtime latency.
- Realtime voice costs, rate limits, and browser microphone permissions can affect UX.
- Token route must never expose primary OpenAI/HeyGen keys; security needs explicit tests/review.
- No current stack/test runner means proposal/design must include tooling before strict TDD claims.
- Full feature will exceed 400 changed lines; tasks should plan chained/reviewable slices.

### Ready for Proposal
Yes. The next phase should create a proposal for the realtime-first MVP, explicitly scope HeyGen live avatar as a spike/fallback, and defer full curriculum/auth/persistence until after the first secure voice lesson slice.
