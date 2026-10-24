from pydantic import BaseModel, Field, field_validator
from typing import Optional
from backend.app.core.security import detect_sql_injection, validate_safe_identifier

class AliasCreateRequest(BaseModel):
    standardMnemonic: str = Field(..., max_length=40)
    alias: str = Field(..., max_length=40)
    addedBy: Optional[str] = Field(None, max_length=100)

    @field_validator("standardMnemonic", "alias")
    @classmethod
    def validate_mnemonic(cls, v: str) -> str:
        threat = detect_sql_injection(v, "alias_field")
        if threat:
            raise ValueError(f"Malicious input detected: {threat}")
        return validate_safe_identifier(v, "Mnemonic", max_len=40)

class AliasUpdateRequest(BaseModel):
    standardMnemonic: str = Field(..., max_length=40)
    oldAlias: str = Field(..., max_length=40)
    newAlias: str = Field(..., max_length=40)

    @field_validator("standardMnemonic", "oldAlias", "newAlias")
    @classmethod
    def validate_mnemonic(cls, v: str) -> str:
        threat = detect_sql_injection(v, "alias_field")
        if threat:
            raise ValueError(f"Malicious input detected: {threat}")
        return validate_safe_identifier(v, "Mnemonic", max_len=40)

class AliasDeleteRequest(BaseModel):
    standardMnemonic: Optional[str] = Field(None, max_length=40)
    alias: Optional[str] = Field(None, max_length=40)

    @field_validator("standardMnemonic", "alias")
    @classmethod
    def validate_mnemonic(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        threat = detect_sql_injection(v, "alias_field")
        if threat:
            raise ValueError(f"Malicious input detected: {threat}")
        return validate_safe_identifier(v, "Mnemonic", max_len=40)
