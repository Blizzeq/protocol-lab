"""Central application configuration (12-factor: everything from env)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Protocol Lab"
    environment: str = "development"

    # Infrastructure — wired up in subsequent milestones
    database_url: str | None = None
    redis_url: str | None = None

    # SQL query logging (noisy — off by default, enable for debugging)
    db_echo: bool = False

    # Auth / JWT
    # Min. 32 bytes for HS256. This is a DEV value — in production set it via env.
    jwt_secret: str = "dev-only-insecure-jwt-secret-change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # CORS — frontend origins (Next.js). Comma-separated list in env.
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
