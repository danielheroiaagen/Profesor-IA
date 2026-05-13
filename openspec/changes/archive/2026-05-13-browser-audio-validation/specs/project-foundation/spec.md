# Delta for Project Foundation

## ADDED Requirements
### Requirement: Documented browser/audio validation workflow
The project MUST document local browser/audio validation commands, config variable names, evidence, and secret-safety constraints.
#### Scenario: Developer follows validation documentation
- GIVEN docs are open, WHEN validation is prepared, THEN commands and variable names are visible and secret values are not requested.
#### Scenario: Validation result is reviewable
- GIVEN validation was attempted, WHEN evidence is reviewed, THEN it distinguishes passed, blocked-by-environment, and failed-by-product outcomes safely.
