# Architecture

PartnerFlow AI is an npm-workspaces monorepo with a Next.js frontend and a FastAPI backend,
sharing a Postgres database. This document covers the platform foundation (milestone 1), the
authenticated frontend shell (milestone 2), the first real product features — vendors, proposals,
and AI-assisted comparison (milestone 3) — and CSRF protection plus a significant auth-fetching
bugfix (milestone 4): what exists, what deliberately doesn't yet, and why key decisions were made
the way they were.

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
  `/dashboard`.
- **Everything under `/dashboard` is client-rendered and fetches its own data from the browser.**
  `app/dashboard/layout.tsx` wraps every nested route in `<DashboardAuthGate>`
  (`src/lib/user-context.tsx`): on mount it calls `apiClient.me()`; while that's pending it shows
  a loading state, on success it provides the user via React context (`useCurrentUser()`), on
  failure it redirects to `/login`. Every page's data (vendor list, vendor detail, proposals) is
  likewise fetched client-side with `apiClient` in a `useEffect`, not server-rendered. This is not
  the original design — see "The cross-domain cookie bug" below for why server-side data fetching
  had to be abandoned entirely.
- **Vendor/proposal UI:** a vendor list (`/dashboard`), vendor detail with its proposals
  (`/dashboard/vendors/[vendorId]`), create/edit forms for both (`VendorForm`/`ProposalForm`,
  shared between their `new` and `edit` pages since the fields are identical either way), and a
  cross-vendor comparison page (`/dashboard/compare`). Delete actions (`DeleteVendorButton`,
  `DeleteProposalButton`) take an `onDeleted` callback prop from their parent page to update
  local state after a successful delete, rather than a full page reload.

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
- The frontend's `apiClient` always sends `credentials: "include"` — every API call is made from
  the browser, never server-side. See "The cross-domain cookie bug" below for why.

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
- Passwords are capped at 72 bytes at the schema layer (`PASSWORD_MAX_LENGTH`) because `bcrypt`
  itself rejects longer input; validating in Pydantic turns that into a clean `422` instead of a
  raw exception.

### CSRF protection (milestone 4)

`SameSite=None` cookies (required in production, since Cloudflare and Render are different
registrable domains) don't provide CSRF protection the way `Lax`/`Strict` do — a malicious page
can still make a logged-in user's browser attach their cookies to a forged request. Milestone 3
made this a real, live gap by adding authenticated, state-changing endpoints (create/update/delete
a vendor or proposal); milestone 4 closes it with the **double-submit cookie pattern**
(`app/core/csrf.py`, `app/core/cookies.py`):

- `set_auth_cookies` now also sets a third cookie, `csrf_token` — a random value, but
  deliberately **not httpOnly**, since the frontend needs to read it with JavaScript.
- The frontend (`api-client.ts`) reads that cookie and mirrors its value back as an
  `X-CSRF-Token` header on every request.
- `verify_csrf_token` (applied via `dependencies=[Depends(...)]` on every mutating vendor/
  proposal/compare route) rejects the request with `403` unless the header matches the cookie,
  using `secrets.compare_digest` for the comparison.

Why this actually stops the attack: a cross-site attacker's page can trigger a request that
carries the victim's cookies (that's unavoidable with `SameSite=None`), but it **cannot read**
the `csrf_token` cookie's value — cross-origin pages can't read another origin's cookies — so it
has no way to produce a header that matches. Only this frontend's own JavaScript, running on a
page that can actually read the cookie, can construct a valid request.

`register`/`login`/`refresh`/`logout` are deliberately exempt: register and login are what
*establish* the CSRF cookie in the first place (requiring one would be circular), and they're
already protected by requiring the victim's password. Forging a `refresh` or `logout` call only
affects the victim's own session state (new tokens they still control, or being logged out) — low
enough impact that adding the check wasn't worth the complexity, unlike vendor/proposal mutations
and the AI comparison call, which have a real cost (data changes, or triggering billed API calls)
if forged repeatedly.

One implementation subtlety: `verify_csrf_token` takes `current_user: User = Depends(get_current_user)`
as an otherwise-unused parameter, purely to force FastAPI to resolve authentication *before* the
CSRF check. Without it, an anonymous request (no cookies at all) could fail the CSRF check first
and return a confusing `403`, instead of the correct `401` for "you're not logged in." This was
caught by a test (`test_unauthenticated_request_fails_auth_before_csrf`), not by inspection.

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

### The cross-domain cookie bug (milestone 4)

Milestone 2 built `/dashboard`'s auth check as a **server-side** fetch: read the incoming
request's cookies via `next/headers`, forward them to the backend's `/api/v1/auth/me`. This shipped,
passed every test, and was live for two milestones — and it never actually worked for a real user
on the deployed site. Logging in would succeed, then `/dashboard` would silently bounce back to
`/login`, with no error.

**Root cause:** cookies are scoped to the domain that set them. The backend
(`partnerflow-api.onrender.com`) sets `Set-Cookie` on login/register; the browser stores those
cookies under *that* domain only. The frontend (`partnerflow-ai.solutionstechmedia.workers.dev`)
is a different domain — when its server renders `/dashboard`, the incoming browser request never
carries the backend's cookies in the first place, because the browser was never talking to the
backend's domain for that request. There was nothing to forward. A server-side fetch architecture
like this only works when frontend and backend share a domain (or the frontend proxies API calls
through its own domain) — cross-domain, it's structurally broken, not a config bug.

**Why nothing caught it:** every environment this was tested in accidentally put frontend and
backend on the same *site* (same registrable domain — the part that matters for cookies, not the
port):

- Local `next dev`: both on `localhost`, different ports only.
- Docker Compose: both reachable at `localhost` from the browser's perspective (published ports).
- Playwright e2e (local and CI): both `localhost`.
- Manual "live" verification after deploying: done with `curl -b <cookie-jar>`, manually attaching
  the backend's cookies to a request aimed at the frontend's URL — something a real browser would
  never do, since it strictly partitions cookies per domain. This tested nothing real.

**The fix:** stop doing server-side data fetching against the backend at all.
`src/lib/server-api.ts` is gone. Every `/dashboard` page fetches its own data client-side with
`apiClient`, which makes real browser `fetch` calls with `credentials: "include"` — the same
mechanism `/login` and `/register` always used successfully, since those were always client
components. `app/dashboard/layout.tsx` + `src/lib/user-context.tsx`'s `<DashboardAuthGate>`
centralizes the auth check: on mount, call `apiClient.me()`; redirect to `/login` on failure;
otherwise provide the user via context to the whole subtree. The trade-off is a brief client-side
loading state instead of an instant server-rendered page — an acceptable cost for something that
actually works.

**The lesson driving how this gets verified now:** don't trust any test where frontend and
backend happen to share a domain, and don't trust `curl` with a manually-assembled cookie header
to stand in for real browser behavior — cross-domain auth needs to be checked against the actual
deployed domains, with a real browser (or at minimum, without hand-feeding it cookies it wouldn't
otherwise have).

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
- **Local/CI e2e testing cannot catch cross-domain cookie bugs** — see "The cross-domain cookie
  bug" above. Frontend and backend are always same-site in every automated test environment here.
  Anything involving cross-domain cookie behavior needs to be checked against the real deployed
  domains with an actual browser before it's trusted.

## Deliberate scope boundaries

- No refresh-token revocation/rotation storage, no silent token refresh (both above). CSRF
  protection is now in place (milestone 4).
- Vendors and proposals are simple CRUD with no file/document attachments, no organizations or
  team sharing (a vendor belongs to exactly one user, not a company account), and no proposal
  status/pipeline (submitted, accepted, rejected, etc.) — just a flat list.
- The AI comparison prompt is a fixed template; there's no way to ask a follow-up question or
  steer what the comparison focuses on.
- No pagination anywhere (vendor list, proposal list, comparison candidates) — fine at demo scale,
  would need addressing before real usage.
