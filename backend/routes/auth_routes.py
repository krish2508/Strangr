from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
import schemas
import models
from database import get_db
from controllers.auth_controller import AuthController
from utils.auth_utils import get_current_user, get_refresh_token_from_request
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
async def register_user(user: schemas.UserCreate, db: AsyncSession = Depends(get_db)):
    logger.debug(f"POST /api/register — {user.email}")
    return await AuthController.register(user, db)


@router.post("/login", response_model=schemas.AuthSessionResponse)
async def login_for_access_token(
    user_credentials: schemas.UserLogin,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    logger.debug(f"POST /api/login — {user_credentials.email}")
    return await AuthController.login(user_credentials, db, request, response)


@router.post("/auth/google", response_model=schemas.AuthSessionResponse)
async def google_auth(
    data: schemas.GoogleAuth,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    logger.debug("POST /api/auth/google")
    return await AuthController.google_login(data.token, db, request, response)


@router.post("/refresh", response_model=schemas.AuthSessionResponse)
async def refresh_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    logger.debug("POST /api/refresh")
    refresh_token_value = get_refresh_token_from_request(request)
    return await AuthController.refresh_access_token(refresh_token_value or "", db, request, response)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    logger.debug("POST /api/logout")
    refresh_token_value = request.cookies.get("strangr_refresh_token")
    await AuthController.logout(refresh_token_value, db, response)


@router.get("/users/me", response_model=schemas.UserOut)
async def read_users_me(current_user: models.User = Depends(get_current_user)):
    logger.debug(f"GET /api/users/me — {current_user.email}")
    return current_user


@router.get("/webrtc/turn-credentials", response_model=schemas.TurnCredentialsResponse)
async def get_turn_credentials(current_user: models.User = Depends(get_current_user)):
    logger.debug(f"GET /api/webrtc/turn-credentials — {current_user.email}")
    return AuthController.get_turn_credentials(current_user)
