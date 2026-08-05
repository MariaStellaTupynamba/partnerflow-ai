import secrets

from fastapi import Cookie, Depends, Header, HTTPException, status

from app.api.deps import get_current_user
from app.core.cookies import CSRF_TOKEN_COOKIE
from app.models.user import User

CSRF_TOKEN_HEADER = "x-csrf-token"


async def verify_csrf_token(
    # Not otherwise used here — declaring it forces FastAPI to resolve authentication
    # *before* the CSRF check, so an anonymous request fails with 401, not a confusing 403.
    # CSRF protection is meaningless without a session to protect in the first place.
    _current_user: User = Depends(get_current_user),
    csrf_cookie: str | None = Cookie(default=None, alias=CSRF_TOKEN_COOKIE),
    csrf_header: str | None = Header(default=None, alias=CSRF_TOKEN_HEADER),
) -> None:
    """Double-submit cookie check for state-changing requests.

    A cross-site request forged against a logged-in user still carries their cookies (that's
    the whole problem SameSite=None creates), but the attacker's page can't read this cookie's
    value cross-origin, so it can't produce a matching header. Register/login/refresh/logout
    are deliberately exempt — see docs/architecture.md for why.
    """
    if not csrf_cookie or not csrf_header or not secrets.compare_digest(csrf_cookie, csrf_header):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Missing or invalid CSRF token.",
        )
