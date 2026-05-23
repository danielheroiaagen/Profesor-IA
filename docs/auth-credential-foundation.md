# Auth Credential Foundation

This slice starts real Go-owned credential auth without adding login/register routes yet.

## Decision

- Store only password hashes in PostgreSQL, never raw passwords.
- Keep `users.password_hash` nullable so existing anonymous/session migration work remains compatible.
- Use bcrypt in the Go auth boundary for this first credential slice.
- Normalize email before persistence or lookup.
- Keep session cookies HTTP-only and server-managed through the existing session package.

## Current Boundary

Implemented now:

- `users.password_hash` migration.
- Case-insensitive email uniqueness index.
- Go password hash/verify service.
- Go email normalization.
- Go credential user repository for create and find-by-email flows.
- Go register endpoint that creates a credential user and HTTP-only session cookie.

Deferred to next slices:

- `POST /v1/auth/login`.
- Next.js login/register UI.

## Security Notes

- Raw passwords must not be logged, returned, stored, or added to docs.
- Browser clients must only receive server-managed cookies, never database credentials or password hashes.
