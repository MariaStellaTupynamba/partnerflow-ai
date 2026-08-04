from httpx import AsyncClient

USER_A = {"email": "vendor-owner@example.com", "password": "correct-horse-battery"}
USER_B = {"email": "vendor-intruder@example.com", "password": "correct-horse-battery"}

VENDOR_PAYLOAD = {"name": "Acme Cloud Services", "contactEmail": "sales@acme.example"}


async def _register(client: AsyncClient, user: dict[str, str]) -> None:
    response = await client.post("/api/v1/auth/register", json=user)
    assert response.status_code == 201


async def test_create_vendor_requires_authentication(client: AsyncClient) -> None:
    response = await client.post("/api/v1/vendors", json=VENDOR_PAYLOAD)

    assert response.status_code == 401


async def test_create_and_read_vendor(client: AsyncClient) -> None:
    await _register(client, USER_A)

    create_response = await client.post("/api/v1/vendors", json=VENDOR_PAYLOAD)
    assert create_response.status_code == 201
    vendor = create_response.json()
    assert vendor["name"] == VENDOR_PAYLOAD["name"]
    assert vendor["contactEmail"] == VENDOR_PAYLOAD["contactEmail"]

    read_response = await client.get(f"/api/v1/vendors/{vendor['id']}")
    assert read_response.status_code == 200
    assert read_response.json()["id"] == vendor["id"]


async def test_list_vendors_returns_only_the_current_users_vendors(client: AsyncClient) -> None:
    await _register(client, USER_A)
    await client.post("/api/v1/vendors", json=VENDOR_PAYLOAD)

    await _register(client, USER_B)
    empty_list_response = await client.get("/api/v1/vendors")
    assert empty_list_response.status_code == 200
    assert empty_list_response.json() == []


async def test_vendor_not_found_for_nonexistent_id(client: AsyncClient) -> None:
    await _register(client, USER_A)

    response = await client.get("/api/v1/vendors/00000000-0000-0000-0000-000000000000")

    assert response.status_code == 404


async def test_other_user_cannot_read_or_update_a_vendor_they_dont_own(
    client: AsyncClient,
) -> None:
    await _register(client, USER_A)
    vendor_id = (await client.post("/api/v1/vendors", json=VENDOR_PAYLOAD)).json()["id"]

    await _register(client, USER_B)

    read_response = await client.get(f"/api/v1/vendors/{vendor_id}")
    assert read_response.status_code == 404

    update_response = await client.patch(
        f"/api/v1/vendors/{vendor_id}", json={"name": "Hijacked"}
    )
    assert update_response.status_code == 404


async def test_update_vendor(client: AsyncClient) -> None:
    await _register(client, USER_A)
    vendor_id = (await client.post("/api/v1/vendors", json=VENDOR_PAYLOAD)).json()["id"]

    response = await client.patch(f"/api/v1/vendors/{vendor_id}", json={"name": "Acme Renamed"})

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Acme Renamed"
    # Fields not included in the PATCH payload are left untouched.
    assert body["contactEmail"] == VENDOR_PAYLOAD["contactEmail"]


async def test_delete_vendor_also_deletes_its_proposals(client: AsyncClient) -> None:
    await _register(client, USER_A)
    vendor_id = (await client.post("/api/v1/vendors", json=VENDOR_PAYLOAD)).json()["id"]
    proposal_id = (
        await client.post(
            f"/api/v1/vendors/{vendor_id}/proposals",
            json={"title": "Standard package", "summary": "A summary."},
        )
    ).json()["id"]

    delete_response = await client.delete(f"/api/v1/vendors/{vendor_id}")
    assert delete_response.status_code == 204

    assert (await client.get(f"/api/v1/vendors/{vendor_id}")).status_code == 404
    assert (await client.get(f"/api/v1/proposals/{proposal_id}")).status_code == 404
