from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session, get_owned_vendor
from app.models.user import User
from app.models.vendor import Vendor
from app.schemas.vendor import VendorCreate, VendorRead, VendorUpdate

router = APIRouter(prefix="/vendors", tags=["vendors"])


@router.post("", response_model=VendorRead, status_code=status.HTTP_201_CREATED)
async def create_vendor(
    payload: VendorCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> Vendor:
    vendor = Vendor(owner_id=current_user.id, **payload.model_dump())
    db.add(vendor)
    await db.commit()
    await db.refresh(vendor)
    return vendor


@router.get("", response_model=list[VendorRead])
async def list_vendors(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[Vendor]:
    result = await db.scalars(
        select(Vendor).where(Vendor.owner_id == current_user.id).order_by(Vendor.created_at)
    )
    return list(result)


@router.get("/{vendor_id}", response_model=VendorRead)
async def read_vendor(vendor: Vendor = Depends(get_owned_vendor)) -> Vendor:
    return vendor


@router.patch("/{vendor_id}", response_model=VendorRead)
async def update_vendor(
    payload: VendorUpdate,
    vendor: Vendor = Depends(get_owned_vendor),
    db: AsyncSession = Depends(get_db_session),
) -> Vendor:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(vendor, field, value)
    await db.commit()
    await db.refresh(vendor)
    return vendor


@router.delete("/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_vendor(
    vendor: Vendor = Depends(get_owned_vendor), db: AsyncSession = Depends(get_db_session)
) -> None:
    await db.delete(vendor)
    await db.commit()
