from pydantic import Field

from app.schemas.base import CamelModel
from app.schemas.user import PASSWORD_MAX_LENGTH


class LoginRequest(CamelModel):
    email: str
    password: str = Field(min_length=1, max_length=PASSWORD_MAX_LENGTH)
