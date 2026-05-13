# Delta for Realtime Voice Tutor

## ADDED Requirements
### Requirement: Browser validation of realtime lesson behavior
The realtime tutor MUST have a repeatable path exercising mic permission, WebRTC setup, server-minted credentials, and safe fallback without primary keys in the browser.
#### Scenario: Browser connects through server-minted Realtime credentials
- GIVEN local lesson page and server config, WHEN the learner starts and grants mic permission, THEN the browser requests a server session and uses the returned limited credential/URL.
#### Scenario: Browser validation covers unavailable audio or provider state
- GIVEN mic, network, or credential minting fails, WHEN validation starts, THEN the UI reports a safe actionable failure and exposes no secrets.
