import pytest
from httpx import AsyncClient

from app.core.cookies import CSRF_TOKEN_COOKIE
from app.core.csrf import CSRF_TOKEN_HEADER

REGISTER_PAYLOAD = {"email": "csrf-check@example.com", "password": "correct-horse-battery"}


async def _register(raw_client: AsyncClient) -> None:
    response = await raw_client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)
    assert response.status_code == 201


async def test_register_does_not_require_a_csrf_token(raw_client: AsyncClient) -> None:
    # Register/login establish the CSRF cookie in the first place — requiring one here would
    # be a chicken-and-egg problem, and it's protected by requiring the password anyway.
    response = await raw_client.post("/api/v1/auth/register", json=REGISTER_PAYLOAD)

    assert response.status_code == 201


async def test_create_vendor_without_csrf_header_is_rejected(raw_client: AsyncClient) -> None:
    await _register(raw_client)

    response = await raw_client.post("/api/v1/vendors", json={"name": "Acme"})

    assert response.status_code == 403
    assert response.json()["detail"] == "Missing or invalid CSRF token."


async def test_create_vendor_with_mismatched_csrf_header_is_rejected(
    raw_client: AsyncClient,
) -> None:
    await _register(raw_client)

    response = await raw_client.post(
        "/api/v1/vendors",
        json={"name": "Acme"},
        headers={CSRF_TOKEN_HEADER: "not-the-real-token"},
    )

    assert response.status_code == 403


async def test_create_vendor_with_matching_csrf_header_succeeds(raw_client: AsyncClient) -> None:
    await _register(raw_client)
    csrf_token = raw_client.cookies[CSRF_TOKEN_COOKIE]

    response = await raw_client.post(
        "/api/v1/vendors",
        json={"name": "Acme"},
        headers={CSRF_TOKEN_HEADER: csrf_token},
    )

    assert response.status_code == 201


async def test_unauthenticated_request_fails_auth_before_csrf(raw_client: AsyncClient) -> None:
    # No cookies at all — should be 401 (not logged in), not 403 (missing CSRF token). CSRF
    # protection is meaningless without a session to protect, so auth must be checked first.
    response = await raw_client.post("/api/v1/vendors", json={"name": "Acme"})

    assert response.status_code == 401


@pytest.mark.parametrize(
    ("method", "path", "json_body"),
    [
        ("PATCH", "/api/v1/vendors/{vendor_id}", {"name": "Renamed"}),
        ("DELETE", "/api/v1/vendors/{vendor_id}", None),
        ("POST", "/api/v1/vendors/{vendor_id}/proposals", {"title": "T", "summary": "S"}),
        ("POST", "/api/v1/proposals/compare", {"proposalIds": []}),
    ],
)
async def test_mutating_endpoints_reject_missing_csrf_token(
    raw_client: AsyncClient, method: str, path: str, json_body: dict[str, object] | None
) -> None:
    await _register(raw_client)
    csrf_token = raw_client.cookies[CSRF_TOKEN_COOKIE]
    vendor_id = (
        await raw_client.post(
            "/api/v1/vendors",
            json={"name": "Acme"},
            headers={CSRF_TOKEN_HEADER: csrf_token},
        )
    ).json()["id"]

    response = await raw_client.request(
        method, path.format(vendor_id=vendor_id), json=json_body
    )

    assert response.status_code == 403
