# Gamified Learning Session Specification

## Purpose

Defines observable lesson completion, XP, and progress feedback.

## Requirements

### Requirement: Meaningful completion awards progress

The system MUST award XP or progress only after meaningful lesson participation, not merely opening the lesson screen.

#### Scenario: Learner completes practice loop
- GIVEN the learner has started a voice lesson
- WHEN the learner responds to prompts and receives feedback
- THEN the session can be marked complete
- AND XP or progress feedback is awarded.

#### Scenario: Learner exits before participating
- GIVEN a lesson was opened
- WHEN the learner exits before meaningful speech or feedback
- THEN completion is not awarded
- AND progress is not overstated.

### Requirement: Clear session state feedback

The system SHOULD show lesson state and reward outcome in a way the learner can understand.

#### Scenario: Completion feedback is visible
- GIVEN the lesson qualifies for completion
- WHEN XP is awarded
- THEN the learner sees the awarded XP or progress result
- AND the lesson end state is clear.

#### Scenario: Completion cannot be verified
- GIVEN a network or realtime failure interrupts completion
- WHEN the system cannot verify meaningful completion
- THEN it avoids awarding unearned progress
- AND explains whether retry is available.
