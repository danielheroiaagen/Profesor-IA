# PRD: Profesor Inglés IA Gamificado

## Answer

Ship an MVP where a learner can practice a short spoken English lesson with an AI teacher, receive immediate correction, and see XP feedback. Voice is the core experience; avatar video is a safe, non-blocking enhancement.

## MVP Scope

| Area         | In                                                                           | Out                                     |
| ------------ | ---------------------------------------------------------------------------- | --------------------------------------- |
| Voice tutor  | 2-minute realtime English practice with correction                           | Full curriculum                         |
| Gamification | XP after meaningful participation and feedback                               | Accounts, payments, long-term analytics |
| Avatar       | HeyGen avatar `e29e792a-41e7-4df0-84a8-349e099fb50f` behind fallback adapter | Required live avatar dependency         |
| Security     | Server-only primary keys and ephemeral/server-mediated browser credentials   | Vendor keys in browser or logs          |

## User Outcome

The learner starts a lesson, speaks with the AI teacher, receives spoken and visible feedback, and earns progress only after meaningful participation.

## Acceptance Criteria

- Primary OpenAI and HeyGen API keys stay server-only.
- OpenAI Realtime uses `gpt-realtime-2` through server-minted ephemeral credentials.
- Avatar failure keeps the voice lesson usable with static or voice-only fallback.
- XP is not awarded for merely opening or abandoning a lesson.

## Review Plan

Review in this order: foundation/tooling, domain/API rules, realtime voice UI, avatar adapter spike, verification hardening. Keep each PR focused and independently reviewable.
