import os
import requests as http_requests
from fastapi import HTTPException, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
import schemas
import models
from utils import auth_utils
from utils.logger import get_logger

logger = get_logger(__name__)

GOOGLE_TOKENINFO_URL = "https://www.googleapis.com/oauth2/v1/tokeninfo"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


def _get_google_client_id() -> str:
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    if not client_id:
        logger.error("GOOGLE_CLIENT_ID is not configured")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google authentication is not configured",
        )
    return client_id


def _validate_google_access_token(token: str) -> None:
    client_id = _get_google_client_id()

    try:
        resp = http_requests.get(
            GOOGLE_TOKENINFO_URL,
            params={"access_token": token},
            timeout=10,
        )
        resp.raise_for_status()
        token_info = resp.json()
    except Exception as e:
        logger.error(f"Failed to validate Google access token: {e}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")

    valid_audiences = {
        token_info.get("issued_to"),
        token_info.get("audience"),
        token_info.get("aud"),
        token_info.get("azp"),
    }

    if client_id not in valid_audiences:
        logger.warning("Rejected Google token because audience/client id did not match")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token audience")


async def _get_user_by_email(db: AsyncSession, email: str) -> models.User | None:
    """Utility: fetch a user record by email from the database."""
    result = await db.execute(select(models.User).where(models.User.email == email))
    return result.scalars().first()


def _build_token_response(user: models.User) -> dict:
    """Utility: create the standard token response dict for a given user."""
    access_token = auth_utils.create_access_token(data={"sub": user.email})
    refresh_token = auth_utils.create_refresh_token(data={"sub": user.email})
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


class AuthController:

    @staticmethod
    async def register(user_data: schemas.UserCreate, db: AsyncSession) -> models.User:
        """Register a new local user. Raises 400 if email already exists."""
        logger.info(f"Register attempt for email: {user_data.email}")
        try:
            existing_user = await _get_user_by_email(db, user_data.email)
            if existing_user:
                logger.warning(f"Registration rejected — email already in use: {user_data.email}")
                raise HTTPException(status_code=400, detail="Email already registered")

            hashed_password = auth_utils.get_password_hash(user_data.password)
            db_user = models.User(
                name=user_data.name,
                email=user_data.email,
                password_hash=hashed_password,
                provider="local",
            )
            db.add(db_user)
            await db.commit()
            await db.refresh(db_user)
            logger.info(f"User registered successfully: {user_data.email}")
            return db_user

        except HTTPException:
            raise
        except Exception as e:
            await db.rollback()
            logger.error(f"Unexpected error during registration for {user_data.email}: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to create user")

    @staticmethod
    async def login(user_credentials: schemas.UserLogin, db: AsyncSession) -> dict:
        """Authenticate a local user and return JWT tokens."""
        logger.info(f"Login attempt for email: {user_credentials.email}")
        try:
            user = await _get_user_by_email(db, user_credentials.email)
            if not user or not auth_utils.verify_password(user_credentials.password, user.password_hash):
                logger.warning(f"Login rejected — invalid credentials for: {user_credentials.email}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect email or password",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            token_response = _build_token_response(user)
            logger.info(f"Login successful: {user_credentials.email}")
            return token_response

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error during login for {user_credentials.email}: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Login failed")

    @staticmethod
    async def google_login(token: str, db: AsyncSession) -> dict:
        """Authenticate or create a user via Google OAuth access token."""
        logger.info("Google login attempt received")
        _validate_google_access_token(token)

        # Step 1: Fetch user info from Google
        try:
            resp = http_requests.get(
                GOOGLE_USERINFO_URL,
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
            resp.raise_for_status()
            user_info = resp.json()
            email: str = user_info["email"]
            name: str = user_info.get("name", "")
            email_verified = user_info.get("email_verified", True)
            if not email or not email_verified:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Google account email is not verified",
                )
        except Exception as e:
            if isinstance(e, HTTPException):
                raise
            logger.error(f"Failed to fetch Google user info: {e}")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")

        logger.debug(f"Google user info retrieved for: {email}")

        # Step 2: Find or create the user in the database
        try:
            user = await _get_user_by_email(db, email)
            if not user:
                logger.info(f"Creating new Google-authenticated user: {email}")
                user = models.User(
                    name=name,
                    email=email,
                    password_hash="",
                    provider="google",
                )
                db.add(user)
                await db.commit()
                await db.refresh(user)
            else:
                logger.debug(f"Existing user found for Google login: {email}")
        except Exception as e:
            await db.rollback()
            logger.error(f"Database error during Google login for {email}: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error during Google login")

        # Step 3: Issue tokens
        token_response = _build_token_response(user)
        logger.info(f"Google login successful for: {email}")
        return token_response
