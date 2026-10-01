from pydantic import BaseModel, EmailStr
from typing import Optional

class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    department: Optional[str] = None
    tier: Optional[str] = "FREE"
    freeChecksUsed: Optional[int] = 0
    ndaAcceptedAt: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: Optional[str] = "PETROPHYSICIST"
    acceptedNda: Optional[bool] = False

class DemoAuthRequest(BaseModel):
    action: Optional[str] = "login"
