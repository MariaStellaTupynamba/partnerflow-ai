# PartnerFlow AI

AI-powered vendor sourcing, proposal comparison, and partner management platform.

This is a public portfolio project. All data, companies, and documents used anywhere in this
repository are fictional.

## Stack

- **Frontend:** Next.js (App Router), React, TypeScript, Tailwind CSS
- **Backend:** FastAPI, Python, SQLAlchemy 2, Alembic, Pydantic v2
- **Database:** PostgreSQL
- **AI integration:** provider-agnostic abstraction over OpenAI-compatible APIs, used for
  AI-assisted proposal comparison
- **Auth:** JWT access + refresh tokens
- **Testing:** Pytest, Vitest, Playwright
- **Infra:** Docker Compose (local), GitHub Actions (CI)

See [docs/architecture.md](docs/architecture.md) for the full design rationale.

## Repository layout

```
apps/
  web/               Next.js frontend
  api/                FastAPI backend
packages/
  shared-types/       TypeScript types shared across frontend packages
docs/                 Architecture documentation
```

## Getting started

### Prerequisites

- Node.js >= 20, npm >= 10
- Python >= 3.12
- Docker and Docker Compose

### Run everything with Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000 (health check at `/health`)

### Run the frontend directly

```bash
npm install
npm run dev --workspace apps/web
```

### Run the backend directly

```bash
cd apps/api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload
```

## Testing

```bash
# Frontend
npm run lint --workspace apps/web
npm run typecheck --workspace apps/web
npm run test --workspace apps/web

# apps/web/e2e/*.spec.ts exercise real flows end-to-end (auth, vendors/proposals/comparison),
# so the backend and Postgres need to actually be running first (e.g. `docker compose up -d db`
# + uvicorn, or the full `docker compose up`) before this will pass.
npm run test:e2e --workspace apps/web

# Backend (from apps/api, with .venv active and Postgres running)
ruff check .
mypy app
pytest
```

## Deployment

Frontend on Cloudflare Workers (via OpenNext), backend on Render, database on Neon — all free
tiers. See [docs/deployment.md](docs/deployment.md) for the full runbook.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

See [SECURITY.md](SECURITY.md). No real credentials or personal data are ever committed to this
repository — see `.env.example` for the environment variables required to run the project.

## License

MIT — see [LICENSE](LICENSE).
