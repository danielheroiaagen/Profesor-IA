# Proposal: Go Backend + PostgreSQL Platform

## Why

The latest product direction adds live avatar orchestration and real RAIO/YouTalk curriculum depth. The current MVP is a validated Next.js voice lesson, but its durable progress is process-local and the existing roadmap recommended Supabase. The user has now changed the platform decision: use PostgreSQL for data and Go for the backend.

This change updates the architecture path before implementation so we do not bolt a serious backend onto the product blindly. CONCEPTS FIRST, code second.

## What Changes

- Replace Supabase-hosted data/auth/storage roadmap with standalone PostgreSQL plus a Go backend service.
- Keep the current Next.js MVP deployable while Phase 2 introduces Go in small slices.
- Move durable backend ownership toward Go: progress, auth/session, curriculum, lesson attempts, and later avatar orchestration.
- Keep browser security boundaries: no PostgreSQL URLs, primary OpenAI keys, provider tokens, SDP payloads, or raw provider responses in client code or evidence.

## What Does Not Change Yet

- The current MVP voice loop remains OpenAI Realtime `gpt-realtime-2`.
- The avatar remains non-blocking and visual-only until a separate approved live-avatar spec changes that contract.
- `/lesson` should continue to work while backend migration is staged.
- Phase 1 deploy/live validation is still the immediate release gate for the current MVP.

## Scope

### In

- Architecture decision documentation.
- Roadmap update from Supabase to PostgreSQL + Go.
- Initial SDD plan for backend migration slices.
- Security and deployment guidance for the new backend boundary.

### Out

- Implementing Go service code in this docs-only slice.
- Creating PostgreSQL migrations in this slice.
- Moving Realtime or avatar provider calls to Go in this slice.
- Implementing avatar speech, gesture, interruption, or lipsync behavior.
- Importing full NotebookLM/RAIO curriculum content into the app.

## Acceptance Criteria

- Project guidance no longer recommends Supabase as the default product path.
- Deployment docs describe Next.js frontend + Go backend + PostgreSQL as the product platform target.
- Future implementation is sliced so the first code PR can add only a small Go health/readiness foundation.
- Security docs explicitly prohibit browser exposure of PostgreSQL credentials and backend secrets.

## Risks

- Rewriting backend ownership too early can destabilize the validated MVP.
- PostgreSQL without managed operations creates backup, restore, upgrade, and security responsibilities.
- Go + Next.js split introduces deployment, observability, and API-contract complexity.
- Avatar live interaction should not be mixed into the database/backend migration.

## Recommended Next

Proceed to the first implementation slice only after this proposal/design/tasks are accepted:

1. Add Go backend skeleton with `/healthz` and `/readyz`.
2. Add Go tests and CI/local commands.
3. Add PostgreSQL local development setup and migrations in a separate slice.
