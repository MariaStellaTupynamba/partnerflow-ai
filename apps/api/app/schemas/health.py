from typing import Literal

from app.schemas.base import CamelModel


class HealthCheckResponse(CamelModel):
    status: Literal["ok", "error"]
    service: str
    version: str
    database: Literal["connected", "unavailable"]
