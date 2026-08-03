from abc import ABC, abstractmethod


class AIProvider(ABC):
    """Provider-agnostic interface for text generation.

    Concrete implementations talk to a specific OpenAI-compatible API. No implementation here
    fabricates responses — calling a provider always performs a real HTTP request and requires a
    valid API key. Features that need AI output (proposal comparison, summarization, etc.) are
    built against this interface, not a specific vendor SDK.
    """

    @abstractmethod
    async def generate(self, prompt: str, *, system_prompt: str | None = None) -> str:
        """Return a model completion for the given prompt."""
        raise NotImplementedError
