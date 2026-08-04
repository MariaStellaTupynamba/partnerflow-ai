import pytest
from httpx import AsyncClient

USER_A = {"email": "compare-owner@example.com", "password": "correct-horse-battery"}
USER_B = {"email": "compare-intruder@example.com", "password": "correct-horse-battery"}


class _FakeProvider:
    def __init__(self, response: str = "Vendor A offers a lower price with a slightly lower SLA."):
        self._response = response

    async def generate(self, prompt: str, *, system_prompt: str | None = None) -> str:
        return self._response


class _FailingProvider:
    async def generate(self, prompt: str, *, system_prompt: str | None = None) -> str:
        raise RuntimeError("upstream request failed")


async def _register(client: AsyncClient, user: dict[str, str]) -> None:
    response = await client.post("/api/v1/auth/register", json=user)
    assert response.status_code == 201


async def _create_two_proposals(client: AsyncClient) -> tuple[str, str]:
    vendor_a_id = (
        await client.post("/api/v1/vendors", json={"name": "Acme Cloud Services"})
    ).json()["id"]
    vendor_b_id = (
        await client.post("/api/v1/vendors", json={"name": "Globex Hosting"})
    ).json()["id"]

    proposal_a_id = (
        await client.post(
            f"/api/v1/vendors/{vendor_a_id}/proposals",
            json={"title": "Standard package", "price": "1200.00", "summary": "Details A."},
        )
    ).json()["id"]
    proposal_b_id = (
        await client.post(
            f"/api/v1/vendors/{vendor_b_id}/proposals",
            json={"title": "Premium package", "price": "950.00", "summary": "Details B."},
        )
    ).json()["id"]
    return proposal_a_id, proposal_b_id


async def test_compare_requires_at_least_two_proposal_ids(client: AsyncClient) -> None:
    await _register(client, USER_A)
    proposal_a_id, _ = await _create_two_proposals(client)

    response = await client.post(
        "/api/v1/proposals/compare", json={"proposalIds": [proposal_a_id]}
    )

    assert response.status_code == 422


async def test_compare_returns_404_when_a_proposal_isnt_owned(client: AsyncClient) -> None:
    await _register(client, USER_A)
    proposal_a_id, proposal_b_id = await _create_two_proposals(client)

    await _register(client, USER_B)
    response = await client.post(
        "/api/v1/proposals/compare",
        json={"proposalIds": [proposal_a_id, proposal_b_id]},
    )

    assert response.status_code == 404


async def test_compare_returns_503_when_ai_provider_is_not_configured(
    client: AsyncClient,
) -> None:
    await _register(client, USER_A)
    proposal_a_id, proposal_b_id = await _create_two_proposals(client)

    # No monkeypatching here — this exercises the real factory with no AI_PROVIDER_API_KEY
    # configured, which is the actual state of the test environment.
    response = await client.post(
        "/api/v1/proposals/compare",
        json={"proposalIds": [proposal_a_id, proposal_b_id]},
    )

    assert response.status_code == 503


async def test_compare_returns_the_ai_summary_when_configured(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.api.v1.proposals.get_ai_provider", lambda: _FakeProvider())
    await _register(client, USER_A)
    proposal_a_id, proposal_b_id = await _create_two_proposals(client)

    response = await client.post(
        "/api/v1/proposals/compare",
        json={"proposalIds": [proposal_a_id, proposal_b_id]},
    )

    assert response.status_code == 200
    assert response.json()["summary"] == "Vendor A offers a lower price with a slightly lower SLA."


async def test_compare_returns_502_when_the_ai_provider_call_fails(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.api.v1.proposals.get_ai_provider", lambda: _FailingProvider())
    await _register(client, USER_A)
    proposal_a_id, proposal_b_id = await _create_two_proposals(client)

    response = await client.post(
        "/api/v1/proposals/compare",
        json={"proposalIds": [proposal_a_id, proposal_b_id]},
    )

    assert response.status_code == 502
