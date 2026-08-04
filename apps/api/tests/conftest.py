from collections.abc import AsyncGenerator
from urllib.parse import urlsplit, urlunsplit

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from app.api.deps import get_db_session
from app.core.config import get_settings
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


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def _override_get_db_session() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db_session] = _override_get_db_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client
    app.dependency_overrides.clear()
