# Profesor IA — Agent Guidance

## Scope

Build a professional AI English teacher MVP: a short realtime voice lesson, visible correction, XP feedback, and a non-blocking avatar surface.

## Security Rules

- Never read, print, commit, or expose `.env` values.
- Reference configuration by name only: `OPENAI_API_KEY`, `OPENAI_REALTIME_MODEL`, `HEYGEN_API_KEY`, `HEYGEN_AVATAR_ID`.
- Browser code must never receive primary OpenAI or HeyGen API keys.
- Browser access must use ephemeral OpenAI credentials or server-mediated avatar credentials.

## Review Budget

- Keep PR slices under the 400 changed-line review budget when practical.
- Current chain: PR 1 foundation → PR 2 domain/API → PR 3 voice UI → PR 4 avatar spike → PR 5 verification/docs.
- This slice is PR 1 foundation only; do not implement domain, API, voice UI, or avatar integration here.

## Quality Bar

- Keep product rules in `src/domain/*`.
- Keep vendor calls in `src/integrations/*`.
- Keep server-only configuration in `src/config/server.ts` or adjacent server-only modules.
- Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` before marking later slices ready.
