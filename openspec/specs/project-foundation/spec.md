# Project Foundation Specification

## Purpose

Defines baseline setup, safety, and review guidance required before implementation.

## Requirements

### Requirement: Documented safe setup

The project MUST document setup and safety guidance without revealing `.env` values or primary vendor secrets.

#### Scenario: Developer reads setup guidance

- GIVEN a developer opens project documentation
- WHEN they follow setup instructions
- THEN required configuration names and safety rules are visible
- AND actual secret values are not documented.

#### Scenario: Secret accidentally needed for troubleshooting

- GIVEN troubleshooting requires checking configuration
- WHEN documentation explains the check
- THEN it references variable names or validation steps only
- AND does not ask to paste secrets into browser code, commits, or logs.

### Requirement: Reviewable foundation work

The project SHOULD define implementation and verification guidance so future work can be delivered in reviewable slices.

#### Scenario: Implementation planning begins

- GIVEN the specs are accepted
- WHEN design and tasks are created
- THEN voice, avatar, gamification, and foundation work have clear boundaries
- AND oversized changes are planned as chained review slices.

### Requirement: Documented browser/audio validation workflow

The project MUST document how to validate browser audio behavior locally, including commands, required configuration variable names, expected evidence, and explicit secret-safety constraints.

#### Scenario: Developer follows validation documentation

- GIVEN a developer opens the project setup or validation documentation
- WHEN they prepare browser/audio validation
- THEN they can identify the local command sequence and required variable names
- AND they are warned not to print, paste, commit, or expose secret values.

#### Scenario: Validation result is reviewable

- GIVEN browser/audio validation has been attempted
- WHEN a reviewer inspects the evidence
- THEN the evidence distinguishes passed, blocked-by-environment, and failed-by-product outcomes
- AND the evidence is safe to share in a PR or issue.
