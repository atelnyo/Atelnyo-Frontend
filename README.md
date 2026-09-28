# Atelnyo Frontend

> **Atelnyo** is an international platform where creators teach online courses, share music, sell products, and grow their digital presence.

The frontend (client-side) portion of the [Atelnyo](https://atelnyo.site) platform — a bilingual (Haitian Creole / English) learning and creator ecosystem. This repository contains the React single-page application only; the Atelnyo backend is private and not part of this repository.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

## What's inside

- **React 18** SPA served by **Vite 5**
- **Zustand** for client state, **React Router** for navigation
- **PWA** support — installable, offline fallback, push notifications (Firebase Cloud Messaging)
- **Vitest** unit tests (co-located in `src/`) and **Playwright** end-to-end tests (`e2e/`)
- **ESLint** flat config with a custom local rule (`eslint-rules/`)

## Project structure

```
├── index.html              # SPA entry point
├── vite.config.js          # Vite + Vitest configuration
├── eslint.config.js        # ESLint flat config
├── playwright.config.ts    # Playwright (e2e) configuration
├── public/                 # Static assets (icons, fonts, service workers, manifest)
├── src/
│   ├── components/         # UI components (feature-grouped)
│   ├── pages/              # Route pages
│   ├── routes/             # Route definitions
│   ├── services/           # API client, Firebase, offline queue
│   ├── store/              # Zustand stores
│   ├── hooks/              # Custom hooks
│   ├── context/            # React context providers
│   ├── utils/              # Utilities (i18n, routing, …)
│   ├── styles/             # Styles
│   ├── pwa/                # PWA system (storage, permissions, continuity)
│   ├── constants/          # Shared constants
│   ├── config/             # Frontend config data
│   ├── seo/                # SEO helpers
│   ├── accessibility/      # Accessibility helpers
│   ├── engine/             # Frontend logic engine
│   ├── modules/            # Feature modules
│   ├── data/               # Static data
│   └── test/               # Test setup
├── e2e/                    # Playwright end-to-end specs
├── scripts/                # Dev helper scripts (launchers, audits, lint gates)
└── .github/workflows/      # Frontend CI (syntax-lint + closure-leak)
```

## Requirements

- **Node.js ≥ 20**
- npm (comes with Node). A running instance of the Atelnyo backend is needed for API-backed features; see "API configuration" below.

## Installation

```bash
git clone https://github.com/atelnyo/Atelnyo-Frontend.git
cd Atelnyo-Frontend
npm install
```

## Development

```bash
npm run dev            # Vite dev server on http://localhost:3000
```

The dev server proxies `/api` and `/ws` to `http://127.0.0.1:8000` by default (see `vite.config.js`), so a locally running Atelnyo backend is picked up automatically.

Other commands:

```bash
npm run lint           # ESLint over src/
npm run lint:fix       # ESLint with auto-fix
npm test               # Vitest unit tests (run once)
npm run test:watch     # Vitest in watch mode
npm run test:e2e       # Playwright e2e tests
npm run build          # Production build to dist/
npm run preview        # Serve the production build locally
```

## Production build

```bash
npm run build
```

Outputs a static SPA to `dist/`. Serve it from any static host or CDN with an SPA fallback rewrite (unknown paths → `/index.html`); `public/_redirects` ships an example.

## Environment configuration

```bash
cp .env.example .env
```

`.env.example` lists every supported variable with placeholder values. Anything prefixed with `VITE_` is compiled into the client bundle at build time — **never put a secret in a `VITE_` variable**. `.env` files are git-ignored.

## API configuration

The SPA talks to the Atelnyo API at `VITE_API_BASE_URL` (default `/api/` in development, proxied to `127.0.0.1:8000` by the Vite dev server). In production the built bundle points at the deployed Atelnyo API. The backend itself is private — this repository contains no server code, and privileged access to the API is not granted by anything in this repo.

Third-party, browser-safe configuration (Google Sign-In client ID, Firebase web config, Stripe publishable key) is public client-side configuration by design and is documented in `.env.example`.

## Testing

```bash
npm test               # Unit tests (Vitest, jsdom)
npm run test:e2e       # End-to-end tests (Playwright)
```

The Playwright specs assume a running Vite dev server on `127.0.0.1:3000` and a locally seeded Atelnyo backend (the seed credentials in `e2e/` only work against a local dev database you create yourself — they are not real accounts).

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a Pull Request.

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push and open a Pull Request

Please run `npm run lint` and `npm test` before opening a PR.

## Security notes

- This repository intentionally contains **no backend code, no infrastructure configuration, and no secrets**. The API it targets is a separate, private service.
- Only `.env.example` (placeholders) is tracked; real `.env` files are ignored by git.
- To report a security issue, please use GitHub's private security advisory for this repository rather than a public issue.

## Relationship to the Atelnyo backend

Atelnyo is a full-stack platform; this repository is only the client side. The backend is private and not required to build or lint this codebase — only to exercise API-backed features during development. Nothing in this repository grants privileged access to the backend, and we ask that you don't attempt to bypass its authentication or rate limits.

## Security

Found a security issue? Please do **not** open a public issue — see [SECURITY.md](SECURITY.md) for how to report it privately.

## License

Copyright © 2026 Atelnyo. This project is licensed under the [GNU General Public License v3.0](LICENSE) (GPL-3.0-or-later).

This is a copyleft license: anyone who copies, modifies, or distributes this code (or a work based on it) must release it under the same GPL-3.0 license, keep the copyright notice, and make the corresponding source code available. This prevents the frontend from being taken into proprietary products.

Third-party dependencies are governed by their own licenses. Unless a separate exception is stated, shipping this frontend as part of a combined work (for example, an app bundle that includes it) makes the whole work subject to GPL-3.0.
