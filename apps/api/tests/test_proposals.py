from httpx import AsyncClient

USER_A = {"email": "proposal-owner@example.com", "password": "correct-horse-battery"}
USER_B = {"email": "proposal-intruder@example.com", "password": "correct-horse-battery"}

VENDOR_PAYLOAD = {"name": "Acme Cloud Services"}
PROPOSAL_PAYLOAD = {
    "title": "Standard hosting package",
    "price": "1200.00",
    "currency": "USD",
    "summary": "12-month hosting contract, 99.9% SLA, 24/7 support.",
    "submittedAt": "2026-01-15",
}


async def _register(client: AsyncClient, user: dict[str, str]) -> None:
    response = await client.post("/api/v1/auth/register", json=user)
    assert response.status_code == 201


async def _create_vendor(client: AsyncClient) -> str:
    response = await client.post("/api/v1/vendors", json=VENDOR_PAYLOAD)
    vendor_id: str = response.json()["id"]
    return vendor_id


async def test_create_proposal_requires_vendor_ownership(client: AsyncClient) -> None:
    await _register(client, USER_A)
    vendor_id = await _create_vendor(client)

    await _register(client, USER_B)
    response = await client.post(
        f"/api/v1/vendors/{vendor_id}/proposals", json=PROPOSAL_PAYLOAD
    )

    assert response.status_code == 404


async def test_create_and_list_proposals_for_a_vendor(client: AsyncClient) -> None:
    await _register(client, USER_A)
    vendor_id = await _create_vendor(client)

    create_response = await client.post(
        f"/api/v1/vendors/{vendor_id}/proposals", json=PROPOSAL_PAYLOAD
    )
    assert create_response.status_code == 201
    proposal = create_response.json()
    assert proposal["title"] == PROPOSAL_PAYLOAD["title"]
    assert proposal["price"] == "1200.00"
    assert proposal["vendorId"] == vendor_id

    list_response = await client.get(f"/api/v1/vendors/{vendor_id}/proposals")
    assert list_response.status_code == 200
    assert [p["id"] for p in list_response.json()] == [proposal["id"]]


async def test_list_all_proposals_spans_every_vendor_but_only_the_current_user(
    client: AsyncClient,
) -> None:
    await _register(client, USER_A)
    vendor_a_id = await _create_vendor(client)
    vendor_b_id = (await client.post("/api/v1/vendors", json={"name": "Globex"})).json()["id"]
    proposal_a_id = (
        await client.post(f"/api/v1/vendors/{vendor_a_id}/proposals", json=PROPOSAL_PAYLOAD)
    ).json()["id"]
    proposal_b_id = (
        await client.post(
            f"/api/v1/vendors/{vendor_b_id}/proposals",
            json={"title": "Other vendor's proposal", "summary": "Details."},
        )
    ).json()["id"]

    response = await client.get("/api/v1/proposals")
    assert response.status_code == 200
    assert {p["id"] for p in response.json()} == {proposal_a_id, proposal_b_id}

    await _register(client, USER_B)
    other_user_response = await client.get("/api/v1/proposals")
    assert other_user_response.status_code == 200
    assert other_user_response.json() == []


async def test_proposal_without_a_price_is_allowed(client: AsyncClient) -> None:
    await _register(client, USER_A)
    vendor_id = await _create_vendor(client)

    response = await client.post(
        f"/api/v1/vendors/{vendor_id}/proposals",
        json={"title": "TBD pricing", "summary": "Pricing to be discussed."},
    )

    assert response.status_code == 201
    assert response.json()["price"] is None
    assert response.json()["currency"] == "USD"


async def test_other_user_cannot_read_update_or_delete_a_proposal_they_dont_own(
    client: AsyncClient,
) -> None:
    await _register(client, USER_A)
    vendor_id = await _create_vendor(client)
    proposal_id = (
        await client.post(f"/api/v1/vendors/{vendor_id}/proposals", json=PROPOSAL_PAYLOAD)
    ).json()["id"]

    await _register(client, USER_B)

    assert (await client.get(f"/api/v1/proposals/{proposal_id}")).status_code == 404
    assert (
        await client.patch(f"/api/v1/proposals/{proposal_id}", json={"title": "Hijacked"})
    ).status_code == 404
    assert (await client.delete(f"/api/v1/proposals/{proposal_id}")).status_code == 404


async def test_update_proposal(client: AsyncClient) -> None:
    await _register(client, USER_A)
    vendor_id = await _create_vendor(client)
    proposal_id = (
        await client.post(f"/api/v1/vendors/{vendor_id}/proposals", json=PROPOSAL_PAYLOAD)
    ).json()["id"]

    response = await client.patch(
        f"/api/v1/proposals/{proposal_id}", json={"price": "999.99"}
    )

    assert response.status_code == 200
    body = response.json()
    assert body["price"] == "999.99"
    # Untouched fields are preserved.
    assert body["title"] == PROPOSAL_PAYLOAD["title"]


async def test_delete_proposal(client: AsyncClient) -> None:
    await _register(client, USER_A)
    vendor_id = await _create_vendor(client)
    proposal_id = (
        await client.post(f"/api/v1/vendors/{vendor_id}/proposals", json=PROPOSAL_PAYLOAD)
    ).json()["id"]

    delete_response = await client.delete(f"/api/v1/proposals/{proposal_id}")
    assert delete_response.status_code == 204
    assert (await client.get(f"/api/v1/proposals/{proposal_id}")).status_code == 404
