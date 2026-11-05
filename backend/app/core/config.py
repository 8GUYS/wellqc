from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os

def _get_default_frontend_url() -> str:
    # 1. Direct explicit environment variables
    env_url = (
        os.getenv("FRONTEND_URL")
        or os.getenv("NEXT_PUBLIC_APP_URL")
        or os.getenv("APP_URL")
    )
    if env_url and env_url.strip():
        return env_url.strip().rstrip("/")
    
    # 2. Cloud / Production environments default to canonical production Vercel frontend
    is_prod = (
        bool(os.getenv("RENDER"))
        or os.getenv("NODE_ENV") == "production"
        or os.getenv("ENVIRONMENT") == "production"
        or "neon.tech" in os.getenv("DATABASE_URL", "")
        or "neon.tech" in os.getenv("POSTGRES_PRISMA_URL", "")
    )
    if is_prod:
        return "https://wellqc.vercel.app"
        
    return "http://localhost:3000"

DEFAULT_DEV_SECRET = "wellqc-local-development-secret"


def validate_auth_secret(secret: str, environment: str, on_render: bool) -> None:
    """Refuse to start in production with a missing, default or short AUTH_SECRET."""
    production_like = on_render or (environment or "").lower() == "production"
    if not production_like:
        return
    if not secret or secret == DEFAULT_DEV_SECRET or len(secret) < 32:
        raise RuntimeError(
            "AUTH_SECRET must be set to a unique value of at least 32 characters in production."
        )
class Settings(BaseSettings):
    PROJECT_NAME: str = "WellQC API"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("NODE_ENV", "development")
    
    # Session cookie & Auth settings (exact match with Next.js src/lib/auth.ts)
    AUTH_SECRET: str = os.getenv("AUTH_SECRET", "wellqc-local-development-secret")
    SESSION_COOKIE_NAME: str = "wellqc_session"
    SESSION_MAX_AGE_SECONDS: int = int(os.getenv("SESSION_MAX_AGE_SECONDS", str(30 * 60)))  # 30 minutes (1,800s)
    
    # Email Verification & Notifications
    FRONTEND_URL: str = _get_default_frontend_url()
    EMAIL_VERIFICATION_TOKEN_EXPIRE_SECONDS: int = int(
        os.getenv("EMAIL_VERIFICATION_TOKEN_EXPIRE_SECONDS", str(24 * 3600))  # 24 hours
    )
    REQUIRE_EMAIL_VERIFICATION: bool = os.getenv("REQUIRE_EMAIL_VERIFICATION", "true").lower() in ("true", "1", "t")
    EMAIL_PROVIDER: str = os.getenv("EMAIL_PROVIDER", "EMAILJS")  # "EMAILJS", "RESEND", "DEV_LOGGER"
    EMAILJS_SERVICE_ID: str = os.getenv("EMAILJS_SERVICE_ID", "")
    EMAILJS_TEMPLATE_ID: str = os.getenv("EMAILJS_TEMPLATE_ID", "")
    EMAILJS_RESET_TEMPLATE_ID: str = os.getenv("EMAILJS_RESET_TEMPLATE_ID", "")
    EMAILJS_PUBLIC_KEY: str = os.getenv("EMAILJS_PUBLIC_KEY", "")
    EMAILJS_PRIVATE_KEY: str = os.getenv("EMAILJS_PRIVATE_KEY", "")
    RESEND_API_KEY: str = os.getenv("RESEND_API_KEY", "")
    RESEND_FROM_EMAIL: str = os.getenv("RESEND_FROM_EMAIL", "WellQC <onboarding@resend.dev>")
    
    # Cloudflare R2 Blob Storage
    # Leave these blank in local dev -- the app will fall back to storing rawContent in the DB.
    R2_ACCOUNT_ID: str = os.getenv("R2_ACCOUNT_ID", "")
    R2_ACCESS_KEY_ID: str = os.getenv("R2_ACCESS_KEY_ID", "")
    R2_SECRET_ACCESS_KEY: str = os.getenv("R2_SECRET_ACCESS_KEY", "")
    R2_BUCKET_NAME: str = os.getenv("R2_BUCKET_NAME", "wellqc-las-files")

    # Database
    DATABASE_URL: str = (
        os.getenv("POSTGRES_URL")
        or os.getenv("DATABASE_URL")
        or "postgresql://postgres:postgres@localhost:5432/main"
    )
    
    # CORS
    # Explicit, always-allowed origins. Extra production/custom-domain origins can be
    # added later via the CORS_EXTRA_ORIGINS env var (comma-separated), no code change needed.
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
    CORS_EXTRA_ORIGINS: str = os.getenv("CORS_EXTRA_ORIGINS", "")

    # Matches every Vercel deployment of this project: the production domain
    # (wellqc.vercel.app) and every preview deployment Vercel generates per PR/branch
    # (e.g. wellqc-git-<branch>-<team>.vercel.app, wellqc-<hash>-<team>.vercel.app).
    # Safe to leave on even after a custom domain is added later.
    CORS_ORIGIN_REGEX: str = r"^https://wellqc(-[a-zA-Z0-9-]+)?\.vercel\.app$"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    @property
    def all_cors_origins(self) -> List[str]:
        extra = [o.strip() for o in self.CORS_EXTRA_ORIGINS.split(",") if o.strip()]
        return self.CORS_ORIGINS + extra

settings = Settings()
validate_auth_secret(settings.AUTH_SECRET, settings.ENVIRONMENT, bool(os.getenv("RENDER")))