import logging

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.schemas.health import HealthCheckResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["health"])

SERVICE_NAME = "partnerflow-api"
SERVICE_VERSION = "0.1.0"


@router.get("/health", response_model=HealthCheckResponse)
async def health_check(db: AsyncSession = Depends(get_db_session)) -> HealthCheckResponse:
    try:
        await db.execute(text("SELECT 1"))
        database_status = "connected"
    except Exception:
        logger.exception("Health check database connectivity check failed")
        database_status = "unavailable"

    return HealthCheckResponse(
        status="ok" if database_status == "connected" else "error",
        service=SERVICE_NAME,
        version=SERVICE_VERSION,
        database=database_status,
    )
