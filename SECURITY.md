# Security Policy

## Supported Versions

Only the latest release on the `main` branch is actively maintained.

| Version | Supported |
|---------|-----------|
| latest (`main`) | ✅ |
| older commits   | ❌ |

## Reporting a Vulnerability

If you discover a security vulnerability, **please do not open a public issue**.

Instead, report it privately by opening a
[GitHub Security Advisory](https://github.com/UKFatGuy/Godbound-Toolkit/security/advisories/new)
or by emailing the repository owner directly (see the GitHub profile for contact details).

Please include:
- A description of the vulnerability
- Steps to reproduce it
- The potential impact
- Any suggested fix if you have one

You can expect an acknowledgement within **7 days** and a resolution or status update within **30 days**.

## Scope

This is a personal TTRPG companion tool. The main areas of concern are:

- The Express API (`POST /api/data`) — data written to the server
- The share URL feature — `?share=` base64 parameter parsed by the client
- Dependency vulnerabilities (reported automatically via Dependabot)
