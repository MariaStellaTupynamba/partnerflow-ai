import httpx

from app.services.ai.base import AIProvider


class OpenAICompatibleProvider(AIProvider):
    """Talks to any API implementing the OpenAI chat-completions contract
    (OpenAI itself, Azure OpenAI, or self-hosted gateways like vLLM/Ollama)."""

    def __init__(
        self,
        base_url: str,
        api_key: str,
        model: str,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        if not api_key:
            raise ValueError(
                "AI_PROVIDER_API_KEY is not configured. Set it in your environment before "
                "using an AI provider."
            )
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model
        self._transport = transport

    async def generate(self, prompt: str, *, system_prompt: str | None = None) -> str:
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        async with httpx.AsyncClient(
            base_url=self._base_url, timeout=30.0, transport=self._transport
        ) as client:
            response = await client.post(
                "/chat/completions",
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={"model": self._model, "messages": messages},
            )
            response.raise_for_status()
            data = response.json()

        content: str = data["choices"][0]["message"]["content"]
        return content
