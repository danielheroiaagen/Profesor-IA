# Avatar Presenter Specification

## Purpose

Defines the teacher visual surface while keeping avatar availability non-blocking.

## Requirements

### Requirement: Configured avatar presentation

The system SHOULD use the configured HeyGen avatar ID when live or generated avatar presentation is supported. Browser clients MUST NOT receive primary HeyGen API keys.

#### Scenario: Avatar provider is available

- GIVEN avatar presentation is enabled and supported
- WHEN a lesson starts
- THEN the teacher surface uses the configured avatar identity
- AND any browser credential is limited or server-mediated.

#### Scenario: Avatar provider rejects or lacks support

- GIVEN the configured avatar cannot be used
- WHEN the learner starts or continues a lesson
- THEN the lesson remains usable without live avatar video
- AND the learner is not blocked from voice tutoring.

### Requirement: Voice-only fallback

The system MUST preserve the lesson experience when avatar live integration is unavailable, slow, over quota, or disabled.

#### Scenario: Fallback presentation is selected

- GIVEN avatar integration is unavailable
- WHEN the lesson is active
- THEN the learner sees a static or voice-only teacher presentation
- AND realtime voice feedback remains the primary interaction.

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
