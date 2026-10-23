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
    isEmailVerified: bool = False
    emailVerifiedAt: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: Optional[str] = "USER"
    acceptedNda: Optional[bool] = False

class VerifyEmailRequest(BaseModel):
    token: str

class ResendVerificationRequest(BaseModel):
    email: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    password: Optional[str] = None
    newPassword: Optional[str] = None

    def get_password(self) -> str:
        return (self.password or self.newPassword or "").strip()

