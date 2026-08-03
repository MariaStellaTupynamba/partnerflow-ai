# Deployment

This describes how to deploy PartnerFlow AI to live infrastructure:

- **Frontend (`apps/web`)** → Cloudflare Workers, via the OpenNext Cloudflare adapter
  (`@opennextjs/cloudflare`). Cloudflare's current recommended path for deploying Next.js is
  Workers, not classic Pages — the dashboard Git-integration experience ("Workers Builds") is the
  same click-through flow, just a different product name than "Pages".
- **Backend + database (`apps/api`)** → Railway (a FastAPI web service + a managed Postgres
  instance in one project).

Both platforms auto-deploy on push to `main` once connected. No secrets are ever committed —
everything below is configured in each platform's dashboard.

Deploy the backend first — the frontend's build needs its URL.

## 1. Backend on Railway

1. Create a new Railway project.
2. **Add a Postgres database**: "New" → "Database" → "Add PostgreSQL". Railway provisions it and
   exposes its own `DATABASE_URL` variable.
3. **Add the API service**: "New" → "GitHub Repo" → select this repository.
   - Set **Root Directory** to `apps/api`.
   - Railway will detect `apps/api/railway.toml`, which points it at `Dockerfile.prod` (a
     production image — no `--reload`, no dev/test dependencies) and sets the health check to
     `/health`.
4. **Environment variables** on the API service:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Reference the Postgres service's connection string (Railway's variable-reference UI, e.g. `${{Postgres.DATABASE_URL}}`). It may come as `postgresql://...` — the app normalizes that to the `psycopg` driver automatically, no manual edit needed. |
   | `JWT_SECRET_KEY` | Generate a real secret: `python3 -c "import secrets; print(secrets.token_urlsafe(64))"`. Paste the output. Never reuse the placeholder from `.env.example`. |
   | `ENVIRONMENT` | `production` |
   | `CORS_ALLOW_ORIGINS` | Leave as `["http://localhost:3000"]` for now — you'll update this after step 2 gives you the frontend's real URL. |
   | `AI_PROVIDER_API_KEY` | Leave empty unless you're actually exercising the AI provider abstraction. |

   (`JWT_ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `REFRESH_TOKEN_EXPIRE_DAYS`,
   `AI_PROVIDER_BASE_URL`, `AI_PROVIDER_MODEL` all have sensible defaults — only set them if you
   want to override.)

5. Deploy. Railway assigns a public URL like `https://partnerflow-api-production.up.railway.app`.
   Confirm it works: `curl https://<your-url>/health` should return
   `{"status":"ok",...,"database":"connected"}`.

## 2. Frontend on Cloudflare Workers

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Connect to Git** → select this
   repository.
2. Set **Root directory** to `apps/web`.
3. **Build command**: `npm run cf:build`
   **Deploy command**: `npx wrangler deploy` (default — Cloudflare finds `apps/web/wrangler.jsonc`
   automatically).
4. **Build environment variable — this one is easy to get wrong:**
   `NEXT_PUBLIC_API_URL=https://<your-railway-url>` (the URL from step 1).

   Next.js inlines `NEXT_PUBLIC_*` variables into the client JavaScript bundle **at build time**.
   Setting it only in `wrangler.jsonc`'s `vars` (a runtime binding) has no effect on the
   already-built client bundle — it must be set as a *build* environment variable in the
   Cloudflare dashboard so it's present when `next build` runs.
5. This is an npm-workspaces monorepo (`apps/web` depends on `packages/shared-types`). Cloudflare's
   monorepo support should run `npm install` from the repo root automatically when a Root
   directory is set. If the build fails resolving `@partnerflow/shared-types`, that dependency
   install step is the first thing to check.
6. Deploy. Cloudflare assigns a `*.workers.dev` URL (or attach a custom domain).

## 3. Close the loop: update backend CORS

Now that you have the frontend's real URL, go back to Railway and update:

```
CORS_ALLOW_ORIGINS=["https://<your-worker-subdomain>.workers.dev"]
```

(add your custom domain too, if you attach one), then redeploy/restart the API service so the new
CORS config takes effect. Until this is done, the deployed frontend's `/health` check will show
"API offline" even though the backend is reachable — the browser request will be blocked by CORS,
not by the network.

## Verifying the deployment

- `curl https://<railway-url>/health` → `database: "connected"`.
- Open the Cloudflare URL in a browser — the "API online" indicator in the header confirms the
  frontend, backend, and CORS config are all correctly wired together.
- `curl -X POST https://<railway-url>/api/v1/auth/register -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"a-real-password"}'` to confirm the database and
  migrations applied correctly (Railway runs `alembic upgrade head` automatically on container
  start, via `docker-entrypoint.sh`).

## What's intentionally not covered here

- Custom domains / DNS — attach one in each platform's dashboard once you're happy with the
  `*.workers.dev` / `*.up.railway.app` URLs.
- The AI provider abstraction is still unused by any route (see
  [architecture.md](architecture.md)) — no AI-related deployment configuration is needed until
  that's built.
- Refresh-token revocation storage — still a known gap noted in architecture.md, unaffected by
  deployment.
