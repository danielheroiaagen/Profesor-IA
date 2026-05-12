# Realtime Voice Tutor Specification

## Purpose

Defines the observable short spoken English lesson loop and its security states.

## Requirements

### Requirement: Secure realtime lesson start

The system MUST let a learner start a short realtime voice lesson using only server-minted ephemeral or limited client credentials in the browser. Primary OpenAI API keys MUST NOT be sent to browser code, logs, or client-visible errors.

#### Scenario: Starts lesson with ephemeral credential
- GIVEN the learner has microphone permission available
- WHEN the learner starts a voice lesson
- THEN the browser receives a limited realtime credential
- AND the learner can speak with the tutor.

#### Scenario: Credential minting fails safely
- GIVEN the server cannot mint a realtime credential
- WHEN the learner starts a voice lesson
- THEN the lesson does not connect
- AND no primary API key or `.env` value is exposed.

### Requirement: Corrective spoken and visible feedback

The system MUST provide corrective feedback after meaningful learner speech and SHOULD present both audible and visible feedback when voice output is available.

#### Scenario: Tutor corrects learner speech
- GIVEN an active voice lesson
- WHEN the learner answers a prompt with an English phrase
- THEN the tutor responds with a spoken correction or reinforcement
- AND visible feedback summarizes the correction.

#### Scenario: Speech or permission unavailable
- GIVEN microphone access, network, or realtime audio fails
- WHEN the learner attempts the lesson
- THEN the system explains the failure safely
- AND offers retry or non-blocking fallback guidance.
