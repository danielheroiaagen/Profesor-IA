# Professional Lesson Experience Specification

## Purpose

Defines the learner-facing class experience for the MVP so it feels like a professional lesson rather than a debug panel.

## Requirements

### Requirement: Professional class surface

The system MUST present the lesson as a guided English class with teacher presence, objective, prompt, feedback, progress, and completion areas.

#### Scenario: Learner opens the lesson

- GIVEN a learner opens `/lesson`
- WHEN the page renders
- THEN the UI shows a teacher/class surface and lesson objective
- AND it does not expose raw implementation terms as the primary experience.

#### Scenario: Lesson is not connected yet

- GIVEN the lesson has not started
- WHEN the learner reviews the page
- THEN the primary action is to start the class
- AND support information is secondary to the learning flow.

### Requirement: MVP scope transparency

The system SHOULD feel polished while avoiding claims of a full curriculum platform.

#### Scenario: Learner sees the landing page

- GIVEN the learner opens `/`
- WHEN they read the product copy
- THEN it describes a focused short voice lesson
- AND it avoids debug/MVP labels in primary calls to action.
