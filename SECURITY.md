# Security Policy

## Supported versions

Only the latest `main` branch of this repository receives security fixes.

## Reporting a vulnerability

Please **do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Instead, use GitHub's **private vulnerability reporting** for this repository:

> **Security** tab → **Report a vulnerability**

This keeps the details confidential until a fix is ready. If private reporting is unavailable for some reason, contact the maintainers directly by email at **devroseacademy@gmail.com** with `[SECURITY]` in the subject.

## What to include

- A description of the issue and its impact
- Step-by-step instructions or a proof of concept to reproduce it
- Affected URLs, routes, or components
- Any possible mitigations you've identified

## What this repository is (and isn't)

- This repository contains **only the public client-side frontend** of the Atelnyo platform. The API and all server-side components are private and out of scope for this repository's issue tracker.
- Client-visible values (Firebase web config, public API base URL, Google OAuth client ID) are public by design and are **not** vulnerabilities.
- Reports about the API or backend infrastructure should be raised through the private reporting channel above — not in this repository.

## Response targets

- **Acknowledgement:** within 7 days
- **Status update:** within 14 days
- We aim to coordinate disclosure: details are published once a fix is available.
