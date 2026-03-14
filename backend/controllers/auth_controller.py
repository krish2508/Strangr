from fastapi import HTTPException, status
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
import schemas
import models
from utils import auth_utils
from utils.logger import get_logger

logger = get_logger(__name__)

class AuthController:
    
    @staticmethod
    async def register(user_data: schemas.UserCreate, db: AsyncSession):
        logger.info(f"Attempting to register user with email: {user_data.email}")
        try:
            # Check if user exists
            logger.debug("Checking if user already exists in database")
            result = await db.execute(select(models.User).where(models.User.email == user_data.email))
            existing_user = result.scalars().first()
            
            if existing_user:
                logger.warning(f"Registration failed: Email {user_data.email} already registered")
                raise HTTPException(status_code=400, detail="Email already registered")
            
            # Create new user
            hashed_password = auth_utils.get_password_hash(user_data.password)
            db_user = models.User(
                name=user_data.name,
                email=user_data.email,
                password_hash=hashed_password
            )
            
            db.add(db_user)
            await db.commit()
            await db.refresh(db_user)
            
            logger.info(f"Successfully registered user: {user_data.email}")
            return db_user
            
        except HTTPException:
            # Re-raise HTTPExceptions as we threw them manually
            raise
        except Exception as e:
            # Catch DB or generic errors securely
            logger.error(f"Unexpected error during registration for {user_data.email}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                detail=f"An error occurred while creating the user: {str(e)}"
            )

    @staticmethod
    async def login(user_credentials: schemas.UserLogin, db: AsyncSession):
        logger.info(f"Attempting login for user: {user_credentials.email}")
        try:
            logger.debug("Fetching user from database")
            result = await db.execute(select(models.User).where(models.User.email == user_credentials.email))
            user = result.scalars().first()

            if not user or not auth_utils.verify_password(user_credentials.password, user.password_hash):
                logger.warning(f"Login failed: Incorrect email or password for {user_credentials.email}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect email or password",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            logger.debug("Credentials verified. Generating tokens.")
            access_token = auth_utils.create_access_token(data={"sub": user.email})
            refresh_token = auth_utils.create_refresh_token(data={"sub": user.email})
            
            logger.info(f"Successfully generated tokens for {user_credentials.email}")
            return {
                "access_token": access_token, 
                "refresh_token": refresh_token, 
                "token_type": "bearer"
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Unexpected error during login for {user_credentials.email}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
                detail=f"An error occurred during login: {str(e)}"
            )
