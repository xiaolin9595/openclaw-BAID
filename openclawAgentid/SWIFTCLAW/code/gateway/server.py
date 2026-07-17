"""FastAPI gateway server."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, status
from loguru import logger

from config import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Application lifespan manager."""
    # Startup
    settings = get_settings()
    logger.info(f"Starting SwiftClaw Gateway on port {settings.port}")
    logger.info(f"Using model: {settings.moonshot_model}")
    yield
    # Shutdown
    logger.info("Shutting down SwiftClaw Gateway")


def create_app() -> FastAPI:
    """Create and configure FastAPI application.

    Returns:
        Configured FastAPI app instance.
    """
    app = FastAPI(
        title="SwiftClaw Gateway",
        description="Personal AI Assistant Platform",
        version="0.1.0",
        lifespan=lifespan,
    )

    @app.get("/health", status_code=status.HTTP_200_OK)
    async def health_check() -> dict[str, str]:
        """Health check endpoint.

        Returns:
            Health status JSON.
        """
        return {"status": "healthy", "service": "swiftclaw-gateway"}

    @app.get("/api/status")
    async def service_status() -> dict[str, str]:
        """Service status endpoint.

        Returns:
            Detailed service status.
        """
        settings = get_settings()
        return {
            "service": "swiftclaw",
            "version": "0.1.0",
            "model": settings.moonshot_model,
            "status": "running",
        }

    return app
