# Contributing to PartnerFlow AI

Thanks for your interest in contributing. This is a portfolio project, but it follows the same
standards you'd expect from a production codebase.

## Repository layout

This is an npm-workspaces monorepo:

- `apps/web` — Next.js (App Router) frontend, TypeScript, Tailwind CSS
- `apps/api` — FastAPI backend, Python, SQLAlchemy 2, Alembic
- `packages/shared-types` — TypeScript types shared across the frontend

## Prerequisites

- Node.js >= 20 and npm >= 10
- Python >= 3.12
- Docker and Docker Compose (for local Postgres and full-stack dev)

## Getting started

```bash
cp .env.example .env
docker compose up --build
```

This starts Postgres, the FastAPI backend (`http://localhost:8000`), and the Next.js frontend
(`http://localhost:3000`).

To work on the frontend or backend outside of Docker, see the `README.md` in each app directory.

## Development workflow

1. Create a branch off `main`.
2. Make your change with tests.
3. Run linting, type-checking, and tests locally before opening a PR:
   - Frontend: `npm run lint --workspace apps/web`, `npm run typecheck --workspace apps/web`, `npm run test --workspace apps/web`
   - Backend: `ruff check apps/api`, `mypy apps/api`, `pytest apps/api`
4. Open a pull request describing the change and why it's needed.

## Code style

- TypeScript: strict mode, formatted with Prettier, linted with ESLint.
- Python: type-hinted, formatted and linted with Ruff, type-checked with mypy.
- Commit messages should explain *why*, not just *what*.

## Security

Do not include real credentials, API keys, or personal data in code, tests, or commit history.
See `SECURITY.md` for how to report vulnerabilities.
