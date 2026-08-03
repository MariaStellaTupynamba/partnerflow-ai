from httpx import AsyncClient


async def test_health_check_reports_ok_and_connected_database(client: AsyncClient) -> None:
    response = await client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "partnerflow-api"
    assert body["database"] == "connected"
