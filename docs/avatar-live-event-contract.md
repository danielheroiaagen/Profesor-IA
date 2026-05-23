# Live Avatar Event Contract

## Purpose

The live avatar must react to voice-lesson events without becoming a hard dependency
for the lesson. Voice tutoring, progress awards, and curriculum selection stay
functional if avatar rendering fails.

## Event Sources

The Realtime tutor and lesson runtime may emit these normalized events:

- `lesson.ready`
  - Meaning: lesson plan and tutor instructions are loaded.
  - Avatar intent: friendly greeting or idle pose.
- `learner.speech_started`
  - Meaning: learner starts speaking.
  - Avatar intent: listening posture.
- `learner.speech_completed`
  - Meaning: learner turn is complete.
  - Avatar intent: thinking posture.
- `tutor.speech_started`
  - Meaning: tutor starts speaking.
  - Avatar intent: speaking posture with neutral expression.
- `tutor.speech_delta`
  - Meaning: tutor speech text or audio is streaming.
  - Avatar intent: optional viseme or mouth movement update.
- `tutor.speech_completed`
  - Meaning: tutor finishes speaking.
  - Avatar intent: return to idle or listening.
- `feedback.detected`
  - Meaning: tutor correction or praise is available.
  - Avatar intent: supportive expression or celebration.
- `lesson.completed`
  - Meaning: lesson completion is verified.
  - Avatar intent: celebration gesture.
- `connection.degraded`
  - Meaning: voice or avatar provider is unstable.
  - Avatar intent: non-blocking fallback state.

## Avatar Action Envelope

Every avatar action should use this provider-neutral shape:

```json
{
  "type": "avatar.action",
  "attemptId": "uuid-or-runtime-attempt-id",
  "lessonPlanSlug": "raio-a1-linking",
  "occurredAt": "2026-05-23T00:00:00Z",
  "action": {
    "kind": "speak",
    "intensity": "medium",
    "durationMs": 1200,
    "emotion": "supportive",
    "text": "Great job linking those words."
  }
}
```

Allowed `action.kind` values:

- `idle`
- `listen`
- `think`
- `speak`
- `gesture`
- `expression`
- `celebrate`
- `fallback`

Allowed `intensity` values: `low`, `medium`, `high`.

## State Machine

```mermaid
stateDiagram-v2
  [*] --> idle
  idle --> listening: learner.speech_started
  listening --> thinking: learner.speech_completed
  thinking --> speaking: tutor.speech_started
  speaking --> speaking: tutor.speech_delta
  speaking --> idle: tutor.speech_completed
  speaking --> feedback: feedback.detected
  feedback --> listening: tutor.speech_completed
  idle --> celebrating: lesson.completed
  celebrating --> idle
  idle --> fallback: connection.degraded
  fallback --> idle: connection.restored
```

## Safety and Privacy Invariants

- Avatar failure must never interrupt the voice lesson.
- The avatar must not receive raw learner audio.
- The avatar must not invent lesson content outside the tutor or curriculum event
  stream.
- The browser may render avatar actions, but provider credentials stay server-side.
- Avatar actions should be derived from safe lesson events, not from arbitrary
  client commands.
- A static avatar fallback must be valid for every lesson state.

## Latency Budget

- Listening, thinking, and speaking state changes: under 150 ms after local event
  receipt.
- Expression or gesture updates: under 300 ms after event receipt.
- Viseme or mouth updates: best effort; provider spike required.
- Fallback activation: under 500 ms after provider failure detection.

## Deferred Implementation Decisions

- Avatar provider selection.
- Whether visemes are generated client-side or by the provider.
- Whether avatar actions need a Go endpoint or can flow through the existing
  lesson websocket/session channel.
- How Next.js forwards attempt, lesson, and session context to avatar rendering.

## Acceptance Scenarios

### Scenario: avatar greets when lesson is ready

Given a loaded RAIO lesson plan, when `lesson.ready` is emitted, then the avatar
may show a greeting gesture without blocking voice setup.

### Scenario: avatar listens while learner speaks

Given the learner starts speaking, when `learner.speech_started` is emitted, then
the avatar enters `listen` state and no audio is sent to the avatar provider.

### Scenario: avatar speaks with tutor output

Given the tutor response starts, when `tutor.speech_started` and
`tutor.speech_delta` are emitted, then the avatar enters `speak` state using
tutor-approved text/audio only.

### Scenario: avatar failure does not break the lesson

Given the avatar provider fails, when `connection.degraded` is emitted, then the
lesson continues and the UI falls back to a static avatar state.
