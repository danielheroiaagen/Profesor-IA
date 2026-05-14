# Delta for Realtime Voice Tutor

## ADDED Requirements

### Requirement: Learner-facing voice state guidance

The system MUST translate realtime voice states into actionable learner guidance instead of making raw connection states the primary UI.

#### Scenario: Voice setup is in progress

- GIVEN the learner starts the class
- WHEN microphone or realtime setup is pending
- THEN the UI tells the learner what is happening
- AND keeps sensitive credential details hidden.

#### Scenario: Voice setup fails safely

- GIVEN microphone, network, or provider setup fails
- WHEN the learner sees the failure state
- THEN the UI explains the next safe action
- AND no primary API key, `.env` value, raw SDP, or client secret is shown.
