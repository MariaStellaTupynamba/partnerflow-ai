from uuid import UUID

from pydantic import Field

from app.schemas.base import CamelModel


class ComparisonRequest(CamelModel):
    proposal_ids: list[UUID] = Field(min_length=2, max_length=10)


class ComparisonResponse(CamelModel):
    summary: str
