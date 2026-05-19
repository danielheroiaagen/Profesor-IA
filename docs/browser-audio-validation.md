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

6. A passing run shows `Prácticas: 1 · Feedback: 1`, `sesión cerrada`,
   `+50 XP ganados`, and `gpt-realtime-2 · credencial limitada`.
7. Record the result with the template below.

## Safe evidence rules

Allowed: browser/OS, outcome, failure category, visible UI state, and config variable names like `OPENAI_API_KEY` or `OPENAI_REALTIME_MODEL`.

Forbidden: `.env` values, primary API keys, client secret values, SDP payloads, screenshots containing secrets, and raw provider responses.

## Outcome categories

| Outcome                  | Use when                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `passed`                 | Mic capture, Realtime/WebRTC, server evidence, session close, and XP all worked.                                |
| `blocked-by-environment` | Browser permission, device, network, quota, provider config, or missing live-browser access blocked validation. |
| `failed-by-product`      | Local prerequisites were valid, but the app flow or fallback broke.                                             |

Failure category: `microphone`, `network`, `provider`, `app`, or `environment`.

## Evidence template

```md
- Date/time:
- Browser and OS:
- App URL: http://localhost:3000/lesson
- Config names present: OPENAI_API_KEY, OPENAI_REALTIME_MODEL (optional)
- Microphone branch tested: granted | denied
- Outcome: passed | blocked-by-environment | failed-by-product
- Failure category: microphone | network | provider | app | environment | n/a
- Visible UI state:
- Evidence counters:
- XP result:
- Realtime model label:
- Avatar mode:
- Notes:
- Safety checked: no `.env`, keys, client secrets, SDP, or raw provider responses included.
```

## Automated checks

Run `npm run verify` before opening a PR. These checks must not require live microphone hardware or live provider calls.

## Current release-candidate status

- Date: 2026-05-19
- Branch: `codex/premium-avatar-06-release-evidence`
- Local deterministic gate: `npm run verify` passed
- Production smoke: `readiness=ready http=200`; `readiness-server=ready`
- Live browser/mic outcome in this agent session: `blocked-by-environment`
- Reason: no live browser/microphone tool is available inside the agent harness, and `.env` values were intentionally not read.
- Evidence file: [`docs/release-evidence.md`](release-evidence.md)
- Safety checked: no `.env`, keys, client secrets, SDP, screenshots, or raw provider responses included.

## Last validated live baseline

- Date: 2026-05-15
- Browser/OS: Brave on macOS
- App URL: `http://127.0.0.1:3000/lesson`
- Outcome: `passed`
- Visible UI state: `clase completada`, `sesión cerrada`, `Prácticas: 2 · Feedback: 4`, `+50 XP ganados`
- Avatar/HeyGen: `tutor visual disponible`
- Evidence file: [`docs/release-evidence.md`](release-evidence.md)
- Safety checked: no `.env`, keys, client secrets, SDP, or raw provider responses included.
