# Browser/audio validation

Use this local, opt-in workflow to prove the real microphone/WebRTC path without turning secrets into evidence. Default CI stays deterministic.

## Quick path

1. Run `npm run dev`.
2. Open `http://localhost:3000/lesson` in a browser with microphone support.
3. Click **Start voice lesson**.
4. Grant microphone permission for the live path, or deny it to validate fallback.
5. Record the result with the template below.

## Safe evidence rules

Allowed: browser/OS, outcome, failure category, visible UI state, and config variable names like `OPENAI_API_KEY` or `OPENAI_REALTIME_MODEL`.

Forbidden: `.env` values, primary API keys, client secret values, SDP payloads, screenshots containing secrets, and raw provider responses.

## Outcome categories

| Outcome | Use when |
|---|---|
| `passed` | Mic capture, server Realtime session, and WebRTC attempt all worked. |
| `blocked-by-environment` | Browser permission, device, network, quota, or provider config blocked validation. |
| `failed-by-product` | Local prerequisites were valid, but the app flow or fallback broke. |

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
- Notes:
- Safety checked: no `.env`, keys, client secrets, SDP, or raw provider responses included.
```

## Automated checks

Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `npm audit` before opening a PR. These checks must not require live microphone hardware or live provider calls.
