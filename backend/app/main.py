"""
WellQC Unified Python Backend Entrypoint.

This module initializes the FastAPI application instance, configures cross-origin
resource sharing (CORS), registers the global JSON exception interceptor to avoid
plain-text 500 responses, and mounts all domain-specific API routers.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.app.core.config import settings
from backend.app.api import (
    activity,
    admin,
    analytics,
    auth,
    dashboard,
    las,
    qa_engine,
    standardisation,
    user,
    wells,
)

logger = logging.getLogger("uvicorn.error")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Ensure database schema compatibility on service startup.
    Verifies that User email verification columns and the SystemSetting table exist.
    """
    from backend.app.core.database import engine
    from sqlalchemy import text
    try:
        with engine.begin() as conn:
            cols = {r[0] for r in conn.execute(text(
                "select column_name from information_schema.columns "
                "where table_schema='public' and table_name='User'"))}
            has_setting = conn.execute(text(
                """select to_regclass('public."SystemSetting"') is not null""")).scalar()

            if "isEmailVerified" not in cols:
                conn.execute(text('ALTER TABLE "User" ADD COLUMN "isEmailVerified" BOOLEAN NOT NULL DEFAULT false;'))
            if "emailVerifiedAt" not in cols:
                conn.execute(text('ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);'))
            if not has_setting:
                conn.execute(text('''
                    CREATE TABLE "SystemSetting" (
                        "id" TEXT NOT NULL PRIMARY KEY,
                        "key" TEXT NOT NULL UNIQUE,
                        "value" TEXT NOT NULL,
                        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                '''))
                conn.execute(text('CREATE UNIQUE INDEX IF NOT EXISTS "SystemSetting_key_key" ON "SystemSetting"("key");'))

        logger.info("Database schema compatibility check completed successfully.")
    except Exception as e:
        logger.warning(f"Database schema check warning on startup: {e}")
    yield

# Instantiate FastAPI application with metadata for OpenAPI / Swagger documentation
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Enterprise Well Log Quality Assurance & Petrophysics API",
    swagger_ui_parameters={"persistAuthorization": True},
    lifespan=lifespan,
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global Unhandled Exception Handler.
    
    Catches any unhandled exceptions during request processing, logs the complete
    traceback to the uvicorn error stream, and returns a structured JSON payload
    with Content-Type: application/json. This prevents default Starlette plain-text
    500 responses from triggering JSON.parse syntax errors on the client.
    """
    logger.error(f"Global unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": str(exc) or "An internal server error occurred.",
            "error": str(exc) or "An internal server error occurred.",
            "status": 500,
        },
    )

# ---------------------------------------------------------------------------
# Cross-Origin Resource Sharing (CORS) Middleware
# Allows the Next.js frontend proxy and direct browser calls across configured origins.
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.all_cors_origins,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# API Router Registration
# Mounts modular route handlers for each distinct domain feature.
# ---------------------------------------------------------------------------
app.include_router(auth.router)           # /api/auth: Login, Register, Logout, Demo, NDA
app.include_router(wells.router)          # /api/wells: Well index, detail, curves matrix
app.include_router(las.router)            # /api/las: LAS parser, QA pre-check, commit, imputation
app.include_router(standardisation.router) # /api/standardisation: Mnemonic dictionary & custom aliases
app.include_router(dashboard.router)      # /api/dashboard: Executive quality KPI rollups
app.include_router(analytics.router)      # /api/analytics: Operator and anomaly telemetry
app.include_router(activity.router)       # /api/activity: Audit trail and security activity logs
app.include_router(qa_engine.router)      # /api/qa-engine: QA Engine rules and petrophysical repairs
app.include_router(user.router)           # /api/user: User profile, settings, API tokens
app.include_router(admin.router)          # /api/admin: Tenant administration & user management

@app.get("/health", include_in_schema=False)
@app.get("/api/health", tags=["system"], summary="Service Health Probe")
def health_check():
    """Service liveness probe returning API version, project name, and deployment environment."""
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }

@app.get("/", include_in_schema=False)
def root():
    """Root landing endpoint providing quick reference links to Swagger UI and health probe."""
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "docs": "/docs",
        "health": "/health",
    }