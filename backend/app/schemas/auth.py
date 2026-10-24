from pydantic import BaseModel, Field, field_validator
from typing import Optional
from backend.app.core.security import detect_sql_injection

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
    email: str = Field(..., max_length=255)
    password: str = Field(..., max_length=128)

    @field_validator("email")
    @classmethod
    def validate_email_input(cls, v: str) -> str:
        clean = v.strip().lower()
        if not clean:
            raise ValueError("Email cannot be empty.")
        threat = detect_sql_injection(clean, "email")
        if threat:
            raise ValueError(f"Malicious input detected in email: {threat}")
        return clean

    @field_validator("password")
    @classmethod
    def validate_password_input(cls, v: str) -> str:
        if "\x00" in v:
            raise ValueError("Password contains prohibited null bytes.")
        return v

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str = Field(..., max_length=255)
    password: str = Field(..., min_length=8, max_length=128)
    role: Optional[str] = Field("USER", max_length=30)
    acceptedNda: Optional[bool] = False

    @field_validator("name")
    @classmethod
    def validate_name_input(cls, v: str) -> str:
        clean = v.strip()
        threat = detect_sql_injection(clean, "name")
        if threat:
            raise ValueError(f"Malicious input detected in name: {threat}")
        return clean

    @field_validator("email")
    @classmethod
    def validate_email_input(cls, v: str) -> str:
        clean = v.strip().lower()
        threat = detect_sql_injection(clean, "email")
        if threat:
            raise ValueError(f"Malicious input detected in email: {threat}")
        return clean

    @field_validator("password")
    @classmethod
    def validate_password_input(cls, v: str) -> str:
        if "\x00" in v:
            raise ValueError("Password contains prohibited null bytes.")
        return v

class VerifyEmailRequest(BaseModel):
    token: str = Field(..., max_length=512)

    @field_validator("token")
    @classmethod
    def validate_token(cls, v: str) -> str:
        if "\x00" in v:
            raise ValueError("Token contains prohibited null bytes.")
        return v.strip()

class ResendVerificationRequest(BaseModel):
    email: str = Field(..., max_length=255)

    @field_validator("email")
    @classmethod
    def validate_email_input(cls, v: str) -> str:
        clean = v.strip().lower()
        threat = detect_sql_injection(clean, "email")
        if threat:
            raise ValueError(f"Malicious input detected in email: {threat}")
        return clean

class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., max_length=255)

    @field_validator("email")
    @classmethod
    def validate_email_input(cls, v: str) -> str:
        clean = v.strip().lower()
        threat = detect_sql_injection(clean, "email")
        if threat:
            raise ValueError(f"Malicious input detected in email: {threat}")
        return clean

class ResetPasswordRequest(BaseModel):
    token: str = Field(..., max_length=512)
    password: Optional[str] = Field(None, max_length=128)
    newPassword: Optional[str] = Field(None, max_length=128)

    @field_validator("token")
    @classmethod
    def validate_token(cls, v: str) -> str:
        if "\x00" in v:
            raise ValueError("Token contains prohibited null bytes.")
        return v.strip()

    def get_password(self) -> str:
        return (self.password or self.newPassword or "").strip()

