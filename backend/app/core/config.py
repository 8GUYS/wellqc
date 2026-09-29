from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "WellQC API"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("NODE_ENV", "development")
    
    # Session cookie & Auth settings (exact match with Next.js src/lib/auth.ts)
    AUTH_SECRET: str = os.getenv("AUTH_SECRET", "wellqc-local-development-secret")
    SESSION_COOKIE_NAME: str = "wellqc_session"
    SESSION_MAX_AGE_SECONDS: int = 7 * 24 * 60 * 60  # 7 days
    
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://postgres:postgres@localhost:5432/main"
    )
    
    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
