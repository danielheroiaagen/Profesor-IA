# Stitch Scorecard: Premium Avatar Classroom Experience

## Stitch project

- Project: `projects/18278387050616389757`
- Design system: `assets/6099675535728023546` — Profesor IA Premium Gamified Classroom
- Baseline screen: `projects/18278387050616389757/screens/8cb419039c374d8f982b064325c27b20`

## Generated variants

| Variant                 | Stitch screen                                                            | Local screenshot                            |
| ----------------------- | ------------------------------------------------------------------------ | ------------------------------------------- |
| Cinematic AI Tutor      | `projects/18278387050616389757/screens/b2339231c8294b408ed4a2f8eb3dc833` | `stitch-assets/cinematic-ai-tutor.png`      |
| Glass Classroom Console | `projects/18278387050616389757/screens/a9513b9acb0f4ff09eea53dad13d4d4a` | `stitch-assets/glass-classroom-console.png` |
| Focused Coaching Studio | `projects/18278387050616389757/screens/74450880ee1945cd8b91f6e5f3902e4f` | `stitch-assets/focused-coaching-studio.png` |

## Scorecard

Scoring: 0 = fails, 1 = acceptable but weak, 2 = strong.

| Criteria                         | Cinematic AI Tutor | Glass Classroom Console | Focused Coaching Studio |
| -------------------------------- | -----------------: | ----------------------: | ----------------------: |
| Objective fit                    |                  2 |                       2 |                       1 |
| Avatar dominance                 |                  2 |                       1 |                       2 |
| Premium/future brand fit         |                  2 |                       2 |                       1 |
| Gamification clarity             |                  1 |                       2 |                       2 |
| Accessibility readiness          |                  1 |                       1 |                       2 |
| Responsive implementation logic  |                  2 |                       2 |                       2 |
| React implementation feasibility |                  2 |                       1 |                       2 |
| **Total**                        |          **12/14** |               **11/14** |               **12/14** |

## Decision

Select **Cinematic AI Tutor** as the primary direction.

Reason: it best matches the product promise: a futuristic private tutor with the avatar visually dominant. This is the direction that most clearly fixes the current “white page with buttons” failure.

## Required refinements before implementation

- Replace the generic Stitch tutor with the configured HeyGen avatar identity `552426f4e4584a24871c5ffad2a97f73`; if exact media is unavailable in Stitch, mark it as a configured-avatar video slot, not a final stock face.
- Increase gamification clarity without turning the UI into a dashboard.
- Add explicit visible focus styles for keyboard users.
- Make disabled CTA reasons visible and accessible.
- Ensure fallback teacher mode looks intentional and premium, not like a broken video.
- Keep state labels text-based: Ready, Conectando, Escuchando, Hablando, Corrigiendo, Completada, Modo voz seguro.

## Implementation handoff

Use Cinematic AI Tutor as the base visual language:

- dark navy/black shell;
- large configured-avatar stage occupying the visual center;
- cyan waveform for listening/voice readiness;
- violet aura for AI/tutor speaking;
- emerald XP/progress treatment;
- compact right-side lesson HUD;
- secondary protected-session badge.

Do not copy generated HTML directly. Convert the selected direction into the existing Next.js/React state machine in `app/lesson/lesson-client.tsx`.

## Correction after avatar/model verification

Verified in code:

- HeyGen avatar default: `552426f4e4584a24871c5ffad2a97f73`
- OpenAI Realtime model default: `gpt-realtime-2`

Created corrected Stitch screen:

| Corrected screen          | Stitch screen                                                            | Local screenshot                              |
| ------------------------- | ------------------------------------------------------------------------ | --------------------------------------------- |
| Final HeyGen Avatar Stage | `projects/18278387050616389757/screens/4f19d6adca1b4823891f1a3187a56e34` | `stitch-assets/final-heygen-avatar-stage.png` |

Important implementation note: Stitch cannot prove the real HeyGen media stream from the ID alone. The design now treats the center as the configured HeyGen avatar stage, but production acceptance requires real browser validation that the configured avatar moves/speaks or an honest premium fallback blocks publish.

## Voice model correction

The voice tutor contract is explicitly locked to OpenAI `gpt-realtime-2`. Existing code and tests already verify this default through `src/config/server.ts` and Realtime/API tests. Implementation must preserve it.
