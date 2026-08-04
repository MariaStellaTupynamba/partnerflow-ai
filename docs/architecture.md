# Architecture

PartnerFlow AI is an npm-workspaces monorepo with a Next.js frontend and a FastAPI backend,
sharing a Postgres database. This document covers the platform foundation (milestone 1), the
authenticated frontend shell (milestone 2), and the first real product features — vendors,
proposals, and AI-assisted comparison (milestone 3): what exists, what deliberately doesn't yet,
and why key decisions were made the way they were.

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
  `/dashboard`. Unauthenticated visits to any `/dashboard/**` route redirect to `/login` before
  any protected content renders (no flash of content).
- **`src/lib/server-api.ts`** is the Server Component counterpart to `apiClient` — used by every
  page under `/dashboard` for the initial server-rendered data (current user, vendors, proposals).
  It exists *separately* from the browser-only `apiClient` because a server-side fetch has no
  cookie jar of its own; it reads the incoming request's cookies via `next/headers` and forwards
  them explicitly. It talks to `env.internalApiUrl`, not `env.apiUrl` — see the Docker Compose
  gotcha below for why those two are sometimes different URLs.
- **Vendor/proposal UI:** a vendor list (`/dashboard`), vendor detail with its proposals
  (`/dashboard/vendors/[vendorId]`), create/edit forms for both (`VendorForm`/`ProposalForm`,
  shared between their `new` and `edit` pages since the fields are identical either way), and a
  cross-vendor comparison page (`/dashboard/compare`). Delete actions (`DeleteVendorButton`,
  `DeleteProposalButton`) are small client components — a Server Component can't pass an
  `onClick` callback down to one (functions aren't serializable across that boundary), so each
  takes a plain string ID prop and makes its own `apiClient` call.

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
  by every `/dashboard` page's auth check) has no browser cookie jar and must forward the incoming
  request's `Cookie` header explicitly — see `src/lib/server-api.ts`.

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
  protection the way `Lax`/`Strict` do. This was low-risk when only auth endpoints existed
  (forging a login/register request requires already knowing the victim's password), but is now a
  real, live gap — milestone 3 added authenticated, state-changing endpoints (create/update/delete
  a vendor or proposal) that a malicious page could trigger cross-site for a logged-in user. This
  is the next hardening item that should land before this app handles anything beyond portfolio
  demo data.
- Passwords are capped at 72 bytes at the schema layer (`PASSWORD_MAX_LENGTH`) because `bcrypt`
  itself rejects longer input; validating in Pydantic turns that into a clean `422` instead of a
  raw exception.

### Domain model: vendors and proposals

`Vendor` belongs to a `User` (`owner_id`); `Proposal` belongs to a `Vendor`. All vendor/proposal
endpoints are ownership-scoped — `get_owned_vendor` / `get_owned_proposal` (`app/api/deps.py`) look
up the row *and* verify `owner_id` in one query, returning `404` (not `403`) when it doesn't
belong to the current user, so a request can't distinguish "doesn't exist" from "exists but isn't
yours." Deleting a vendor cascades to its proposals, both at the ORM level
(`cascade="all, delete-orphan"`) and the database level (`ondelete="CASCADE"` on the FK), so it
holds even for direct SQL that bypasses the ORM.

`GET /api/v1/proposals` (all of the current user's proposals, across every vendor) exists
alongside the vendor-scoped `GET /api/v1/vendors/{id}/proposals` specifically for the comparison
UI — comparing proposals is a cross-vendor operation (that's the point: comparing *different*
vendors' bids for the same need), not a within-one-vendor operation, so the frontend needed a
flat list rather than fetching per-vendor and merging client-side.

### AI provider abstraction

`app/services/ai/` defines an `AIProvider` interface and one concrete implementation,
`OpenAICompatibleProvider`, which calls any `/chat/completions`-compatible endpoint (OpenAI, Azure
OpenAI, Groq, or a self-hosted gateway) over HTTP via `httpx`. It is fully real — no mocked or
hard-coded responses. As of milestone 3 it's wired up: `POST /api/v1/proposals/compare` takes 2-10
proposal IDs (any of the current user's, across vendors), formats each into a short block (vendor
name, price, submission date, summary text), and asks the provider to compare them.

**Graceful degradation, not a fake response:** if `AI_PROVIDER_API_KEY` isn't set,
`get_ai_provider()` raises `ValueError` (from `OpenAICompatibleProvider.__init__`), which the
route catches and turns into `503 Service Unavailable` with a clear message — never a fabricated
comparison. If the provider *is* configured but the HTTP call itself fails, that's a `502`
instead. The frontend's `ProposalComparison` component just renders whatever `ApiError.message`
came back, so both cases show up as a normal, readable error state rather than a broken UI. This
was a deliberate requirement from the start of the project ("no fake AI behavior disguised as a
real integration") and is covered by tests for the configured, unconfigured, and
provider-failure cases (`tests/test_comparison.py`, mocking `get_ai_provider` — no real API key
is used or required in tests).

## Local development

`docker-compose.yml` runs three services: `db` (Postgres 16), `api` (FastAPI with `--reload`), and
`web` (`next dev`). `apps/api/Dockerfile` and `apps/web`'s dev workflow are dev-oriented
(bind-mounted source, hot reload). Production deployment uses a separate path for each app —
`apps/api/Dockerfile.prod` for the backend, the OpenNext Cloudflare adapter for the frontend — see
[deployment.md](deployment.md).

### Docker Compose: two different API URLs

`apps/web`'s `env.ts` exports both `apiUrl` (`NEXT_PUBLIC_API_URL`) and `internalApiUrl`
(`INTERNAL_API_URL`, falling back to `NEXT_PUBLIC_API_URL`). They're the same value everywhere
*except* Docker Compose, and getting this wrong is a real bug that shipped and was only caught by
testing through the actual containers rather than trusting `next dev` locally:

- The **browser** runs on the host machine, outside Compose's network — it needs
  `http://localhost:8000` (the published port).
- The **Next.js server itself** runs *inside* the `web` container. There, `localhost` means the
  `web` container, not the `api` one — nothing is listening on port 8000 there. It needs the
  Compose service DNS name instead: `http://api:8000`.

`apiClient` (browser-only) uses `apiUrl`; `server-api.ts` (Server Components) uses
`internalApiUrl`. `docker-compose.yml` sets both explicitly for the `web` service. Outside Compose
(local `next dev`, or production where Cloudflare and Render are genuinely separate public hosts
with no "internal" address), only `NEXT_PUBLIC_API_URL` is set and both resolve to the same URL.

## Testing notes

- Backend tests never run against the database configured in `DATABASE_URL` directly —
  `tests/conftest.py` derives `<db>_test` and creates it if missing. This was a real bug found
  during development: the original version ran `Base.metadata.drop_all` against whatever database
  was configured, which silently wiped a local dev/e2e database that happened to share the same
  Postgres instance. Always test against an isolated database, never the one a developer might
  also be poking at manually.
- The Playwright e2e specs (`apps/web/e2e/auth.spec.ts`, `vendors.spec.ts`) hit a real running
  backend + Postgres — they aren't mocked. Running them locally means the backend and `db` need
  to actually be up first (see the README's testing section). `vendors.spec.ts`'s comparison step
  runs with no `AI_PROVIDER_API_KEY` configured, so it verifies the graceful-503 path, not a live
  AI call — that's the actual state of the test/CI environment, not a simplification for the test.
- **Server-rendered pages need to be verified through Docker Compose specifically**, not just
  `next dev` — see the internal-vs-public API URL gotcha above, which only manifests once the
  Next.js server itself is running inside a container.

## Deliberate scope boundaries

- No refresh-token revocation/rotation storage, no CSRF token (now a live gap, not just
  theoretical — see above), no silent token refresh.
- Vendors and proposals are simple CRUD with no file/document attachments, no organizations or
  team sharing (a vendor belongs to exactly one user, not a company account), and no proposal
  status/pipeline (submitted, accepted, rejected, etc.) — just a flat list.
- The AI comparison prompt is a fixed template; there's no way to ask a follow-up question or
  steer what the comparison focuses on.
- No pagination anywhere (vendor list, proposal list, comparison candidates) — fine at demo scale,
  would need addressing before real usage.
