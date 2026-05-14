# Delta for Avatar Presenter

## ADDED Requirements

### Requirement: Intentional teacher presence fallback

The system MUST preserve a professional teacher presence when live avatar presentation is unavailable.

#### Scenario: Avatar is available

- GIVEN avatar presentation can be used
- WHEN the class starts
- THEN the teacher area presents the configured tutor identity
- AND remains secondary to the voice lesson flow.

#### Scenario: Avatar is unavailable

- GIVEN live or generated avatar presentation is unavailable
- WHEN the learner continues the class
- THEN the UI presents a static or voice-only tutor state as intentional fallback
- AND does not make the class feel broken if realtime voice remains usable.
