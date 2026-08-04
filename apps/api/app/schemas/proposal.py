from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import Field

from app.schemas.base import CamelModel

CURRENCY_PATTERN = r"^[A-Z]{3}$"


class ProposalCreate(CamelModel):
    title: str = Field(min_length=1, max_length=200)
    price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    currency: str = Field(default="USD", pattern=CURRENCY_PATTERN)
    summary: str = Field(min_length=1, max_length=5000)
    submitted_at: date | None = None


class ProposalUpdate(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    currency: str | None = Field(default=None, pattern=CURRENCY_PATTERN)
    summary: str | None = Field(default=None, min_length=1, max_length=5000)
    submitted_at: date | None = None


class ProposalRead(CamelModel):
    id: UUID
    vendor_id: UUID
    title: str
    price: Decimal | None
    currency: str
    summary: str
    submitted_at: date | None
    created_at: datetime
    updated_at: datetime
