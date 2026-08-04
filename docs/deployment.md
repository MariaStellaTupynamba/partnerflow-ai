# Deployment

This describes how to deploy PartnerFlow AI to live infrastructure, entirely on free tiers:

- **Frontend (`apps/web`)** → Cloudflare Workers, via the OpenNext Cloudflare adapter
  (`@opennextjs/cloudflare`). Cloudflare's current recommended path for deploying Next.js is
  Workers, not classic Pages — the dashboard Git-integration experience ("Workers Builds") is the
  same click-through flow, just a different product name than "Pages".
- **Backend (`apps/api`)** → Render (free web service).
- **Database** → Neon (free managed Postgres), used instead of Render's own Postgres because
  Render's free database tier expires after 30 days — Neon's free tier doesn't.

This is a portfolio project with no revenue, so cost — not raw performance — drove these choices.
The trade-off: Render's free tier spins a service down after ~15 minutes idle, so the first
request after a gap takes 10-30s to cold-start. Acceptable for something people click into
occasionally; not what you'd choose for a service under real traffic.

Both platforms auto-deploy on push to `main` once connected. No secrets are ever committed —
everything below is configured in each platform's dashboard.

Deploy the backend first — the frontend's build needs its URL.

## 1. Database on Neon

1. Create a free project at [neon.tech](https://neon.tech).
2. Copy the connection string it gives you (something like
   `postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`). You'll paste
   this into Render in the next step — Neon's free tier also auto-suspends the database when
   idle, similar to Render's cold start, and wakes it on the next connection.

(Supabase is a fine alternative if you'd rather have it — same idea, free managed Postgres. Neon
is used here for being a simpler, Postgres-only product with nothing extra to configure.)

## 2. Backend on Render

1. Render dashboard → **New** → **Blueprint** → connect this repository. Render will detect
   `render.yaml` at the repo root, which defines a Docker-based web service pointed at
   `apps/api/Dockerfile.prod` (a production image — no `--reload`, no dev/test dependencies) with
   the health check set to `/health`.
2. During Blueprint creation, Render prompts for the variables marked `sync: false` in
   `render.yaml`:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | The Neon connection string from step 1. It may come as `postgresql://...` — the app normalizes that to the `psycopg` driver automatically, no manual edit needed. |
   | `CORS_ALLOW_ORIGINS` | Leave as `["http://localhost:3000"]` for now — you'll update this after step 3 gives you the frontend's real URL. |

   `JWT_SECRET_KEY` does **not** need to be entered — `render.yaml` sets `generateValue: true`, so
   Render generates a real random secret itself. `ENVIRONMENT=production` is also already set in
   the blueprint.
3. Deploy. Render assigns a public URL like `https://partnerflow-api.onrender.com`. Confirm it
   works: `curl https://<your-url>/health` should return `{"status":"ok",...,"database":"connected"}`
   — the first request may take 10-30s if the service had spun down.

## 3. Frontend on Cloudflare Workers

1. Cloudflare dashboard → **Workers & Pages** → **Create** → look for the **Workers** side (not
   Pages) → **Connect to Git** / **Import a repository** → select this repository.
2. Set **Root directory** to `apps/web`.
3. **Build command**: `npm run cf:build`
   **Deploy command**: `npx wrangler deploy` (default — Cloudflare finds `apps/web/wrangler.jsonc`
   automatically).
4. **Build environment variable — this one is easy to get wrong:**
   `NEXT_PUBLIC_API_URL=https://<your-render-url>` (the URL from step 2).

   Next.js inlines `NEXT_PUBLIC_*` variables into the client JavaScript bundle **at build time**.
   Setting it only in `wrangler.jsonc`'s `vars` (a runtime binding) has no effect on the
   already-built client bundle — it must be set as a *build* environment variable in the
   Cloudflare dashboard so it's present when `next build` runs.
5. This is an npm-workspaces monorepo (`apps/web` depends on `packages/shared-types`). Cloudflare's
   monorepo support should run `npm install` from the repo root automatically when a Root
   directory is set. If the build fails resolving `@partnerflow/shared-types`, that dependency
   install step is the first thing to check.
6. Also check that the Worker's registered name matches `apps/web/wrangler.jsonc`'s top-level
   `name` field and its `WORKER_SELF_REFERENCE` service binding — if Cloudflare assigns a
   different name than what's in the file (it will tell you in the build log with a "Failed to
   match Worker name" warning), update `wrangler.jsonc` to match and push.
7. Deploy. Cloudflare assigns a `*.workers.dev` URL (or attach a custom domain).

## 4. Close the loop: update backend CORS

Now that you have the frontend's real URL, go back to Render and update:

```
CORS_ALLOW_ORIGINS=["https://<your-worker-subdomain>.workers.dev"]
```

(add your custom domain too, if you attach one), then let it redeploy so the new CORS config takes
effect. Until this is done, the deployed frontend's `/health` check will show "API offline" even
though the backend is reachable — the browser request will be blocked by CORS, not by the network.

## Verifying the deployment

- `curl https://<render-url>/health` → `database: "connected"` (allow for a cold-start delay).
- Open the Cloudflare URL in a browser — the "API online" indicator in the header confirms the
  frontend, backend, and CORS config are all correctly wired together.
- `curl -X POST https://<render-url>/api/v1/auth/register -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"a-real-password"}'` to confirm the database and
  migrations applied correctly (Render runs `alembic upgrade head` automatically on container
  start, via `docker-entrypoint.sh`).

## What's intentionally not covered here

- Custom domains / DNS — attach one in each platform's dashboard once you're happy with the
  `*.workers.dev` / `*.onrender.com` URLs.
- The AI provider abstraction is still unused by any route (see
  [architecture.md](architecture.md)) — no AI-related deployment configuration is needed until
  that's built.
- Refresh-token revocation storage — still a known gap noted in architecture.md, unaffected by
  deployment.
- Cold-start mitigation (e.g. a scheduled ping to keep the service warm) — deliberately not set
  up, since that would undermine the point of using the free tier.
