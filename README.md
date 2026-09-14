# TETA+PI Web

[![CodeQL](https://github.com/teta-pi/web/actions/workflows/codeql.yml/badge.svg)](https://github.com/teta-pi/web/actions/workflows/codeql.yml) [![Dependency audit](https://github.com/teta-pi/web/actions/workflows/npm-audit.yml/badge.svg)](https://github.com/teta-pi/web/actions/workflows/npm-audit.yml) [![Deploy](https://github.com/teta-pi/web/actions/workflows/deploy.yml/badge.svg)](https://github.com/teta-pi/web/actions/workflows/deploy.yml)

Next.js 15 app for **TETA+PI** — Trust Infrastructure for Digital Entities.
Live at [`app.tetapi.dev`](https://app.tetapi.dev).

Create your verified profile, add content blocks (signed with C2PA and
anchored on Bitcoin), and get discovered by AI agents through the registry.

## Pages
- `/` — search verified entities
- `/claim` — create a profile (early access)
- `/profile` — manage your page and blocks
- `/settings`, `/login` — account
- `/admin` — back office (owner only)
- `/e/[slug]` — public entity page

## Stack
Next.js 15 (App Router) · TypeScript · Tailwind CSS · zustand.

## Docs
Canonical docs — architecture, API contracts, coding rules — live in
[`teta-pi/infra`](https://github.com/teta-pi/infra).

## License
MIT © 2026 TETA+PI · tetapi.dev
