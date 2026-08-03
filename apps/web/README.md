# apps/web — PartnerFlow AI frontend

Next.js (App Router) frontend for PartnerFlow AI. See the [repository root README](../../README.md)
for the full project overview and [docs/architecture.md](../../docs/architecture.md) for design
rationale.

## Development

```bash
npm install
npm run dev --workspace apps/web
```

Runs at http://localhost:3000. Requires the backend (`apps/api`) running at
`NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`) for the API health indicator on the
homepage to report "online".

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest unit tests |
| `npm run test:e2e` | Playwright end-to-end tests |
| `npm run format` | Check formatting with Prettier |
