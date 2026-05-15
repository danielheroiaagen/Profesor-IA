# Premium Avatar Classroom Experience Specification

## Purpose

Defines the non-negotiable visual, accessibility, and interaction standard for the publishable `/lesson` experience.

## Requirements

### Requirement: Avatar-first premium classroom

The system MUST present the lesson as a premium private tutor session where the configured HeyGen avatar identity (`552426f4e4584a24871c5ffad2a97f73`) is the dominant visual element in the first viewport.

#### Scenario: Learner opens the lesson

- GIVEN the learner opens `/lesson`
- WHEN the screen renders
- THEN the configured teacher/avatar stage is visually dominant
- AND the page does not resemble a debug form or default HTML controls.

#### Scenario: Avatar is unavailable

- GIVEN live HeyGen avatar presentation is unavailable
- WHEN the learner views or starts the class
- THEN the UI shows an intentional premium fallback teacher state
- AND it does not claim the avatar is live or moving.

### Requirement: Configured live avatar identity

The system MUST use the configured HeyGen avatar identity for the tutor surface and MUST NOT present an anonymous/generated tutor as the final product experience.

#### Scenario: Design references the tutor

- GIVEN a design or implementation represents the teacher
- WHEN the tutor surface appears
- THEN it is tied to avatar ID `552426f4e4584a24871c5ffad2a97f73`
- AND the UI does not imply a different stock avatar is the product teacher.

#### Scenario: Live avatar cannot render

- GIVEN the configured avatar cannot move or speak in the browser
- WHEN the learner starts the lesson
- THEN the UI shows an honest premium fallback
- AND the release is blocked unless the blocker is documented.

### Requirement: Live tutor state clarity

The system MUST communicate whether the tutor is connecting, listening, speaking, correcting, completed, or in safe fallback without relying only on color.

#### Scenario: Voice connection starts

- GIVEN the learner starts the class
- WHEN mic/WebRTC setup is in progress
- THEN the UI describes the setup state in learner language
- AND preserves hidden credential boundaries.

#### Scenario: Tutor feedback arrives

- GIVEN the lesson receives feedback
- WHEN visible correction updates
- THEN the UI makes the correction prominent
- AND the learner can identify the next action.

### Requirement: Accessible premium interaction

The system MUST keep the premium UI keyboard-accessible, contrast-safe, and understandable for assistive technology.

#### Scenario: Keyboard-only learner uses the lesson

- GIVEN the learner navigates by keyboard
- WHEN focus moves through controls
- THEN focus is visible
- AND the primary lesson actions are reachable in a logical order.

#### Scenario: Learner needs status announcements

- GIVEN voice/avatar status changes
- WHEN status text updates
- THEN the changed state is exposed with semantic status/alert patterns where appropriate.

### Requirement: Realtime voice model lock

The system MUST use OpenAI `gpt-realtime-2` for the live voice tutor session unless a future approved SDD explicitly changes the model.

#### Scenario: Learner starts voice class

- GIVEN the learner starts the class
- WHEN the server mints the Realtime session
- THEN the returned model is `gpt-realtime-2`
- AND the browser uses only the limited server-minted credential.

#### Scenario: Design references voice intelligence

- GIVEN the UI mentions the voice engine
- WHEN technical evidence is shown
- THEN it references `gpt-realtime-2` only as secondary protected-session context
- AND it does not expose API keys, raw SDP, or client secrets.

### Requirement: Regression-safe realtime layer

The system MUST keep OpenAI `gpt-realtime-2`, API contracts, secret handling, Realtime connection semantics, XP rules, and verified fallback behavior valid during this redesign.

#### Scenario: Verification runs after redesign

- GIVEN the premium UI has been implemented
- WHEN `npm run verify` and live browser validation run
- THEN existing `gpt-realtime-2`, WebRTC, HeyGen avatar/fallback, and XP behavior remain valid.
