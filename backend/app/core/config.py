"""Centralna konfiguracja aplikacji (12-factor: wszystko z env)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Protocol Lab"
    environment: str = "development"

    # Infrastruktura — dopinane w kolejnych milestone'ach
    database_url: str | None = None
    redis_url: str | None = None

    # Logowanie zapytań SQL (głośne — domyślnie off, włącz do debugowania)
    db_echo: bool = False

    # CORS — originy frontendu (Next.js). Lista po przecinku w env.
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
