from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
import schemas
import models
from database import get_db
from controllers.auth_controller import AuthController
from utils.auth_utils import get_current_user
from utils.logger import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api", tags=["auth"])


@router.post("/register", response_model=schemas.UserOut, status_code=status.HTTP_201_CREATED)
async def register_user(user: schemas.UserCreate, db: AsyncSession = Depends(get_db)):
    logger.debug(f"POST /api/register — {user.email}")
    return await AuthController.register(user, db)


@router.post("/login", response_model=schemas.Token)
async def login_for_access_token(user_credentials: schemas.UserLogin, db: AsyncSession = Depends(get_db)):
    logger.debug(f"POST /api/login — {user_credentials.email}")
    return await AuthController.login(user_credentials, db)


@router.post("/auth/google", response_model=schemas.Token)
async def google_auth(data: schemas.GoogleAuth, db: AsyncSession = Depends(get_db)):
    logger.debug("POST /api/auth/google")
    return await AuthController.google_login(data.token, db)


@router.get("/users/me", response_model=schemas.UserOut)
async def read_users_me(current_user: models.User = Depends(get_current_user)):
    logger.debug(f"GET /api/users/me — {current_user.email}")
    return current_user


@router.get("/webrtc/turn-credentials", response_model=schemas.TurnCredentialsResponse)
async def get_turn_credentials(current_user: models.User = Depends(get_current_user)):
    logger.debug(f"GET /api/webrtc/turn-credentials — {current_user.email}")
    return AuthController.get_turn_credentials(current_user)
