# Browser/audio validation

Use this local, opt-in workflow to prove the real microphone/WebRTC path without turning secrets into evidence. Default CI stays deterministic.

## Quick path

1. Run `npm run dev`.
2. Open `http://localhost:3000/lesson` in a browser with microphone support.
3. Click **Empezar clase**.
4. Grant microphone permission for the live path, or deny it to validate fallback.
5. When the UI shows **voz lista**, say:

   ```text
   I am practicing English today.
   ```

6. A passing run shows `Prácticas: 1 · Feedback: 1`, `sesión cerrada`, and
   `+50 XP ganados`.
7. Record the result with the template below.

## Safe evidence rules

Allowed: browser/OS, outcome, failure category, visible UI state, and config variable names like `OPENAI_API_KEY` or `OPENAI_REALTIME_MODEL`.

Forbidden: `.env` values, primary API keys, client secret values, SDP payloads, screenshots containing secrets, and raw provider responses.

## Outcome categories

| Outcome                  | Use when                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `passed`                 | Mic capture, Realtime/WebRTC, server evidence, session close, and XP all worked.   |
| `blocked-by-environment` | Browser permission, device, network, quota, or provider config blocked validation. |
| `failed-by-product`      | Local prerequisites were valid, but the app flow or fallback broke.                |

Failure category: `microphone`, `network`, `provider`, or `app`.

## Evidence template

```md
- Date/time:
- Browser and OS:
- App URL: http://localhost:3000/lesson
- Config names present: OPENAI_API_KEY, OPENAI_REALTIME_MODEL (optional)
- Microphone branch tested: granted | denied
- Outcome: passed | blocked-by-environment | failed-by-product
- Failure category: microphone | network | provider | app | n/a
- Visible UI state:
- Evidence counters:
- XP result:
- Notes:
- Safety checked: no `.env`, keys, client secrets, SDP, or raw provider responses included.
```

## Automated checks

Run `npm run verify` before opening a PR. These checks must not require live
microphone hardware or live provider calls.

## Last validated baseline

- Date: 2026-05-15
- Browser/OS: Brave on macOS
- App URL: `http://127.0.0.1:3000/lesson`
- Outcome: `passed`
- Visible UI state: `clase completada`, `sesión cerrada`, `Prácticas: 2 ·
Feedback: 4`, `+50 XP ganados`
- Avatar/HeyGen: `tutor visual disponible`
- Evidence file: [`docs/release-evidence.md`](release-evidence.md)
- Safety checked: no `.env`, keys, client secrets, SDP, or raw provider
  responses included.
