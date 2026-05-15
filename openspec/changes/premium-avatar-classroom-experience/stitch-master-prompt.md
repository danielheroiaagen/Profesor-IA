# Stitch Master Prompt: Premium Avatar Classroom Experience

## Design task

Design the main `/lesson` screen for **Profesor IA**, a premium gamified AI English-learning platform. The tutor identity is the configured HeyGen avatar ID `552426f4e4584a24871c5ffad2a97f73`; do not use an anonymous stock tutor as the final product identity. The screen must feel like a futuristic private tutoring session with a live avatar teacher, realtime voice practice, visible corrections, and XP-based progression.

This is NOT a generic SaaS dashboard and NOT a debug panel. The learner should feel: “I have a personal AI English professor in front of me, listening, speaking, correcting me, and helping me progress.”

## Success criteria

- The configured HeyGen avatar/teacher stage dominates the first viewport.
- The product feels premium, futuristic, human, and trustworthy.
- Gamification is visible but elegant: XP, streak/progress, lesson objective, completion reward.
- Voice/avatar states are immediately understandable: ready, connecting, listening, speaking, correcting, completed, fallback.
- The UI remains accessible: high contrast, visible focus, semantic sections, large touch targets.
- No raw technical/debug language is primary.
- The design is implementable in a Next.js/React app without adding a heavy UI framework.

## Audience + JTBD

Spanish-speaking beginner English learner, level A1. They want to practice speaking without embarrassment and feel guided by a personal tutor. Their job-to-be-done: start a short speaking lesson, say the target phrase, receive correction, and earn visible progress.

## Information architecture

1. **Premium classroom shell**
   - Brand: Profesor IA
   - Lesson type: Speaking A1
   - Current gamified progress: XP, practice count, feedback count, lesson progress indicator

2. **Avatar teacher stage**
   - Large central avatar/video area
   - Teacher presence must feel alive
   - Motion/state cues: idle glow, connecting pulse, listening waveform, speaking aura, correcting highlight, fallback badge
   - If live avatar is unavailable, show an intentional premium fallback teacher state, not an error-looking empty box

3. **Live lesson objective**
   - Objective: practice saying “I am practicing English today.” naturally
   - Clear instruction in Spanish
   - Target English phrase visually prominent

4. **Voice controls**
   - Primary CTA: “Empezar clase”
   - Secondary actions: “Ya practiqué la frase”, “Ver corrección”, “Finalizar clase”
   - Disabled states must look intentional and accessible, not browser-default

5. **Correction and feedback panel**
   - Visible correction summary
   - Reinforcement tone: helpful, teacher-like, never blaming
   - Shows next best action

6. **Gamification panel**
   - XP earned / total XP
   - Practice evidence: learner turns + feedback events
   - Completion reward state
   - Progress should feel motivational, not like a server result dump

7. **Safety/status panel**
   - Secondary, compact, reassuring
   - Mentions protected session / limited credential without exposing secrets
   - Fallback guidance must be calm and actionable

## Visual direction

Create **3 distinct variants** while keeping the same information hierarchy and copy intent:

### Variant A: Cinematic AI Tutor

- Dark premium classroom, large avatar stage like a live video call
- Deep navy/black background, luminous cyan/violet accents
- Strong spotlight around teacher/avatar
- Feels like “future private lesson”

### Variant B: Glass Classroom Console

- Futuristic glassmorphism panels
- Avatar stage plus transparent learning HUD
- Soft gradients, blur, depth, rounded cards
- Feels advanced but calm and accessible

### Variant C: Focused Coaching Studio

- Less sci-fi, more premium education/coaching
- Warm dark background, elegant typography, clear progress cards
- Avatar still dominant, but more human and less cyberpunk
- Feels like a high-end language coaching product

## Color roles

- Background: dark premium base, not plain white
- Primary accent: electric blue/cyan for voice/WebRTC readiness
- Secondary accent: violet/purple for AI/avatar presence
- Success accent: emerald/green for completed practice and XP
- Warning/fallback: amber, but calm and non-alarming
- Error: red only for true failure; never dominate the design

## Typography character

- Modern, confident, readable
- Big emotional headline
- Strong numeric XP/progress treatment
- Target English phrase must be visually memorable
- Spanish guidance should be clear and warm

## Spacing, radius, and shadow rules

- Spacious layout with strong hierarchy
- Large radius cards/panels, premium shadows/glow
- Avoid dense dashboard clutter
- Controls must be at least 44px tall
- First viewport must not feel empty

## Interaction requirements

- Primary CTA should be visually dominant and reachable.
- States required:
  - idle: tutor ready, class not started
  - connecting: mic/WebRTC setup in progress
  - listening: learner should speak
  - speaking: tutor/avatar is responding
  - correcting: visible correction is active
  - completed: XP reward and lesson completion
  - fallback: voice-only or static tutor, still premium and usable
- Voice/avatar state must use text + icon/shape/motion cue, not only color.
- Disabled buttons must explain why they are disabled.
- Include visible keyboard focus styling.

## Gamification requirements

Gamification is a core product signal, not decoration.

Include:

- XP total and XP earned after completion
- lesson progress indicator
- practice evidence counters: learner turns and feedback events
- achievement/reward moment after completion
- optional streak/level placeholder, but do not invent fake long-term data
- motivational microcopy: “Tu progreso se guarda cuando practicás y recibís feedback.”

Avoid:

- childish game visuals
- casino-like rewards
- fake leaderboards
- overwhelming badges

Tone: elegant, motivating, premium education.

## Responsive behavior

### Mobile

- Avatar stage first
- Sticky or highly visible primary CTA
- Progress cards stacked
- Controls thumb-friendly

### Tablet

- Avatar stage top, feedback/progress below in 2-column cards

### Desktop

- Avatar stage central/left dominant
- Right-side lesson HUD with objective, status, and gamification
- Feedback panel below or side depending on variant

## Accessibility constraints

- Contrast-safe text and controls
- Focus-visible treatment for every interactive element
- Do not rely on color alone for status
- Clear heading order
- Buttons have descriptive labels
- Status changes have semantic live-region-friendly copy
- Touch targets minimum 44px
- Avoid tiny low-contrast text over blurred backgrounds

## Voice model constraint

Voice engine lock: the live voice tutor must use OpenAI `gpt-realtime-2`. Treat this as a product/technical contract. Do not suggest a different voice model in the UI or implementation handoff.

## Engineering constraints

- Target stack: Next.js + React.
- Existing lesson behavior is frozen: do not redesign the API flow. OpenAI Realtime model is `gpt-realtime-2`.
- No new backend concepts.
- No exposure of `.env`, client secrets, raw SDP, provider payloads, or primary keys.
- Design must map cleanly to configured avatar ID `552426f4e4584a24871c5ffad2a97f73` and existing state names: idle, starting, active, feedback, completed, failed; and connection states: not-started, requesting-mic, connected, fallback, ended, failed.
- Avoid requiring a heavy component library.

## Output request

Generate 3 high-fidelity design variants for the `/lesson` screen.

For each variant, provide:

- Visual rationale
- Desktop layout
- Mobile layout
- Component inventory
- State treatment for avatar/voice
- Gamification treatment
- Accessibility notes
- Implementation risks

Keep constants across variants:

- Avatar-first hierarchy
- Premium private tutor promise
- Gamified XP/progress
- Accessible controls
- Secure/fallback messaging as secondary support

Vary across variants:

- Visual mood
- Panel composition
- Avatar stage styling
- Gamification presentation
- Accent intensity
