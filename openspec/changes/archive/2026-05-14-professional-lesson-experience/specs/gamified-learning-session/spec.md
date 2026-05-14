# Delta for Gamified Learning Session

## ADDED Requirements

### Requirement: Professional progress feedback

The system MUST present completion and XP as learner progress, not as a raw server calculation.

#### Scenario: XP is awarded

- GIVEN the learner completes the required participation loop
- WHEN the lesson ends
- THEN the UI shows a clear completion result and XP reward
- AND the result reinforces what the learner practiced.

#### Scenario: XP is not awarded

- GIVEN completion cannot be verified or participation is insufficient
- WHEN the lesson ends
- THEN the UI explains why progress was not awarded
- AND offers a retry path without blaming the learner with technical language.
