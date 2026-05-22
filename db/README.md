# PostgreSQL

Profesor IA uses PostgreSQL as the durable product data store for the Go backend roadmap.

This slice adds schema migrations only. It does **not** connect the Go API to the database yet and does **not** migrate the current MVP progress behavior.

## Local database

Use any local PostgreSQL instance. Keep connection values out of commits, screenshots, logs, and PR descriptions.

Suggested local flow:

```bash
createdb profesor_ia_dev
export POSTGRES_URL="postgres://USER:PASSWORD@localhost:5432/profesor_ia_dev?sslmode=disable"
psql "$POSTGRES_URL" -f db/migrations/0001_learning_core.up.sql
```

Rollback for local development:

```bash
psql "$POSTGRES_URL" -f db/migrations/0001_learning_core.down.sql
```

## Configuration names

| Name | Scope | Purpose |
| --- | --- | --- |
| `POSTGRES_URL` | Server only | PostgreSQL connection string for Go API/database tooling. |

Do not create `NEXT_PUBLIC_POSTGRES_URL` or expose any database connection details to browser code.

## Schema areas

The first migration prepares tables for:

- users and server-managed sessions,
- curriculum units and lesson plans,
- lesson attempts and lesson events,
- visible feedback events,
- idempotent XP progress awards.

XP awards are intentionally tied to a unique lesson attempt so the backend can preserve the current rule: no duplicate XP for the same completed attempt.
