from datetime import datetime
from uuid import UUID

from pydantic import EmailStr, Field

from app.schemas.base import CamelModel


class VendorCreate(CamelModel):
    name: str = Field(min_length=1, max_length=200)
    website: str | None = Field(default=None, max_length=500)
    contact_name: str | None = Field(default=None, max_length=200)
    contact_email: EmailStr | None = None
    notes: str | None = Field(default=None, max_length=5000)


class VendorUpdate(CamelModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    website: str | None = Field(default=None, max_length=500)
    contact_name: str | None = Field(default=None, max_length=200)
    contact_email: EmailStr | None = None
    notes: str | None = Field(default=None, max_length=5000)


class VendorRead(CamelModel):
    id: UUID
    name: str
    website: str | None
    contact_name: str | None
    contact_email: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
