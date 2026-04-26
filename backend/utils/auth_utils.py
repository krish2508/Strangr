import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, Request, Response, WebSocket, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User
from settings import IS_PRODUCTION
from utils.logger import get_logger

logger = get_logger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    if IS_PRODUCTION:
        raise RuntimeError("SECRET_KEY environment variable must be set in production")
    SECRET_KEY = "changeme-in-development"

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7
ACCESS_TOKEN_COOKIE_NAME = "strangr_access_token"
REFRESH_TOKEN_COOKIE_NAME = "strangr_refresh_token"
COOKIE_SECURE = IS_PRODUCTION
COOKIE_SAMESITE = "lax"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception as e:
        logger.error(f"Password verification encountered an error: {e}")
        return False


def get_password_hash(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    to_encode["type"] = "access"
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode["exp"] = expire
    encoded = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    logger.debug(f"Access token created for subject: {data.get('sub')}")
    return encoded


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT refresh token."""
    to_encode = data.copy()
    to_encode["type"] = "refresh"
    to_encode.setdefault("jti", str(uuid.uuid4()))
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))
    to_encode["exp"] = expire
    encoded = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    logger.debug(f"Refresh token created for subject: {data.get('sub')}")
    return encoded


def decode_token_payload(token: str, expected_type: str = "access") -> dict[str, Any]:
    """Decode a JWT and return the payload if token type matches."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        token_type = payload.get("type")
        email: Optional[str] = payload.get("sub")
        if token_type != expected_type:
            logger.warning(f"Token rejected: expected {expected_type}, got {token_type}")
            raise credentials_exception
        if email is None:
            logger.warning("Token rejected: missing 'sub' field in payload")
            raise credentials_exception
        return payload
    except JWTError as e:
        logger.warning(f"Token rejected: JWTError — {e}")
        raise credentials_exception
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error decoding token: {e}")
        raise HTTPException(status_code=500, detail="Internal server error during token validation")


def decode_token_subject(token: str, expected_type: str = "access") -> str:
    """Decode a JWT and return the subject if token type matches."""
    payload = decode_token_payload(token, expected_type=expected_type)
    return str(payload["sub"])


def get_access_token_expires_delta() -> timedelta:
    return timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)


def get_refresh_token_expires_delta() -> timedelta:
    return timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE_NAME,
        value=access_token,
        max_age=int(get_access_token_expires_delta().total_seconds()),
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
    )
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE_NAME,
        value=refresh_token,
        max_age=int(get_refresh_token_expires_delta().total_seconds()),
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(
        key=ACCESS_TOKEN_COOKIE_NAME,
        path="/",
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
    )
    response.delete_cookie(
        key=REFRESH_TOKEN_COOKIE_NAME,
        path="/",
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
    )


def _extract_bearer_token(authorization_header: str | None) -> str | None:
    if not authorization_header:
        return None
    scheme, _, token = authorization_header.partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None
    return token


def get_access_token_from_request(request: Request) -> str:
    token = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME) or _extract_bearer_token(
        request.headers.get("Authorization")
    )
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token


def get_refresh_token_from_request(request: Request) -> str:
    token = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is missing",
        )
    return token


def get_access_token_from_websocket(websocket: WebSocket) -> str:
    token = websocket.cookies.get(ACCESS_TOKEN_COOKIE_NAME)
    if token:
        return token

    authorization_header = websocket.headers.get("Authorization")
    token = _extract_bearer_token(authorization_header)
    if token:
        return token

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required",
    )


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dependency that decodes a JWT and returns the authenticated user."""
    token = get_access_token_from_request(request)
    payload = decode_token_payload(token, expected_type="access")
    email = str(payload["sub"])
    user_id = payload.get("uid")
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        if user_id:
            result = await db.execute(select(User).where(User.id == user_id))
        else:
            result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
    except Exception as e:
        logger.error(f"Database error while fetching user '{email}': {e}")
        raise HTTPException(status_code=500, detail="Database error")

    if user is None:
        logger.warning(f"Token valid but user '{email}' not found in database")
        raise credentials_exception

    logger.debug(f"Authenticated user: {email}")
    return user
