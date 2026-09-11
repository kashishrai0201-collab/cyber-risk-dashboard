"""
models.py
---------
SQLAlchemy 2.0 declarative ORM models for the CRQ platform.

Tables
------
Asset            : enterprise asset inventory (hosts, gateways, databases...)
Vulnerability    : CVEs discovered on a given asset (many-to-one -> Asset)
SecurityControl  : catalogue of candidate security investments
SimulationRun    : historical audit log of every Monte Carlo / optimizer run
NetworkEdge      : attack graph topology edges persisting lateral movement paths
DataLineageFlow  : transitive data flows across nodes tracking provenance and leaks
"""

from __future__ import annotations

import datetime as dt
import json
from typing import Any, Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from database import Base


def _utcnow() -> dt.datetime:
    """Returns current UTC timestamp with timezone awareness."""
    return dt.datetime.now(dt.timezone.utc)


class SafeJSONB(TypeDecorator):
    """
    PostgreSQL native JSONB column type with transparent Python serialization.

    Accepts either Python objects (dicts, lists) or JSON strings on write,
    and returns a valid JSON string on read for compatibility with Pydantic
    schemas and REST consumers while storing native JSONB in PostgreSQL.
    """

    impl = JSONB
    cache_ok = True

    def load_dialect_impl(self, dialect: Any) -> Any:
        if dialect.name == "postgresql":
            return dialect.type_descriptor(JSONB())
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        if dialect.name == "postgresql":
            if isinstance(value, str):
                try:
                    return json.loads(value)
                except (ValueError, TypeError):
                    return value
            return value
        else:
            if not isinstance(value, str):
                return json.dumps(value)
            return value

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, (dict, list)):
            return json.dumps(value)
        return str(value)


class Asset(Base):
    """An enterprise IT/OT asset that carries business and cyber risk."""

    __tablename__ = "assets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hostname: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)

    # e.g. 'Core Banking Switch', 'UPI Gateway', 'Customer DB', 'Internal ERP',
    #      'Staff Portal', 'Office POS'
    asset_type: Mapped[str] = mapped_column(String(64), nullable=False)

    # 'Critical' | 'Medium' | 'Low'
    tier: Mapped[str] = mapped_column(String(16), nullable=False, index=True)

    business_unit: Mapped[str] = mapped_column(String(64), nullable=False)

    # Revenue lost per minute of downtime, in INR (₹).
    revenue_per_minute: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    pii_records_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    financial_records_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    is_rbi_regulated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_sebi_regulated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Graph-topology hint: number of network hops from public internet edge
    network_hops_from_internet: Mapped[int] = mapped_column(Integer, nullable=False, default=3)

    # Classification taxonomy: 'Core IT', 'AI/ML Model Pipeline', 'Third-Party SaaS',
    # 'Third-Party Vendor API', 'Cloud Infrastructure', 'Data Repository'
    classification_type: Mapped[str] = mapped_column(String(64), default="Internal IT", nullable=False)

    # ISO compliance applicability flags
    is_iso27001_regulated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_iso42001_regulated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Third-party vendor risk fields
    is_third_party: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    vendor_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    vendor_risk_tier: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)  # 'Tier-1 Critical', 'Tier-2 High', 'Tier-3 Standard'
    soc2_attestation: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Data residency and cross-border transfer mechanics
    data_residency_country: Mapped[str] = mapped_column(String(8), default="IN", nullable=False)
    cross_border_transfer_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    destination_countries: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    transfer_legal_mechanism: Mapped[Optional[str]] = mapped_column(String(64), default="None", nullable=True)
    is_rbi_localization_compliant: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    vulnerabilities: Mapped[list[Vulnerability]] = relationship(
        "Vulnerability",
        back_populates="asset",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Asset id={self.id} hostname={self.hostname!r} tier={self.tier}>"


class Vulnerability(Base):
    """A single CVE observed on a given asset."""

    __tablename__ = "vulnerabilities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    asset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True
    )

    cve_id: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    cvss_score: Mapped[float] = mapped_column(Float, nullable=False)  # 0.0 - 10.0
    epss_score: Mapped[float] = mapped_column(Float, nullable=False)  # 0.0 - 1.0
    cisa_kev: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    patch_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_patched: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    asset: Mapped[Asset] = relationship("Asset", back_populates="vulnerabilities")

    def __repr__(self) -> str:
        return f"<Vulnerability {self.cve_id} asset_id={self.asset_id} cvss={self.cvss_score}>"


class SecurityControl(Base):
    """A candidate security investment considered by the budget optimizer."""

    __tablename__ = "security_controls"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(128), nullable=False)

    # 'All' | 'Critical' | 'Medium'
    target_tier: Mapped[str] = mapped_column(String(16), nullable=False, default="All", index=True)

    cost_inr: Mapped[float] = mapped_column(Float, nullable=False)
    likelihood_reduction: Mapped[float] = mapped_column(Float, nullable=False)  # 0.0 - 1.0
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    def __repr__(self) -> str:
        return f"<SecurityControl {self.code} cost={self.cost_inr} reduction={self.likelihood_reduction}>"


class SimulationRun(Base):
    """Historical audit record of an enterprise risk quantification run."""

    __tablename__ = "simulation_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[dt.datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False, index=True
    )

    total_eal_inr: Mapped[float] = mapped_column(Float, nullable=False)
    var_95_inr: Mapped[float] = mapped_column(Float, nullable=False)
    var_99_inr: Mapped[float] = mapped_column(Float, nullable=False)

    allocated_budget_inr: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    selected_controls_json: Mapped[Optional[str]] = mapped_column(SafeJSONB, nullable=True)

    def __repr__(self) -> str:
        return f"<SimulationRun id={self.id} EAL={self.total_eal_inr:.2f} @ {self.timestamp}>"


class NetworkEdge(Base):
    """
    Topology edge representing a network route or lateral attack vector
    between infrastructure nodes (e.g. perimeter gateway, switch, host).
    """

    __tablename__ = "network_edges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_node: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    target_node: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    weight: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    protocol: Mapped[str] = mapped_column(String(32), nullable=False, default="HTTPS")
    is_segmented: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Consent and delegation flags for data provenance & lineage
    is_authorized_flow: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    consent_recorded: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    flow_type: Mapped[str] = mapped_column(String(64), default="Direct API", nullable=False)  # 'Direct API', 'Sub-Processor Delegation', 'Background Sync', 'Unauthorized Pivot'
    data_tags: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)  # e.g. "Asset-A:PII,Asset-A:FINANCIAL"

    __table_args__ = (
        Index("ix_network_edges_source_target", "source_node", "target_node"),
    )

    def __repr__(self) -> str:
        return (
            f"<NetworkEdge id={self.id} {self.source_node} -> {self.target_node} "
            f"weight={self.weight} proto={self.protocol} segmented={self.is_segmented} "
            f"auth={self.is_authorized_flow} consent={self.consent_recorded}>"
        )


class DataLineageFlow(Base):
    """
    Represents transitive data flows across nodes (A -> B -> C), tracking
    originating asset provenance, consent, and potential unauthorized sub-processing.
    """

    __tablename__ = "data_lineage_flows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    origin_asset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    intermediary_asset_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=True, index=True
    )
    destination_asset_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False, index=True
    )

    is_authorized: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    has_user_consent: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    records_exposed_pii: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_exposed_financial: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    detection_status: Mapped[str] = mapped_column(
        String(32), default="Legitimate Flow", nullable=False
    )  # 'Legitimate Flow', 'Unauthorized Sub-Processing', 'Shadow Exfiltration Vector'

    origin_asset: Mapped[Asset] = relationship("Asset", foreign_keys=[origin_asset_id])
    intermediary_asset: Mapped[Optional[Asset]] = relationship("Asset", foreign_keys=[intermediary_asset_id])
    destination_asset: Mapped[Asset] = relationship("Asset", foreign_keys=[destination_asset_id])

    def __repr__(self) -> str:
        return (
            f"<DataLineageFlow id={self.id} origin={self.origin_asset_id} -> "
            f"inter={self.intermediary_asset_id} -> dest={self.destination_asset_id} "
            f"status='{self.detection_status}'>"
        )

