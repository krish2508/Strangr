import os
import base64
import hashlib
import hmac
import uuid
import requests as http_requests
from fastapi import HTTPException, Request, Response, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
import schemas
import models
from utils import auth_utils
from utils.logger import get_logger

logger = get_logger(__name__)

GOOGLE_TOKENINFO_URL = "https://www.googleapis.com/oauth2/v1/tokeninfo"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"
TURN_CREDENTIAL_TTL_SECONDS = int(os.getenv("TURN_CREDENTIAL_TTL_SECONDS", "3600"))


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


def _get_client_ip(request: Request) -> str | None:
    forwarded_for = request.headers.get("X-Forwarded-For", "")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


async def _create_session_tokens(
    user: models.User,
    db: AsyncSession,
    request: Request,
) -> tuple[str, str]:
    refresh_expires_at = datetime.now(timezone.utc) + auth_utils.get_refresh_token_expires_delta()
    refresh_jti = str(uuid.uuid4())
    token_data = {
        "sub": user.email,
        "uid": str(user.id),
    }
    access_token = auth_utils.create_access_token(data=token_data)
    refresh_token = auth_utils.create_refresh_token(
        data={
            **token_data,
            "jti": refresh_jti,
        }
    )

    refresh_session = models.RefreshTokenSession(
        user_id=user.id,
        jti=refresh_jti,
        expires_at=refresh_expires_at.replace(tzinfo=None),
        user_agent=request.headers.get("User-Agent"),
        ip_address=_get_client_ip(request),
    )
    db.add(refresh_session)
    await db.flush()
    return access_token, refresh_token


async def _issue_auth_session(
    user: models.User,
    db: AsyncSession,
    request: Request,
    response: Response,
) -> schemas.AuthSessionResponse:
    access_token, refresh_token = await _create_session_tokens(user, db, request)
    await db.commit()
    auth_utils.set_auth_cookies(
        response,
        access_token=access_token,
        refresh_token=refresh_token,
    )
    return schemas.AuthSessionResponse.model_validate({"user": user})


async def _get_refresh_session(
    db: AsyncSession,
    refresh_jti: str,
) -> models.RefreshTokenSession | None:
    result = await db.execute(
        select(models.RefreshTokenSession).where(models.RefreshTokenSession.jti == refresh_jti)
    )
    return result.scalars().first()


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
    async def login(
        user_credentials: schemas.UserLogin,
        db: AsyncSession,
        request: Request,
        response: Response,
    ) -> schemas.AuthSessionResponse:
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

            token_response = await _issue_auth_session(user, db, request, response)
            logger.info(f"Login successful: {user_credentials.email}")
            return token_response

        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error during login for {user_credentials.email}: {e}")
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Login failed")

    @staticmethod
    async def google_login(
        token: str,
        db: AsyncSession,
        request: Request,
        response: Response,
    ) -> schemas.AuthSessionResponse:
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
        token_response = await _issue_auth_session(user, db, request, response)
        logger.info(f"Google login successful for: {email}")
        return token_response

    @staticmethod
    async def refresh_access_token(
        refresh_token: str,
        db: AsyncSession,
        request: Request,
        response: Response,
    ) -> schemas.AuthSessionResponse:
        """Rotate tokens using a valid refresh token."""
        payload = auth_utils.decode_token_payload(refresh_token, expected_type="refresh")
        email = str(payload["sub"])
        refresh_jti = str(payload.get("jti") or "")
        if not refresh_jti:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        user = await _get_user_by_email(db, email)
        if not user:
            logger.warning(f"Refresh rejected — user not found for email: {email}")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        refresh_session = await _get_refresh_session(db, refresh_jti)
        if not refresh_session:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        now = datetime.now(timezone.utc).replace(tzinfo=None)
        if refresh_session.revoked_at or refresh_session.expires_at <= now:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

        access_token, next_refresh_token = await _create_session_tokens(user, db, request)
        next_refresh_payload = auth_utils.decode_token_payload(next_refresh_token, expected_type="refresh")
        refresh_session.revoked_at = now
        refresh_session.replaced_by_jti = str(next_refresh_payload.get("jti") or "")
        await db.commit()
        auth_utils.set_auth_cookies(
            response,
            access_token=access_token,
            refresh_token=next_refresh_token,
        )
        logger.info(f"Token refresh successful for: {email}")
        return schemas.AuthSessionResponse.model_validate({"user": user})

    @staticmethod
    async def logout(refresh_token: str | None, db: AsyncSession, response: Response) -> None:
        auth_utils.clear_auth_cookies(response)
        if not refresh_token:
            return

        try:
            payload = auth_utils.decode_token_payload(refresh_token, expected_type="refresh")
            refresh_jti = str(payload.get("jti") or "")
            if not refresh_jti:
                return
            refresh_session = await _get_refresh_session(db, refresh_jti)
            if not refresh_session or refresh_session.revoked_at:
                return
            refresh_session.revoked_at = datetime.now(timezone.utc).replace(tzinfo=None)
            await db.commit()
        except HTTPException:
            return

    @staticmethod
    def get_turn_credentials(user: models.User) -> schemas.TurnCredentialsResponse:
        shared_secret = os.getenv("TURN_SHARED_SECRET", "").strip()
        udp_url = os.getenv("TURN_UDP_URL", "").strip()
        tls_url = os.getenv("TURN_TLS_URL", "").strip()

        if not shared_secret or (not udp_url and not tls_url):
            logger.info("TURN dynamic credentials requested but TURN env is not fully configured")
            return schemas.TurnCredentialsResponse(ttl_seconds=0, ice_servers=[])

        expiry = int(datetime.now(timezone.utc).timestamp()) + TURN_CREDENTIAL_TTL_SECONDS
        username = f"{expiry}:{user.id}"
        digest = hmac.new(
            shared_secret.encode("utf-8"),
            username.encode("utf-8"),
            hashlib.sha1,
        ).digest()
        credential = base64.b64encode(digest).decode("utf-8")

        ice_servers: list[schemas.TurnIceServer] = []
        if udp_url:
            ice_servers.append(
                schemas.TurnIceServer(
                    urls=[udp_url],
                    username=username,
                    credential=credential,
                )
            )
        if tls_url:
            ice_servers.append(
                schemas.TurnIceServer(
                    urls=[tls_url],
                    username=username,
                    credential=credential,
                )
            )

        logger.debug("Issued TURN credentials for user_id=%s ttl=%s", user.id, TURN_CREDENTIAL_TTL_SECONDS)
        return schemas.TurnCredentialsResponse(
            ttl_seconds=TURN_CREDENTIAL_TTL_SECONDS,
            ice_servers=ice_servers,
        )
