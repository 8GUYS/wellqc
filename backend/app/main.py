from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.app.core.config import settings
from backend.app.api import (
    activity,
    admin,
    analytics,
    auth,
    dashboard,
    las,
    standardisation,
    user,
    wells,
)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Enterprise Well Log Quality Assurance & Petrophysics API",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth.router)
app.include_router(wells.router)
app.include_router(las.router)
app.include_router(standardisation.router)
app.include_router(dashboard.router)
app.include_router(analytics.router)
app.include_router(activity.router)
app.include_router(user.router)
app.include_router(admin.router)

@app.get("/health")
@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }

@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "docs": "/docs",
        "health": "/health",
    }
