from datetime import datetime
from uuid import UUID

from pydantic import EmailStr, Field

from app.schemas.base import CamelModel

# bcrypt silently ignores/rejects input beyond 72 bytes; cap here so oversized
# passwords fail validation with a clear 422 instead of an opaque hashing error.
PASSWORD_MAX_LENGTH = 72


class UserCreate(CamelModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=PASSWORD_MAX_LENGTH)


class UserRead(CamelModel):
    id: UUID
    email: EmailStr
    is_active: bool
    created_at: datetime
