from functools import lru_cache

from app.core.config import get_settings
from app.services.ai.base import AIProvider
from app.services.ai.openai_compatible import OpenAICompatibleProvider


@lru_cache
def get_ai_provider() -> AIProvider:
    settings = get_settings()
    return OpenAICompatibleProvider(
        base_url=settings.ai_provider_base_url,
        api_key=settings.ai_provider_api_key,
        model=settings.ai_provider_model,
    )
