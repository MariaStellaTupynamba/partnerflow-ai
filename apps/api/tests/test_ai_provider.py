from typing import Any

import httpx
import pytest

from app.services.ai.openai_compatible import OpenAICompatibleProvider


def test_provider_requires_an_api_key() -> None:
    with pytest.raises(ValueError, match="AI_PROVIDER_API_KEY"):
        OpenAICompatibleProvider(
            base_url="https://api.openai.com/v1", api_key="", model="gpt-4o-mini"
        )


async def test_generate_sends_a_well_formed_chat_completions_request() -> None:
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["headers"] = request.headers
        return httpx.Response(
            200,
            json={"choices": [{"message": {"content": "Vendor A offers the best value."}}]},
        )

    provider = OpenAICompatibleProvider(
        base_url="https://fake-provider.test/v1",
        api_key="fake-key",
        model="gpt-4o-mini",
        transport=httpx.MockTransport(handler),
    )

    result = await provider.generate(
        "Compare these two vendor proposals.", system_prompt="Be concise."
    )

    assert result == "Vendor A offers the best value."
    assert captured["url"] == "https://fake-provider.test/v1/chat/completions"
    assert captured["headers"]["authorization"] == "Bearer fake-key"
