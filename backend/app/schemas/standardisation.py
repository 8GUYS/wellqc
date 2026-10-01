from pydantic import BaseModel
from typing import Optional, List

class AliasCreateRequest(BaseModel):
    standardMnemonic: str
    alias: str
    addedBy: Optional[str] = None

class AliasUpdateRequest(BaseModel):
    standardMnemonic: str
    oldAlias: str
    newAlias: str

class AliasDeleteRequest(BaseModel):
    standardMnemonic: Optional[str] = None
    alias: Optional[str] = None
