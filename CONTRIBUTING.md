# Contributing to Atelnyo Frontend

Thank you for your interest in improving the Atelnyo frontend! This document explains how to set up the project and submit changes.

## Getting started

Requirements: **Node.js ≥ 20** and npm.

```bash
git clone https://github.com/atelnyo/Atelnyo-Frontend.git
cd Atelnyo-Frontend
npm ci
cp .env.example .env   # fill in what you need (placeholders are fine to start)
npm run dev            # http://localhost:3000
```

The dev server proxies `/api` and `/ws` to `http://127.0.0.1:8000` by default. API-backed features need a running Atelnyo backend instance; the backend itself is private and not required to build or lint this codebase.

## Project rules

- **Never commit secrets.** Only `.env.example` (placeholders) is tracked. `.env` files are git-ignored — keep it that way.
- **Never put secrets in `VITE_` variables.** Anything prefixed `VITE_` is compiled into the public client bundle.
- Do not introduce backend code, private infrastructure, or internal documentation into this repository.

## Making changes

1. Fork the repository and create a feature branch from `main`:
   ```bash
   git checkout -b feat/my-feature
   ```
2. Keep changes focused — one feature or fix per pull request.
3. Follow the existing code style. The project uses ESLint flat config:
   ```bash
   npm run lint        # check
   npm run lint:fix    # auto-fix what's fixable
   ```

## Before opening a Pull Request

Run the checks locally:

```bash
npm test              # Vitest unit tests
npm run build         # production build must succeed
npm run lint          # no new lint errors
```

Then push your branch and open a Pull Request with:

- a short description of **what** changed and **why**
- screenshots or a screen recording for UI changes
- a note on any environment-variable additions (update `.env.example` accordingly)

## Reporting bugs and security issues

- Regular bugs: open a [GitHub Issue](../../issues) using the bug report template.
- **Security vulnerabilities: do NOT open a public issue.** See [SECURITY.md](SECURITY.md) for private reporting.

## Licensing

By contributing, you agree that your contributions will be licensed under the same license as the project (GPL-3.0-or-later) — see [LICENSE](LICENSE).
