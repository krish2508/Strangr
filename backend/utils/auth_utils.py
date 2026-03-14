import os
from datetime import datetime, timedelta
from typing import Annotated
from jose import JWTError, jwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import User
from utils.logger import get_logger

logger = get_logger(__name__)

SECRET_KEY = os.getenv("SECRET_KEY", "b39a7b6c5e8f498a3b53f6a6296d8bd214fc6616428bc5fbb5c72e27caba93fa")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception as e:
        logger.error(f"Password verification encountered an error: {str(e)}")
        return False

def get_password_hash(password: str) -> str:
    logger.debug("Generating password hash")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    logger.debug(f"Creating access token for payload: {data}")
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict) -> str:
    logger.debug(f"Creating refresh token for payload: {data}")
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            logger.warning("Token decoding failed: Subject missing from payload")
            raise credentials_exception
    except JWTError as e:
        logger.warning(f"Token decoding failed: JWTError: {str(e)}")
        raise credentials_exception
    except Exception as e:
        logger.error(f"Unexpected error during token decoding: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during token decoding")
    
    try:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
    except Exception as e:
        logger.error(f"Database error while fetching parsed user {email}: {str(e)}")
        raise HTTPException(status_code=500, detail="Database connection error")
    
    if user is None:
        logger.warning(f"Token decoded but user {email} not found in database")
        raise credentials_exception
        
    logger.debug(f"Token validated successfully for user: {email}")
    return user
