from collections.abc import AsyncGenerator
from urllib.parse import urlsplit, urlunsplit

import pytest
from httpx import ASGITransport, AsyncClient, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.api.deps import get_db_session
from app.core.config import get_settings
from app.core.cookies import CSRF_TOKEN_COOKIE
from app.core.csrf import CSRF_TOKEN_HEADER
from app.db.base import Base
from app.main import app


def _test_database_url() -> str:
    """Runs tests against `<db>_test` rather than the configured DATABASE_URL directly.

    This suite creates and drops all tables every session — pointing it at whatever
    database a developer has configured for interactive/manual use would silently wipe
    their data (this bit us once locally: e2e-testing against the same Postgres used for
    `pytest` lost all rows the moment the test session tore down)."""
    parts = urlsplit(get_settings().database_url)
    return urlunsplit(parts._replace(path=f"{parts.path}_test"))


TEST_DATABASE_URL = _test_database_url()
test_engine = create_async_engine(TEST_DATABASE_URL, pool_pre_ping=True)


async def _ensure_test_database_exists() -> None:
    admin_parts = urlsplit(get_settings().database_url)
    admin_engine = create_async_engine(
        urlunsplit(admin_parts._replace(path="/postgres")), isolation_level="AUTOCOMMIT"
    )
    test_db_name = urlsplit(TEST_DATABASE_URL).path.lstrip("/")
    try:
        async with admin_engine.connect() as connection:
            exists = await connection.scalar(
                text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": test_db_name}
            )
            if not exists:
                await connection.execute(text(f'CREATE DATABASE "{test_db_name}"'))
    finally:
        await admin_engine.dispose()


@pytest.fixture(scope="session", autouse=True)
async def _prepare_database() -> AsyncGenerator[None, None]:
    await _ensure_test_database_exists()
    async with test_engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as connection:
        await connection.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """A session bound to a rolled-back transaction, so each test starts from a clean state
    without needing to truncate tables or spin up a database per test."""
    async with test_engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(bind=connection, join_transaction_mode="create_savepoint")
        try:
            yield session
        finally:
            await session.close()
            await transaction.rollback()


def _override_db_session(db_session: AsyncSession) -> None:
    async def _get_db_session() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db_session] = _get_db_session


async def _mirror_csrf_cookie_as_header(request: Request) -> None:
    """Mimics what the real frontend does: read the (non-httpOnly) CSRF cookie and send it
    back as a header. httpx merges the client's cookie jar into `request.headers["cookie"]`
    before request hooks run, so this cookie value is already present to read here."""
    for part in request.headers.get("cookie", "").split("; "):
        if part.startswith(f"{CSRF_TOKEN_COOKIE}="):
            request.headers[CSRF_TOKEN_HEADER] = part.split("=", 1)[1]
            return


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """The default client for tests — automatically mirrors the CSRF cookie as a header on
    every request, so tests that aren't specifically about CSRF don't need to think about it."""
    _override_db_session(db_session)
    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        event_hooks={"request": [_mirror_csrf_cookie_as_header]},
    ) as async_client:
        yield async_client
    app.dependency_overrides.clear()


@pytest.fixture
async def raw_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Like `client`, but without the CSRF auto-mirroring — for tests that need precise
    control over the X-CSRF-Token header (missing, wrong, or deliberately correct)."""
    _override_db_session(db_session)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client
    app.dependency_overrides.clear()
