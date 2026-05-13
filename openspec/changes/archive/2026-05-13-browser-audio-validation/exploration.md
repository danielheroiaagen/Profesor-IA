# Exploration: Browser Audio Validation

## Finding
The MVP has Vitest/jsdom proof but not real browser/mic/WebRTC proof. The lesson client already uses `/api/lessons/start`, `/api/realtime/session`, `getUserMedia`, `RTCPeerConnection`, and server-minted Realtime credentials.

## Options
| Option | Tradeoff |
|---|---|
| Manual/live checklist | Best real proof, environment-dependent. |
| Playwright mocks | Deterministic, adds browser tooling ownership. |
| Live provider CI | Strong signal, too flaky/secret-sensitive for default CI. |

## Recommendation
Use a local opt-in browser/audio workflow plus small deterministic Vitest/jsdom checks. Keep live provider validation out of default CI and never expose `.env`, client secrets, SDP, or raw provider responses.
