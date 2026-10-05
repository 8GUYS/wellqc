"""
WellQC+ Domain Data Models.

Defines SQLAlchemy 2.0 ORM models representing the subsurface analytics schema:
- User: Multi-tenant user accounts with role-based access and subscription tiers.
- Field: Geological basin and field location grouping.
- Operator: E&P Operating companies.
- Well: Core well asset metadata (API/UWI, coordinates, total depth).
- LASFile: Uploaded CWLS LAS 2.0 log files with headers and depth ranges.
- Curve: Individual wireline/LWD log curves with standardized mnemonics and telemetry.
- QualityReport: Automated QA audit reports with numerical scores and petrophysical AI summaries.
- Anomaly: Detected log anomalies (flatlines, null gaps, spikes, noise, boundary violations).
- ActivityLog: Tenant activity and audit trail.
- CustomAlias: Tenant-isolated custom mnemonic dictionary aliases.
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy import (
    Column,
    String,
    Float,
    Integer,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    Index,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

def gen_uuid() -> str:
    """Generate a standard UUID4 string for primary keys."""
    return str(uuid.uuid4())

def now_utc() -> datetime:
    """Return timezone-aware current UTC datetime."""
    return datetime.now(timezone.utc)

class User(Base):
    """
    User Account Model.
    Represents an authenticated user with role-based permissions (ADMIN, PETROPHYSICIST, etc.)
    and freemium check usage tracking.
    """
    __tablename__ = "User"

    id = Column(String, primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    passwordHash = Column(String, nullable=False)
    role = Column(String, default="PETROPHYSICIST", nullable=False)
    department = Column(String, default="Subsurface Analytics", nullable=True)
    avatarUrl = Column(String, nullable=True)
    ndaAcceptedAt = Column(DateTime, nullable=True)

    tier = Column(String, default="FREE", nullable=False)
    freeChecksUsed = Column(Integer, default=0, nullable=False)
    stripeCustomerId = Column(String, unique=True, nullable=True)
    stripeSubscriptionId = Column(String, unique=True, nullable=True)

    createdAt = Column(DateTime, default=now_utc, nullable=False)
    updatedAt = Column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)

    wells = relationship("Well", back_populates="owner", foreign_keys="[Well.ownerId]")
    lasFiles = relationship("LASFile", back_populates="uploadedBy", foreign_keys="[LASFile.uploadedById]")
    activityLogs = relationship("ActivityLog", back_populates="user")
    apiTokens = relationship("APIToken", back_populates="user")


class Field(Base):
    __tablename__ = "Field"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, unique=True, nullable=False, index=True)
    basin = Column(String, nullable=False)
    country = Column(String, nullable=False)
    region = Column(String, nullable=True)
    createdAt = Column(DateTime, default=now_utc, nullable=False)

    wells = relationship("Well", back_populates="field")


class Operator(Base):
    __tablename__ = "Operator"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, unique=True, nullable=False, index=True)
    code = Column(String, nullable=True)
    contactEmail = Column(String, nullable=True)
    createdAt = Column(DateTime, default=now_utc, nullable=False)

    wells = relationship("Well", back_populates="operator")


class Well(Base):
    __tablename__ = "Well"

    id = Column(String, primary_key=True, default=gen_uuid)
    apiNo = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    operatorName = Column(String, ForeignKey("Operator.name"), nullable=False)
    fieldName = Column(String, ForeignKey("Field.name"), nullable=False)
    basin = Column(String, nullable=False)
    country = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    elevFt = Column(Float, default=0.0, nullable=False)
    tdFt = Column(Float, default=10000.0, nullable=False)
    depthUnit = Column(String, default="FT", nullable=False)
    status = Column(String, default="ACTIVE", nullable=False)
    qualityScore = Column(Integer, default=0, nullable=False)
    qualityGrade = Column(String, default="UNKNOWN", nullable=False)
    ownerId = Column(String, ForeignKey("User.id", ondelete="SET NULL"), nullable=True, index=True)

    createdAt = Column(DateTime, default=now_utc, nullable=False)
    updatedAt = Column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)

    owner = relationship("User", back_populates="wells", foreign_keys=[ownerId])
    field = relationship("Field", back_populates="wells")
    operator = relationship("Operator", back_populates="wells")
    lasFiles = relationship("LASFile", back_populates="well", cascade="all, delete-orphan")
    reports = relationship("QualityReport", back_populates="well", cascade="all, delete-orphan")


class LASFile(Base):
    __tablename__ = "LASFile"

    id = Column(String, primary_key=True, default=gen_uuid)
    wellId = Column(String, ForeignKey("Well.id", ondelete="CASCADE"), nullable=False, index=True)
    originalName = Column(String, nullable=False)
    fileSizeKb = Column(Float, nullable=False)
    lasVersion = Column(String, default="2.0", nullable=False)
    startDepth = Column(Float, nullable=False)
    stopDepth = Column(Float, nullable=False)
    stepDepth = Column(Float, nullable=False)
    nullValue = Column(Float, default=None, nullable=True)
    depthUnit = Column(String, default="FT", nullable=False)
    rawHeader = Column(Text, nullable=False)
    curveCount = Column(Integer, default=0, nullable=False)
    pointCount = Column(Integer, default=0, nullable=False)
    status = Column(String, default="PROCESSED", nullable=False)

    uploadedById = Column(String, ForeignKey("User.id", ondelete="SET NULL"), nullable=True)
    ownerId = Column(String, ForeignKey("User.id", ondelete="SET NULL"), nullable=True, index=True)

    createdAt = Column(DateTime, default=now_utc, nullable=False)

    well = relationship("Well", back_populates="lasFiles")
    uploadedBy = relationship("User", foreign_keys=[uploadedById], back_populates="lasFiles")
    curves = relationship("Curve", back_populates="lasFile", cascade="all, delete-orphan")
    reports = relationship("QualityReport", back_populates="lasFile", cascade="all, delete-orphan")


class Curve(Base):
    __tablename__ = "Curve"

    id = Column(String, primary_key=True, default=gen_uuid)
    lasFileId = Column(String, ForeignKey("LASFile.id", ondelete="CASCADE"), nullable=False, index=True)
    originalMnemonic = Column(String, nullable=False)
    standardMnemonic = Column(String, default="UNKNOWN", nullable=False)
    unit = Column(String, default="", nullable=False)
    description = Column(String, default="", nullable=False)
    nullCount = Column(Integer, default=0, nullable=False)
    totalPoints = Column(Integer, default=0, nullable=False)
    nullPercentage = Column(Float, default=0.0, nullable=False)
    confidence = Column(Float, default=1.0, nullable=False)
    minVal = Column(Float, nullable=True)
    maxVal = Column(Float, nullable=True)
    meanVal = Column(Float, nullable=True)
    status = Column(String, default="VALID", nullable=False)
    dataJson = Column(Text, default="[]", nullable=False)

    ownerId = Column(String, ForeignKey("User.id", ondelete="SET NULL"), nullable=True, index=True)
    createdAt = Column(DateTime, default=now_utc, nullable=False)

    lasFile = relationship("LASFile", back_populates="curves")
    anomalies = relationship("Anomaly", back_populates="curve")


class QualityReport(Base):
    __tablename__ = "QualityReport"

    id = Column(String, primary_key=True, default=gen_uuid)
    wellId = Column(String, ForeignKey("Well.id", ondelete="CASCADE"), nullable=False, index=True)
    lasFileId = Column(String, ForeignKey("LASFile.id", ondelete="CASCADE"), nullable=False, index=True)

    overallScore = Column(Integer, default=0, nullable=False)
    qualityGrade = Column(String, default="UNKNOWN", nullable=False)
    completenessScore = Column(Integer, default=0, nullable=False)
    consistencyScore = Column(Integer, default=0, nullable=False)
    anomalyCount = Column(Integer, default=0, nullable=False)

    aiSummary = Column(Text, default="", nullable=False)
    recommendations = Column(Text, default="", nullable=False)
    reportJson = Column(Text, default="{}", nullable=False)

    ownerId = Column(String, ForeignKey("User.id", ondelete="SET NULL"), nullable=True, index=True)
    createdAt = Column(DateTime, default=now_utc, nullable=False)

    well = relationship("Well", back_populates="reports")
    lasFile = relationship("LASFile", back_populates="reports")
    anomalies = relationship("Anomaly", back_populates="qualityReport", cascade="all, delete-orphan")


class Anomaly(Base):
    __tablename__ = "Anomaly"

    id = Column(String, primary_key=True, default=gen_uuid)
    qualityReportId = Column(String, ForeignKey("QualityReport.id", ondelete="CASCADE"), nullable=False, index=True)
    curveId = Column(String, ForeignKey("Curve.id", ondelete="SET NULL"), nullable=True)
    curveMnemonic = Column(String, nullable=False)
    depthStart = Column(Float, nullable=False)
    depthEnd = Column(Float, nullable=False)
    anomalyType = Column(String, nullable=False)
    severity = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    suggestedCorrection = Column(Text, nullable=False)
    status = Column(String, default="OPEN", nullable=False)

    ownerId = Column(String, ForeignKey("User.id", ondelete="SET NULL"), nullable=True, index=True)
    createdAt = Column(DateTime, default=now_utc, nullable=False)

    qualityReport = relationship("QualityReport", back_populates="anomalies")
    curve = relationship("Curve", back_populates="anomalies")


class ActivityLog(Base):
    __tablename__ = "ActivityLog"

    id = Column(String, primary_key=True, default=gen_uuid)
    userId = Column(String, ForeignKey("User.id", ondelete="SET NULL"), nullable=True)
    userName = Column(String, default="System Agent", nullable=False)
    userRole = Column(String, default="PETROPHYSICIST", nullable=False)
    action = Column(String, nullable=False)
    targetType = Column(String, nullable=True)
    targetId = Column(String, nullable=True)
    details = Column(Text, nullable=False)
    ipAddress = Column(String, default="127.0.0.1", nullable=False)
    createdAt = Column(DateTime, default=now_utc, nullable=False)

    user = relationship("User", back_populates="activityLogs")


class APIToken(Base):
    __tablename__ = "APIToken"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    token = Column(String, unique=True, nullable=False, index=True)
    userId = Column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    lastUsedAt = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, default=now_utc, nullable=False)

    user = relationship("User", back_populates="apiTokens")


class Webhook(Base):
    __tablename__ = "Webhook"

    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    url = Column(String, nullable=False)
    secret = Column(String, nullable=False)
    events = Column(Text, nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    createdAt = Column(DateTime, default=now_utc, nullable=False)


class CustomAlias(Base):
    __tablename__ = "CustomAlias"

    id = Column(String, primary_key=True, default=gen_uuid)
    alias = Column(String, nullable=False)
    standardMnemonic = Column(String, nullable=False)
    addedBy = Column(String, nullable=False)
    addedAt = Column(DateTime, default=now_utc, nullable=False)
    userId = Column(String, nullable=True, index=True)
    userEmail = Column(String, nullable=True, index=True)

    createdAt = Column(DateTime, default=now_utc, nullable=False)
    updatedAt = Column(DateTime, default=now_utc, onupdate=now_utc, nullable=False)

    __table_args__ = (
        UniqueConstraint("standardMnemonic", "alias", "userId", name="CustomAlias_standardMnemonic_alias_userId_key"),
    )
