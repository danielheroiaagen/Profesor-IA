# MVP release checklist

Use this checklist before calling a Profesor IA build releasable. The answer is simple: ship only when deterministic CI, production readiness, live browser/audio evidence, and secret-safety checks all pass.

## Quick path

1. Sync `main` and install dependencies.
2. Run the deterministic gate.
3. Run production readiness smoke.
4. Record one live browser/audio validation result.
5. Confirm no secret values were copied into code, docs, logs, screenshots, or PR comments.

## Release gates

| Gate               | Command or evidence                                                              | Ship rule                                                                       |
| ------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Local quality      | `npm run verify`                                                                 | Must pass before opening the release PR.                                        |
| CI quality         | GitHub Actions `CI / Verify`                                                     | Must pass on the final PR commit.                                               |
| PR contract        | GitHub Actions `PR Validation`                                                   | Must pass after the PR has exactly one `type:*` label.                          |
| Production runtime | `OPENAI_API_KEY=ci-readiness-placeholder npm run smoke:readiness:server`         | Must print `readiness=ready http=200` and `readiness-server=ready`.             |
| Deployed runtime   | `READINESS_URL="https://your-app.example/api/readiness" npm run smoke:readiness` | Must print `readiness=ready http=200`.                                          |
| Live lesson        | `docs/browser-audio-validation.md` evidence template                             | Must show `Prácticas: 1 · Feedback: 1`, `sesión cerrada`, and `+50 XP ganados`. |

## Ship / no-ship decision

| Decision                   | Criteria                                                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ship                       | All release gates pass, live evidence is recorded, and no secret values appear in artifacts.                                                                        |
| Do not ship                | Any deterministic gate fails, readiness is `degraded`, live audio/WebRTC cannot be validated, XP is denied after valid participation, or evidence includes secrets. |
| Ship with known limitation | Voice lesson passes but avatar is unavailable; this is acceptable only when the UI falls back to voice-only/static avatar safely.                                   |

## Secret-safety check

Before release, verify artifacts include names only, never values:

- Allowed: `OPENAI_API_KEY`, `OPENAI_REALTIME_MODEL`, `HEYGEN_API_KEY`, `HEYGEN_AVATAR_ID`.
- Forbidden: `.env` values, primary API keys, Realtime client secrets, SDP payloads, raw provider responses, and screenshots containing secrets.

## Release evidence template

```md
- Release candidate commit:
- Local gate: npm run verify — passed | failed
- CI gate: passed | failed
- PR validation: passed | failed
- Production smoke: readiness=ready http=200; readiness-server=ready — yes | no
- Deployed smoke URL: n/a | URL checked
- Browser/audio evidence file or comment:
- Live outcome: passed | blocked-by-environment | failed-by-product
- XP result: +50 XP ganados | other
- Avatar mode: live | generated | static | voice-only
- Secret-safety checked: yes | no
- Ship decision: ship | do not ship | ship with known limitation
- Notes:
```

## Related docs

- [`README.md`](../README.md) — project overview and quick path.
- [`docs/setup.md`](setup.md) — setup, readiness smoke, and verification commands.
- [`docs/browser-audio-validation.md`](browser-audio-validation.md) — live browser/audio evidence workflow.
