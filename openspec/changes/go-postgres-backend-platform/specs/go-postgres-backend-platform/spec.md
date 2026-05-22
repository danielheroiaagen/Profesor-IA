# Go Backend + PostgreSQL Platform Specification

## Purpose

Define the platform direction for replacing the previous Supabase roadmap with a Go backend and PostgreSQL while preserving the validated Profesor IA voice MVP.

## Requirements

### Requirement: PostgreSQL replaces Supabase as the product data store

The system MUST use PostgreSQL as the durable product data store for future auth/session, progress, curriculum, lesson attempts, and feedback history.

#### Scenario: Agent plans durable persistence

- GIVEN an agent plans durable product storage
- WHEN it proposes a default product architecture
- THEN it proposes PostgreSQL
- AND it does not propose Supabase-hosted Auth, Storage, RLS, or service-role keys unless a future approved spec reverses this decision.

#### Scenario: Browser code handles product state

- GIVEN browser code needs progress or curriculum data
- WHEN it requests product state
- THEN it calls approved application APIs
- AND it never receives PostgreSQL credentials or database URLs.

### Requirement: Go owns the future backend boundary

The system MUST introduce a Go backend service as the owner of durable product capabilities.

#### Scenario: Backend migration begins

- GIVEN the first backend migration slice starts
- WHEN code is added
- THEN it adds a separately testable Go service foundation
- AND it does not change the validated `/lesson` voice behavior in the same slice.

#### Scenario: Durable progress is migrated

- GIVEN progress moves from process memory
- WHEN a lesson is completed
- THEN XP awards are persisted through the Go backend and PostgreSQL
- AND awards remain idempotent and server-trusted.

### Requirement: Current MVP remains deployable during migration

The system MUST keep the current Next.js MVP deployable while Go and PostgreSQL are introduced incrementally.

#### Scenario: Phase 1 public validation runs

- GIVEN the current MVP is deployed
- WHEN readiness and browser/audio validation run
- THEN `gpt-realtime-2`, visible correction, trusted evidence, XP award, and avatar fallback remain valid.

#### Scenario: Go backend is unavailable during early slices

- GIVEN a Go foundation slice exists but is not yet product-critical
- WHEN the learner uses the current MVP
- THEN the existing voice lesson path remains usable.

### Requirement: Migration is split into reviewable work units

The system MUST split Go/PostgreSQL work into small PRs instead of one large migration.

#### Scenario: A migration slice is planned

- GIVEN the estimated diff exceeds the review budget
- WHEN tasks are prepared
- THEN chained PRs are recommended
- AND each PR owns one deliverable work unit.

### Requirement: Avatar live interaction remains separate

The system MUST NOT implement avatar speech, gesture, interruption, lipsync, or microphone ownership as part of the Go/PostgreSQL platform migration.

#### Scenario: Avatar live feature is requested

- GIVEN live avatar behavior is requested
- WHEN Go/PostgreSQL migration work is underway
- THEN avatar live behavior is handled by a separate approved spec
- AND the current Realtime voice lesson must remain usable if avatar support fails.
