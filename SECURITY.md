# Security

Only the latest preview receives fixes. Voxi is early-stage software; no formal
security audit or guaranteed response time is offered.

Please do not publish credentials, private playback logs or exploit details in
public issues. Use GitHub's **Security > Report a vulnerability** on this
repository if private vulnerability reporting is enabled. If that option is
unavailable, open an issue asking the maintainer for a private reporting channel
without including sensitive details, and wait for that channel before sharing.

Include the version, Windows version, affected component, impact and minimal
reproduction steps in the private report. Redact identifying information.

Voxi reads Windows media sessions and requests lyrics from external services.
See the README for the current data flow. Never commit signing keys, account
tokens, cookies, `.env` files or personal media-session dumps.
