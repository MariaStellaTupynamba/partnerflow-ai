# Architecture

PartnerFlow AI is an npm-workspaces monorepo with a Next.js frontend and a FastAPI backend,
sharing a Postgres database. This document describes the platform foundation (milestone 1) and
the authenticated frontend shell built on top of it (milestone 2): what exists, what deliberately
doesn't yet, and why key decisions were made the way they were.

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
- **Auth UI:** `/register` and `/login` pages (client components, plain `useState` forms — no
  form library, not needed at this size) call `apiClient.register` / `.login`, then redirect to
  `/dashboard`. `/dashboard` is a Server Component that calls `src/lib/server-auth.ts`'s
  `getCurrentUser()` — this exists *separately* from the browser-only `apiClient` because a
  server-side fetch has no cookie jar of its own; it has to read the incoming request's cookies via
  `next/headers` and forward them explicitly. Unauthenticated visits redirect to `/login` before
  any protected content renders (no flash of content).

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

JWT-based, delivered as **httpOnly cookies**, not a JSON token in the response body:

- `POST /api/v1/auth/register` — create a user (bcrypt-hashed password, unique email), then log
  them in immediately (sets cookies) rather than requiring a separate login call.
- `POST /api/v1/auth/login` — verify credentials, set `access_token` + `refresh_token` cookies.
- `POST /api/v1/auth/refresh` — reads `refresh_token` from its cookie (not a request body), issues
  a new cookie pair. `204 No Content`.
- `POST /api/v1/auth/logout` — clears both cookies. `204 No Content`.
- `GET /api/v1/auth/me` — return the authenticated user, reading `access_token` from its cookie.

**Why cookies instead of returning tokens in the JSON body:** httpOnly cookies aren't readable by
JavaScript, so a token can't be exfiltrated by an XSS payload the way a token sitting in
`localStorage` or a JS-visible variable can. The trade-off is real complexity, all contained in
`app/core/cookies.py` and `app/core/config.py`'s `cookie_secure` / `cookie_samesite` properties:

- Frontend (Cloudflare Workers) and backend (Render) are on **different registrable domains** in
  production, so cross-site cookies need `SameSite=None; Secure`. Locally both run on `localhost`
  (different ports only — same *site*, since the site is determined by domain, not port), so
  `SameSite=Lax` works without `Secure`, which matters because browsers refuse `Secure` cookies
  over the plain HTTP that local dev uses. This is why the cookie attributes are computed from
  `settings.environment` rather than hardcoded.
- `access_token` is scoped `Path=/` (every endpoint may need it); `refresh_token` is scoped
  `Path=/api/v1/auth` (only the refresh/logout endpoints ever need to see it).
- The frontend's `apiClient` always sends `credentials: "include"`; a **server-side** fetch (used
  by `/dashboard`'s auth check) has no browser cookie jar and must forward the incoming request's
  `Cookie` header explicitly — see `src/lib/server-auth.ts`.

Other library/design choices:

- **PyJWT instead of python-jose**, and **`bcrypt` directly instead of Passlib.** Passlib is
  unmaintained (last release in 2020) and has a known incompatibility with modern `bcrypt`
  releases (it probes `bcrypt.__about__.__version__`, which no longer exists). PyJWT and `bcrypt`
  are simpler, actively maintained, and avoid that failure mode entirely.
- **No server-side refresh-token store yet.** Refresh tokens are stateless JWTs; there is no
  revocation list or rotation tracking, so `logout` clears the cookies but doesn't invalidate the
  token itself — a stolen token remains valid until it expires. This is acceptable for this
  milestone but is a known gap — adding a persisted, revocable refresh-token table is planned
  hardening for later, before this would be treated as production-ready auth.
- **No automatic silent token refresh on the frontend.** When the 30-minute access token expires,
  the user is redirected to `/login` rather than the app transparently calling `/refresh` and
  retrying. Implementing that properly needs a place that can *write* cookies on the response
  (a Server Action or Middleware — a plain Server Component render cannot set cookies in Next.js),
  which is meaningful added complexity deferred until it's actually needed.
- **No CSRF token.** `SameSite=None` cookies (used in production, cross-site) don't provide CSRF
  protection the way `Lax`/`Strict` do. This is currently low-risk because the only endpoints that
  accept cookies are the auth endpoints themselves (forging a login/register request requires
  already knowing the victim's password) — this will need revisiting once real state-changing,
  authenticated endpoints (e.g. creating a proposal) exist.
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

## Testing notes

- Backend tests never run against the database configured in `DATABASE_URL` directly —
  `tests/conftest.py` derives `<db>_test` and creates it if missing. This was a real bug found
  during development: the original version ran `Base.metadata.drop_all` against whatever database
  was configured, which silently wiped a local dev/e2e database that happened to share the same
  Postgres instance. Always test against an isolated database, never the one a developer might
  also be poking at manually.
- The Playwright auth e2e spec (`apps/web/e2e/auth.spec.ts`) hits a real running backend + Postgres
  — it isn't mocked. Running it locally means the backend and `db` need to actually be up first
  (see the README's testing section).

## Deliberate scope boundaries

- No vendor/proposal domain models yet — milestones 1-2 are the platform foundation, deployment,
  and an authenticated shell. No sourcing/comparison/partner-management features exist.
- No refresh-token revocation/rotation storage, no CSRF token, no silent token refresh (all above).
- The AI provider abstraction is unused by any endpoint.
- `/dashboard` is a placeholder — it shows the signed-in user's email and nothing else.
