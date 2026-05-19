# OpenAI and LiveAvatar integration roadmap

This document converts the external integration brief into Profesor IA project guidance. The current MVP keeps a strict boundary: **OpenAI Realtime owns voice, microphone capture, and lesson audio; LiveAvatar/HeyGen is visual-only support.**

## Decision now

| Area             | Current project decision                                                               |
| ---------------- | -------------------------------------------------------------------------------------- |
| Voice engine     | OpenAI Realtime via browser WebRTC and server-minted ephemeral credentials.            |
| Avatar role      | Visual presence only; no avatar voice, listening, push-to-talk, or microphone control. |
| Provider keys    | Primary OpenAI, LiveAvatar, and HeyGen keys stay server-only.                          |
| Progress         | Anonymous server-owned progress is separate from provider/session credentials.         |
| Image generation | Future work only; no GPT Image integration in the current MVP chain.                   |
| Agents SDK       | Future orchestration option; not required for the current short lesson MVP.            |

## What the external document confirms

The external document is useful as an architectural reference, especially for these points:

1. Browser Realtime sessions should use ephemeral credentials from the backend.
2. Tool execution, image generation, storage, and provider session creation should stay backend-mediated.
3. Avatar vendors can be integrated through different patterns: text-to-avatar, audio-to-avatar, or full conversational video pipelines.
4. Production work needs guardrails, consent, rate limits, observability, and retention rules.

These points match the existing security direction in this repo.

## Current implementation mapping

| Capability                    | Current path                                                                    | Notes                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Realtime session minting      | `app/api/realtime/session/route.ts`, `src/integrations/openai/realtime.ts`      | Uses server config and returns a limited client secret plus connect URL.        |
| Realtime browser WebRTC       | `app/lesson/lesson-client.tsx`                                                  | Requests microphone audio and connects to Realtime with the limited credential. |
| LiveAvatar session minting    | `app/api/avatar/live-session/route.ts`, `src/integrations/avatar/liveavatar.ts` | Server-mediated token creation; no provider primary key in browser.             |
| LiveAvatar browser attachment | `app/lesson/lesson-client.tsx`                                                  | Starts SDK session with `voiceChat: false` and keeps the video muted.           |
| Progress persistence          | `app/api/progress/route.ts`, `src/server/progress-store.ts`                     | Anonymous process-local MVP persistence; not related to provider identity.      |

## Non-negotiable rules for future slices

- Do not send primary provider API keys to browser code.
- Do not let LiveAvatar/HeyGen request microphone or camera unless a new approved spec changes the product contract.
- Do not add avatar TTS, avatar listening, `/api/avatar/speak`, or `/api/avatar/interrupt` inside a progress or UI polish PR.
- Do not add GPT Image or Agents SDK orchestration without a new issue/spec and focused tests.
- Keep every provider call in `src/integrations/*` or an adjacent server-only module.
- Keep route handlers guarded by same-origin checks, access checks where relevant, and rate limits.

## Future roadmap

### 1. Near term: finish the current MVP chain

- Keep Realtime voice reliable.
- Keep LiveAvatar visual-only.
- Hydrate the lesson UI from server-owned anonymous progress in a separate PR.
- Add final release evidence and browser audio validation.

### 2. Optional avatar-speaking spike

Only start this after a new approved design decision. Evaluate one pattern at a time:

| Pattern                                             | When to consider it                                  | Risk                                        |
| --------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------- |
| Realtime audio remains primary; avatar stays silent | Current MVP                                          | Lowest risk.                                |
| Realtime produces text; avatar speaks final text    | If visual tutor speech becomes product-critical      | Higher latency and interruption complexity. |
| Realtime audio streams into avatar lipsync          | If provider supports stable external audio streaming | Highest integration and sync risk.          |

A speaking-avatar spike must define interruption behavior, accessibility text fallback, consent copy, and rollback behavior before implementation.

### 3. Optional Agents SDK and tools

Agents SDK can be useful later for tool orchestration, handoffs, tracing, and guardrails. It is not needed for the current short lesson loop unless the product adds external tools such as image generation, curriculum search, CRM actions, or multi-agent tutoring roles.

### 4. Optional GPT Image integration

GPT Image belongs in a separate backend-mediated slice. Minimum requirements:

- server-side prompt validation,
- no client access to primary OpenAI keys,
- private storage or signed URLs for generated assets,
- content safety and retention policy,
- focused tests for route validation and no secret leakage.

## Review checklist for any future integration PR

- [ ] The PR states whether Realtime or the avatar owns audio.
- [ ] Browser code receives only ephemeral or server-mediated credentials.
- [ ] Provider calls are isolated to server/integration modules.
- [ ] Tests prove no primary keys, lesson access tokens, SDP, or provider payloads leak to unsafe responses.
- [ ] Interruptions and cleanup are tested when microphone or media streams are touched.
- [ ] The PR remains under the review budget or is split before review.

## Source note

This roadmap is based on the user-provided professional integration document from May 2026. Treat that document as planning input, not as a substitute for checking official provider documentation during each implementation slice.
