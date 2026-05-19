# MVP release evidence

This page records share-safe evidence for the premium Profesor IA MVP release candidate. It lets reviewers verify the ship decision from repository artifacts without relying on chat history or local secrets.

## Current result

| Check                      | Result                                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Release candidate branch   | `codex/premium-avatar-06-release-evidence`                                                                            |
| Code candidate commit      | `dc9a978` (`feat(progress): hydrate lesson progress`)                                                                 |
| Local quality gate         | `npm run verify` passed on 2026-05-19                                                                                 |
| Production runtime smoke   | `readiness=ready http=200`; `readiness-server=ready`                                                                  |
| Unit/component coverage    | Vitest passed: 21 files / 65 tests                                                                                    |
| Build                      | `next build` passed                                                                                                   |
| Progress behavior          | Lesson UI hydrates `/api/progress`; completion uses server `progress.totalXp` as canonical total                      |
| Realtime/WebRTC ownership  | OpenAI Realtime remains the only voice/microphone/audio path                                                          |
| Avatar/HeyGen ownership    | LiveAvatar/HeyGen remains visual-only and non-blocking                                                                |
| Browser/audio outcome      | `blocked-by-environment` for this agent session; no live browser/mic tool is available here                           |
| Last live browser baseline | 2026-05-15: Brave on macOS passed local mic/WebRTC lesson validation                                                  |
| Secret-safety check        | Passed: no `.env` values, primary keys, client secrets, SDP payloads, screenshots, or raw provider responses included |

## Ship decision

| Decision                 | Status                                                                                                                        |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Repository MVP candidate | Ready to merge after the chained PRs are integrated in order.                                                                 |
| Public/deployed MVP      | Run the live browser/audio validation from `docs/browser-audio-validation.md` on the final deployed URL before public launch. |
| Known limitation         | This evidence update cannot prove a fresh real microphone/WebRTC run from inside the agent harness.                           |

## Validation commands recorded

```bash
npm run verify
OPENAI_API_KEY=ci-readiness-placeholder npm run smoke:readiness:server
```

Observed smoke output:

```text
readiness=ready http=200
readiness-server=ready
```

## Browser/audio evidence status

The real browser/microphone path is opt-in because it can involve live provider credentials and local hardware permissions. This agent session did not read `.env` values and did not execute a live browser microphone run.

Latest available share-safe baseline remains:

- Date: 2026-05-15
- Browser/OS: Brave on macOS
- App URL: `http://127.0.0.1:3000/lesson`
- Outcome: `passed`
- Visible UI state: `clase completada`, `sesión cerrada`, `Prácticas: 2 · Feedback: 4`, `+50 XP ganados`
- Avatar/HeyGen: `tutor visual disponible`

Before public launch, repeat the validation on the final merged build and record:

- `Prácticas: 1 · Feedback: 1`
- `sesión cerrada`
- `+50 XP ganados`
- `gpt-realtime-2 · credencial limitada`
- avatar mode as `live`, `static`, or `voice-only` honestly

## Notes

- The previous localStorage XP total is no longer canonical. Server-owned anonymous progress is now the visible source of truth after hydration/completion.
- Avatar availability is a safe enhancement. The MVP can still be accepted with `voice-only`/static fallback only if the voice lesson remains usable and fallback copy is honest.
- Evidence intentionally records names and visible states only. It does not record secret values or raw provider payloads.
