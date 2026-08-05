import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db_session, get_owned_proposal, get_owned_vendor
from app.core.csrf import verify_csrf_token
from app.models.proposal import Proposal
from app.models.user import User
from app.models.vendor import Vendor
from app.schemas.comparison import ComparisonRequest, ComparisonResponse
from app.schemas.proposal import ProposalCreate, ProposalRead, ProposalUpdate
from app.services.ai.factory import get_ai_provider

logger = logging.getLogger(__name__)

router = APIRouter(tags=["proposals"])

COMPARISON_SYSTEM_PROMPT = (
    "You are an assistant helping a procurement team compare vendor proposals. Be concise and "
    "objective. Highlight concrete differences in price, scope, and terms. Only use information "
    "present in the proposals below — do not invent details."
)


@router.post(
    "/vendors/{vendor_id}/proposals",
    response_model=ProposalRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(verify_csrf_token)],
)
async def create_proposal(
    payload: ProposalCreate,
    vendor: Vendor = Depends(get_owned_vendor),
    db: AsyncSession = Depends(get_db_session),
) -> Proposal:
    proposal = Proposal(vendor_id=vendor.id, **payload.model_dump())
    db.add(proposal)
    await db.commit()
    await db.refresh(proposal)
    return proposal


@router.get("/vendors/{vendor_id}/proposals", response_model=list[ProposalRead])
async def list_proposals_for_vendor(
    vendor: Vendor = Depends(get_owned_vendor),
    db: AsyncSession = Depends(get_db_session),
) -> list[Proposal]:
    result = await db.scalars(
        select(Proposal).where(Proposal.vendor_id == vendor.id).order_by(Proposal.created_at)
    )
    return list(result)


@router.get("/proposals", response_model=list[ProposalRead])
async def list_all_proposals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> list[Proposal]:
    """All of the current user's proposals across every vendor — used by the comparison UI,
    which lets a user compare proposals from different vendors, not just one vendor's own."""
    result = await db.scalars(
        select(Proposal).join(Vendor).where(Vendor.owner_id == current_user.id)
        .order_by(Proposal.created_at)
    )
    return list(result)


def _format_proposal_for_prompt(proposal: Proposal, vendor: Vendor) -> str:
    if proposal.price is not None:
        price = f"{proposal.price} {proposal.currency}"
    else:
        price = "not specified"
    submitted = proposal.submitted_at.isoformat() if proposal.submitted_at else "not specified"
    return (
        f"Vendor: {vendor.name}\n"
        f"Proposal: {proposal.title}\n"
        f"Price: {price}\n"
        f"Submitted: {submitted}\n"
        f"Details: {proposal.summary}"
    )


@router.post(
    "/proposals/compare",
    response_model=ComparisonResponse,
    dependencies=[Depends(verify_csrf_token)],
)
async def compare_proposals(
    payload: ComparisonRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> ComparisonResponse:
    result = await db.scalars(
        select(Proposal)
        .join(Vendor)
        .where(Proposal.id.in_(payload.proposal_ids), Vendor.owner_id == current_user.id)
    )
    proposals = list(result)
    if len(proposals) != len(set(payload.proposal_ids)):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more proposals were not found.",
        )

    # Ownership was already verified via the join above, but the join doesn't populate the
    # relationship attribute itself — load it explicitly for the prompt-formatting step.
    for proposal in proposals:
        await db.refresh(proposal, attribute_names=["vendor"])

    prompt = "\n\n".join(
        _format_proposal_for_prompt(proposal, proposal.vendor) for proposal in proposals
    )

    try:
        provider = get_ai_provider()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI comparison is not configured on this server.",
        ) from exc

    try:
        summary = await provider.generate(prompt, system_prompt=COMPARISON_SYSTEM_PROMPT)
    except Exception as exc:
        logger.exception("AI provider request failed during proposal comparison")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI provider request failed. Try again shortly.",
        ) from exc

    return ComparisonResponse(summary=summary)


@router.get("/proposals/{proposal_id}", response_model=ProposalRead)
async def read_proposal(proposal: Proposal = Depends(get_owned_proposal)) -> Proposal:
    return proposal


@router.patch(
    "/proposals/{proposal_id}",
    response_model=ProposalRead,
    dependencies=[Depends(verify_csrf_token)],
)
async def update_proposal(
    payload: ProposalUpdate,
    proposal: Proposal = Depends(get_owned_proposal),
    db: AsyncSession = Depends(get_db_session),
) -> Proposal:
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(proposal, field, value)
    await db.commit()
    await db.refresh(proposal)
    return proposal


@router.delete(
    "/proposals/{proposal_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(verify_csrf_token)],
)
async def delete_proposal(
    proposal: Proposal = Depends(get_owned_proposal), db: AsyncSession = Depends(get_db_session)
) -> None:
    await db.delete(proposal)
    await db.commit()
