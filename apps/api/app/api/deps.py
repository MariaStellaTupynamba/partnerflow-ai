from collections.abc import AsyncGenerator
from uuid import UUID

from fastapi import Cookie, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cookies import ACCESS_TOKEN_COOKIE
from app.core.security import InvalidTokenError, TokenType, decode_token
from app.db.session import get_db
from app.models.proposal import Proposal
from app.models.user import User
from app.models.vendor import Vendor


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async for session in get_db():
        yield session


async def get_current_user(
    access_token: str | None = Cookie(default=None, alias=ACCESS_TOKEN_COOKIE),
    db: AsyncSession = Depends(get_db_session),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
    )

    if access_token is None:
        raise unauthorized

    try:
        user_id: UUID = decode_token(access_token, TokenType.ACCESS)
    except InvalidTokenError as exc:
        raise unauthorized from exc

    user = await db.scalar(select(User).where(User.id == user_id))
    if user is None or not user.is_active:
        raise unauthorized

    return user


async def get_owned_vendor(
    vendor_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Vendor:
    vendor = await db.scalar(
        select(Vendor).where(Vendor.id == vendor_id, Vendor.owner_id == current_user.id)
    )
    if vendor is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found.")
    return vendor


async def get_owned_proposal(
    proposal_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Proposal:
    proposal = await db.scalar(
        select(Proposal)
        .join(Vendor)
        .where(Proposal.id == proposal_id, Vendor.owner_id == current_user.id)
    )
    if proposal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proposal not found.")
    return proposal
