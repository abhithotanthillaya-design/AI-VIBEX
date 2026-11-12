"""Application configuration loaded from environment variables."""

from datetime import datetime, tzinfo
from functools import lru_cache
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings for the QUEUELESS backend service."""

    app_name: str = "QUEUELESS API"
    environment: str = "development"
    database_path: str = "./queueless.db"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    timezone: str = "Asia/Kolkata"
    slot_duration_minutes: int = 5
    slot_capacity_units: int = 12
    slot_lookahead_minutes: int = 45
    enable_demo_reset: bool = True
    session_cookie_name: str = "queueless_session"
    session_ttl_hours: int = 12
    session_cookie_secure: bool | None = None
    session_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    login_rate_limit_max_attempts: int = 5
    login_rate_limit_window_seconds: int = 300

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def is_production(self) -> bool:
        """Return True when running in production environment."""
        return self.environment.strip().lower() == "production"

    @property
    def cookie_secure(self) -> bool:
        """Enable Secure cookie flag automatically in production or when explicitly set."""
        if self.session_cookie_secure is not None:
            return self.session_cookie_secure
        return self.is_production

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse comma-separated CORS origins into a clean list."""
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]

    @property
    def zone_info(self) -> tzinfo:
        """Return the configured timezone or fall back to local system tz."""
        try:
            return ZoneInfo(self.timezone)
        except ZoneInfoNotFoundError:
            local_tz = datetime.now().astimezone().tzinfo
            return local_tz if local_tz is not None else ZoneInfo("UTC")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()
