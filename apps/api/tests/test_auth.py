from httpx import AsyncClient, Response

REGISTER_PAYLOAD = {"email": "grace@example.com", "password": "correct-horse-battery"}


async def _register(client: AsyncClient, **overrides: str) -> Response:
    payload = {**REGISTER_PAYLOAD, **overrides}
    response = await client.post("/api/v1/auth/register", json=payload)
    return response


async def test_register_creates_a_user(client: AsyncClient) -> None:
    response = await _register(client)

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == REGISTER_PAYLOAD["email"]
    assert body["isActive"] is True
    assert "hashedPassword" not in body
    assert "id" in body


async def test_register_rejects_duplicate_email(client: AsyncClient) -> None:
    await _register(client)
    response = await _register(client)

    assert response.status_code == 409


async def test_register_rejects_short_password(client: AsyncClient) -> None:
    response = await _register(client, password="short")

    assert response.status_code == 422


async def test_login_returns_token_pair_for_valid_credentials(client: AsyncClient) -> None:
    await _register(client)

    response = await client.post(
        "/api/v1/auth/login",
        json={"email": REGISTER_PAYLOAD["email"], "password": REGISTER_PAYLOAD["password"]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["tokenType"] == "bearer"
    assert body["accessToken"]
    assert body["refreshToken"]


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


async def test_refresh_issues_a_new_token_pair(client: AsyncClient) -> None:
    await _register(client)
    login_response = await client.post(
        "/api/v1/auth/login",
        json={"email": REGISTER_PAYLOAD["email"], "password": REGISTER_PAYLOAD["password"]},
    )
    refresh_token = login_response.json()["refreshToken"]

    response = await client.post("/api/v1/auth/refresh", json={"refreshToken": refresh_token})

    assert response.status_code == 200
    assert response.json()["accessToken"]


async def test_refresh_rejects_an_access_token(client: AsyncClient) -> None:
    await _register(client)
    login_response = await client.post(
        "/api/v1/auth/login",
        json={"email": REGISTER_PAYLOAD["email"], "password": REGISTER_PAYLOAD["password"]},
    )
    access_token = login_response.json()["accessToken"]

    response = await client.post("/api/v1/auth/refresh", json={"refreshToken": access_token})

    assert response.status_code == 401


async def test_me_returns_current_user_with_valid_access_token(client: AsyncClient) -> None:
    await _register(client)
    login_response = await client.post(
        "/api/v1/auth/login",
        json={"email": REGISTER_PAYLOAD["email"], "password": REGISTER_PAYLOAD["password"]},
    )
    access_token = login_response.json()["accessToken"]

    response = await client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"}
    )

    assert response.status_code == 200
    assert response.json()["email"] == REGISTER_PAYLOAD["email"]


async def test_me_rejects_missing_token(client: AsyncClient) -> None:
    response = await client.get("/api/v1/auth/me")

    assert response.status_code == 401


async def test_me_rejects_invalid_token(client: AsyncClient) -> None:
    response = await client.get(
        "/api/v1/auth/me", headers={"Authorization": "Bearer not-a-real-token"}
    )

    assert response.status_code == 401
