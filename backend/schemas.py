from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime
from uuid import UUID
from typing import Optional


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class GoogleAuth(BaseModel):
    token: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: EmailStr
    provider: Optional[str] = None
    created_at: datetime


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str


class AuthSessionResponse(BaseModel):
    user: UserOut


class TokenData(BaseModel):
    email: Optional[str] = None


class TurnIceServer(BaseModel):
    urls: list[str]
    username: Optional[str] = None
    credential: Optional[str] = None


class TurnCredentialsResponse(BaseModel):
    ttl_seconds: int
    ice_servers: list[TurnIceServer]
