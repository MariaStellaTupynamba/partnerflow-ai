# Architecture

PartnerFlow AI is an npm-workspaces monorepo with a Next.js frontend and a FastAPI backend,
sharing a Postgres database. This document describes the milestone-1 foundation: what exists,
what deliberately doesn't yet, and why key decisions were made the way they were.

## Repository layout

```
apps/
  web/               Next.js (App Router) frontend — TypeScript, Tailwind CSS
  api/                FastAPI backend — Python, SQLAlchemy 2, Alembic
packages/
  shared-types/       TypeScript types shared across frontend packages
docs/                 Architecture and process documentation
.github/workflows/    CI (separate pipelines for web and api)
docker-compose.yml    Local dev environment: Postgres + API + web
```

## Frontend (`apps/web`)

- **Next.js 16, App Router, Turbopack, React 19, TypeScript (strict), Tailwind CSS v4.**
  Scaffolded with `create-next-app`; these are the current stable releases as of this milestone.
- **Testing:** Vitest + React Testing Library for unit tests (`apps/web/tests`), Playwright for
  end-to-end smoke tests (`apps/web/e2e`).
- **`src/lib/api-client.ts`** is a thin typed wrapper around `fetch`, using the shared response
  types from `@partnerflow/shared-types`. The homepage renders a live `ApiHealthStatus` component
  that calls the backend's `/health` endpoint — a deliberate choice to prove the two apps are
  actually wired together, not just visually scaffolded.

## Backend (`apps/api`)

- **FastAPI, SQLAlchemy 2 (async), Alembic, Pydantic v2, pydantic-settings.**
- **Database driver:** `psycopg` (v3), used for both the app's async engine
  (`postgresql+psycopg://`) and Alembic's synchronous migration engine. Using one driver for both
  avoids depending on `asyncpg` and `psycopg2` simultaneously.
- **JSON casing:** response/request schemas extend `CamelModel` (`app/schemas/base.py`), which
  applies a camelCase alias generator. This makes the wire format match the hand-written
  TypeScript types in `packages/shared-types` directly, while Python code stays snake_case.
- **Routing convention:** `/health` is unversioned (infrastructure probes shouldn't need to track
  an API version); feature endpoints are under `/api/v1`.

### Authentication

JWT-based, implemented in this milestone:

- `POST /api/v1/auth/register` — create a user (bcrypt-hashed password, unique email).
- `POST /api/v1/auth/login` — verify credentials, issue an access + refresh token pair.
- `POST /api/v1/auth/refresh` — exchange a valid refresh token for a new token pair.
- `GET /api/v1/auth/me` — return the authenticated user (Bearer access token required).

Library choices, and why they differ from the original plan:

- **PyJWT instead of python-jose**, and **`bcrypt` directly instead of Passlib.** Passlib is
  unmaintained (last release in 2020) and has a known incompatibility with modern `bcrypt`
  releases (it probes `bcrypt.__about__.__version__`, which no longer exists). PyJWT and `bcrypt`
  are simpler, actively maintained, and avoid that failure mode entirely.
- **No server-side refresh-token store yet.** Refresh tokens are stateless JWTs; there is no
  revocation list or rotation tracking. This is acceptable for a foundation milestone but is a
  known gap — adding a persisted, revocable refresh-token table is planned hardening for a later
  milestone, before this would be treated as production-ready auth.
- Passwords are capped at 72 bytes at the schema layer (`PASSWORD_MAX_LENGTH`) because `bcrypt`
  itself rejects longer input; validating in Pydantic turns that into a clean `422` instead of a
  raw exception.

### AI provider abstraction

`app/services/ai/` defines an `AIProvider` interface and one concrete implementation,
`OpenAICompatibleProvider`, which calls any `/chat/completions`-compatible endpoint (OpenAI, Azure
OpenAI, or a self-hosted gateway) over HTTP via `httpx`. It is fully real — no mocked or
hard-coded responses — but **no route calls it yet**. Milestone 1 only establishes the
abstraction so future vendor-sourcing/proposal-comparison features are built against an interface,
not a specific vendor SDK. It's covered by a test that exercises a real HTTP request/response
cycle through `httpx.MockTransport`, confirming the integration code path itself is correct.

## Local development

`docker-compose.yml` runs three services: `db` (Postgres 16), `api` (FastAPI with `--reload`), and
`web` (`next dev`). `apps/api/Dockerfile` and `apps/web`'s dev workflow are dev-oriented
(bind-mounted source, hot reload). Production deployment uses a separate path for each app —
`apps/api/Dockerfile.prod` for the backend, the OpenNext Cloudflare adapter for the frontend — see
[deployment.md](deployment.md).

## Deliberate scope boundaries for this milestone

- No vendor/proposal domain models — this milestone is the platform foundation plus auth.
- No refresh-token revocation/rotation storage (see above).
- The AI provider abstraction is unused by any endpoint.
- Frontend and backend are functionally connected (`/health`) but there is no authenticated UI
  flow (login/register forms) yet — the backend auth API exists and is tested; building the
  frontend forms against it is future work.
