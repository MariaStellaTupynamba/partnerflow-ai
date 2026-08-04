from httpx import AsyncClient, Response

REGISTER_PAYLOAD = {"email": "grace@example.com", "password": "correct-horse-battery"}


async def _register(client: AsyncClient, **overrides: str) -> Response:
    payload = {**REGISTER_PAYLOAD, **overrides}
    response = await client.post("/api/v1/auth/register", json=payload)
    return response


async def _login(client: AsyncClient) -> Response:
    return await client.post(
        "/api/v1/auth/login",
        json={"email": REGISTER_PAYLOAD["email"], "password": REGISTER_PAYLOAD["password"]},
    )


def _set_cookie_headers(response: Response) -> list[str]:
    return response.headers.get_list("set-cookie")


async def test_register_creates_a_user_and_sets_auth_cookies(client: AsyncClient) -> None:
    response = await _register(client)

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == REGISTER_PAYLOAD["email"]
    assert body["isActive"] is True
    assert "hashedPassword" not in body
    assert "id" in body

    cookies = _set_cookie_headers(response)
    assert any(c.startswith("access_token=") and "HttpOnly" in c for c in cookies)
    assert any(c.startswith("refresh_token=") and "HttpOnly" in c for c in cookies)


async def test_register_rejects_duplicate_email(client: AsyncClient) -> None:
    await _register(client)
    response = await _register(client)

    assert response.status_code == 409


async def test_register_rejects_short_password(client: AsyncClient) -> None:
    response = await _register(client, password="short")

    assert response.status_code == 422


async def test_login_sets_auth_cookies_for_valid_credentials(client: AsyncClient) -> None:
    await _register(client)
    client.cookies.clear()

    response = await _login(client)

    assert response.status_code == 200
    assert response.json()["email"] == REGISTER_PAYLOAD["email"]
    cookies = _set_cookie_headers(response)
    assert any(c.startswith("access_token=") for c in cookies)
    assert any(c.startswith("refresh_token=") for c in cookies)


async def test_login_rejects_wrong_password(client: AsyncClient) -> None:
    await _register(client)

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": REGISTER_PAYLOAD["email"], "password": "wrong-password"},
    )

    assert response.status_code == 401


async def test_login_rejects_unknown_email(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "whatever123"},
    )

    assert response.status_code == 401


async def test_refresh_issues_new_cookies(client: AsyncClient) -> None:
    await _register(client)

    response = await client.post("/api/v1/auth/refresh")

    assert response.status_code == 204
    cookies = _set_cookie_headers(response)
    assert any(c.startswith("access_token=") for c in cookies)
    assert any(c.startswith("refresh_token=") for c in cookies)


async def test_refresh_without_cookie_is_rejected(client: AsyncClient) -> None:
    response = await client.post("/api/v1/auth/refresh")

    assert response.status_code == 401


async def test_refresh_rejects_an_access_token_used_as_refresh(client: AsyncClient) -> None:
    await _register(client)
    # Overwrite the (correctly-scoped) refresh cookie with an access token to prove the
    # endpoint checks token *type*, not just signature validity.
    client.cookies.set("refresh_token", client.cookies["access_token"])

    response = await client.post("/api/v1/auth/refresh")

    assert response.status_code == 401


async def test_logout_clears_cookies_and_revokes_access(client: AsyncClient) -> None:
    await _register(client)

    logout_response = await client.post("/api/v1/auth/logout")
    assert logout_response.status_code == 204
    cookies = _set_cookie_headers(logout_response)
    assert any(c.startswith("access_token=") and "Max-Age=0" in c for c in cookies)
    assert any(c.startswith("refresh_token=") and "Max-Age=0" in c for c in cookies)

    me_response = await client.get("/api/v1/auth/me")
    assert me_response.status_code == 401


async def test_me_returns_current_user_with_valid_cookie(client: AsyncClient) -> None:
    await _register(client)

    response = await client.get("/api/v1/auth/me")

    assert response.status_code == 200
    assert response.json()["email"] == REGISTER_PAYLOAD["email"]


async def test_me_rejects_missing_cookie(client: AsyncClient) -> None:
    response = await client.get("/api/v1/auth/me")

    assert response.status_code == 401


async def test_me_rejects_invalid_cookie(client: AsyncClient) -> None:
    client.cookies.set("access_token", "not-a-real-token")

    response = await client.get("/api/v1/auth/me")

    assert response.status_code == 401
