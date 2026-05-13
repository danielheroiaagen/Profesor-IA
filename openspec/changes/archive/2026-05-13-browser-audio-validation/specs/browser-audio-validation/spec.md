# Browser Audio Validation Specification

## Purpose
Defines secret-safe local validation for browser microphone, WebRTC, Realtime credential, fallback, and evidence behavior.

## Requirements
### Requirement: Local browser/audio validation workflow
The project MUST provide a repeatable local workflow with microphone permission and server-minted Realtime credentials. Live provider validation MUST be opt-in and outside default CI.
#### Scenario: Validates the live happy path
- GIVEN local server config by name, WHEN a developer starts `/lesson` and grants mic permission, THEN the browser attempts mic capture/WebRTC and uses a limited server credential.
#### Scenario: Separates environment failure from product failure
- GIVEN mic, network, quota, or provider config is unavailable, WHEN validation cannot complete, THEN the result identifies the dependency category and does not claim product validation.
### Requirement: Secret-safe validation evidence
Evidence MUST record outcomes, dependency status, browser context, and failure category only; it MUST NOT include `.env`, primary keys, client secrets, SDP, or raw provider responses.
#### Scenario: Evidence is safe to share
- GIVEN a developer records results, WHEN evidence is reviewed or committed, THEN it references variable names only and omits token/secret/credential values.
### Requirement: Deterministic browser smoke boundary
Automated checks SHOULD use mocks/controlled states rather than live provider calls or hardware mic.
#### Scenario: CI remains provider independent
- GIVEN default checks run, WHEN browser validation is automated, THEN it avoids OpenAI calls and hardware mic requirements.
