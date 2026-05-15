# MVP release evidence

This page records share-safe evidence for the current Profesor IA MVP release candidate. It exists so reviewers can verify the ship/no-ship decision from the repository without relying on chat history or local secrets.

## Current result

| Check                      | Result                                                                                                                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Release candidate commit   | `ef5c1a2`                                                                                                              |
| Local quality gate         | `npm run verify` passed on 2026-05-15                                                                                  |
| Production runtime smoke   | `readiness=ready http=200`; `readiness-server=ready`                                                                   |
| Live browser/audio outcome | `passed`                                                                                                               |
| Browser and OS             | Brave on macOS                                                                                                         |
| App URL                    | `http://127.0.0.1:3000/lesson`                                                                                         |
| Microphone branch          | granted                                                                                                                |
| Realtime/WebRTC            | `voz lista` during the lesson; `sesión cerrada` after completion                                                       |
| Realtime model             | `gpt-realtime-2 · credencial limitada`                                                                                 |
| Avatar/HeyGen              | `tutor visual disponible`                                                                                              |
| Evidence counters          | `Prácticas: 2 · Feedback: 4`                                                                                           |
| XP result                  | `+50 XP ganados`                                                                                                       |
| Final lesson state         | `clase completada`                                                                                                     |
| Secret-safety check        | Passed: no `.env` values, primary keys, client secrets, SDP payloads, screenshots, or raw provider responses included. |

## Ship decision

| Decision            | Status                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| Local MVP           | Ship candidate passed live validation.                                                                |
| Public/deployed MVP | Not yet decided; follow [`docs/deployment.md`](deployment.md) and run a deployed readiness URL check. |

## Notes

- The visible total showed `100 XP guardados` because the browser already had prior local XP; this validation run contributed `+50 XP ganados`.
- Avatar availability is treated as a safe enhancement. This run showed the configured avatar as visually available; if a later provider run fails, the MVP can still ship only if the voice lesson remains usable and the fallback copy is safe.
- Evidence intentionally records names and visible states only. It does not record secret values or raw provider payloads.
