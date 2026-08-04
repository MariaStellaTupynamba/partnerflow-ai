from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"

    database_url: str = Field(
        default="postgresql+psycopg://partnerflow:partnerflow@localhost:5432/partnerflow",
    )

    @field_validator("database_url")
    @classmethod
    def _use_psycopg_driver(cls, value: str) -> str:
        """Managed Postgres providers (e.g. Railway) hand out bare `postgres://` /
        `postgresql://` URLs. SQLAlchemy needs the driver specified explicitly, so
        normalize to the psycopg (v3) dialect used everywhere else in this app."""
        for prefix in ("postgres://", "postgresql://"):
            if value.startswith(prefix):
                return "postgresql+psycopg://" + value[len(prefix) :]
        return value

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    cors_allow_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    ai_provider_base_url: str = Field(default="https://api.openai.com/v1")
    ai_provider_api_key: str = Field(default="")
    ai_provider_model: str = Field(default="gpt-4o-mini")

    @property
    def cookie_secure(self) -> bool:
        """Browsers refuse `Secure` cookies over plain HTTP, which local dev uses."""
        return self.environment == "production"

    @property
    def cookie_samesite(self) -> Literal["lax", "none"]:
        """Frontend and backend are on different registrable domains in production
        (Cloudflare Workers / Render), so cookies need SameSite=None there to be sent
        cross-site at all. Locally both run on `localhost` (different ports only, which
        counts as the same site), so Lax is enough and avoids needing Secure."""
        return "none" if self.environment == "production" else "lax"


@lru_cache
def get_settings() -> Settings:
    return Settings()
