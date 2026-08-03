from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"

    database_url: str = Field(
        default="postgresql+psycopg://partnerflow:partnerflow@localhost:5432/partnerflow",
    )

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    cors_allow_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    ai_provider_base_url: str = Field(default="https://api.openai.com/v1")
    ai_provider_api_key: str = Field(default="")
    ai_provider_model: str = Field(default="gpt-4o-mini")


@lru_cache
def get_settings() -> Settings:
    return Settings()
