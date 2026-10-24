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

from starlette.middleware.base import BaseHTTPMiddleware
from backend.app.core.security import detect_sql_injection

class SQLInjectionAndFormSecurityMiddleware(BaseHTTPMiddleware):
    """
    Enterprise Web Application Firewall (WAF) & Form Security Middleware.
    - Inspects query parameters and JSON payloads for SQL injection attacks.
    - Rejects null bytes in payloads.
    - Limits request body size to mitigate Denial of Service (DoS).
    - Enforces secure response headers across all HTTP replies.
    """
    async def dispatch(self, request: Request, call_next):
        # 1. Query parameter scanning for SQL injection
        for q_key, q_val in request.query_params.multi_items():
            threat = detect_sql_injection(q_val, f"query_param[{q_key}]")
            if threat:
                client_ip = request.client.host if request.client else "unknown"
                logger.warning(f"SECURITY ALERT: Blocked SQL injection in query params from {client_ip} on {request.url.path}: {threat}")
                return JSONResponse(
                    status_code=400,
                    content={
                        "detail": "Request rejected: potentially malicious SQL injection detected.",
                        "error": "Malicious payload detected",
                        "status": 400,
                    },
                )

        # 2. Body inspection for JSON requests
        content_type = request.headers.get("content-type", "").lower()
        if request.method in ("POST", "PUT", "PATCH") and "application/json" in content_type:
            content_length = request.headers.get("content-length")
            if content_length and int(content_length) > 10 * 1024 * 1024:
                return JSONResponse(
                    status_code=413,
                    content={"detail": "Payload too large. Maximum JSON body is 10MB.", "status": 413},
                )

            body = await request.body()
            if body:
                # Re-inject body so downstream route handlers can consume it
                async def receive():
                    return {"type": "http.request", "body": body}
                request._receive = receive

                try:
                    import json
                    parsed_json = json.loads(body.decode("utf-8"))
                    # Filter out password fields from tautology checks to allow complex special character passwords
                    def scan_safely(obj, path="body"):
                        if isinstance(obj, dict):
                            for k, v in obj.items():
                                if k.lower() in ("password", "currentpassword", "newpassword"):
                                    # Still disallow null bytes and stacked DDL commands in passwords
                                    if isinstance(v, str) and ("\x00" in v or "; drop " in v.lower()):
                                        return f"Malicious command in {path}.{k}"
                                    continue
                                t = scan_safely(v, f"{path}.{k}")
                                if t:
                                    return t
                            return None
                        return detect_sql_injection(obj, path)

                    threat = scan_safely(parsed_json)
                    if threat:
                        client_ip = request.client.host if request.client else "unknown"
                        logger.warning(f"SECURITY ALERT: Blocked SQL injection in JSON payload from {client_ip} on {request.url.path}: {threat}")
                        return JSONResponse(
                            status_code=400,
                            content={
                                "detail": "Request rejected: potentially malicious SQL injection detected in form data.",
                                "error": "Malicious payload detected",
                                "status": 400,
                            },
                        )
                except UnicodeDecodeError:
                    return JSONResponse(status_code=400, content={"detail": "Invalid character encoding.", "status": 400})
                except json.JSONDecodeError:
                    pass

        response = await call_next(request)

        # 3. Add defense-in-depth security response headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        return response


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
    Catches unhandled exceptions, logs full traceback securely to server logs,
    and returns a structured JSON payload. Masks internal database/SQLAlchemy errors
    to prevent error-based SQL injection leakage.
    """
    logger.error(f"Global unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    exc_str = str(exc)
    is_db_error = any(
        kw in exc_str.lower()
        for kw in ["sqlalchemy", "psycopg2", "syntax error", "relation", "pg_", "column", "table", "cursor", "database"]
    )
    client_detail = (
        "A database error occurred. The incident has been logged."
        if is_db_error
        else (exc_str if settings.ENVIRONMENT == "development" else "An internal server error occurred.")
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": client_detail,
            "error": client_detail,
            "status": 500,
        },
    )

# ---------------------------------------------------------------------------
# Security & Cross-Origin Resource Sharing (CORS) Middleware
# ---------------------------------------------------------------------------
app.add_middleware(SQLInjectionAndFormSecurityMiddleware)
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