"""
schemas.py
----------
Pydantic v2 request/response DTOs for the CRQ platform's FastAPI layer.

Kept deliberately strict (extra fields forbidden on *Create schemas) so that
CSE-core reviewers can see clean input validation independent of the ORM.
"""

from __future__ import annotations

import datetime as dt
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# --------------------------------------------------------------------------- #
# Vulnerability
# --------------------------------------------------------------------------- #
class VulnerabilityCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cve_id: str = Field(..., examples=["CVE-2024-21413"])
    cvss_score: float = Field(..., ge=0.0, le=10.0)
    epss_score: float = Field(..., ge=0.0, le=1.0)
    cisa_kev: bool = False
    patch_available: bool = True
    is_patched: bool = False


class VulnerabilityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    asset_id: int
    cve_id: str
    cvss_score: float
    epss_score: float
    cisa_kev: bool
    patch_available: bool
    is_patched: bool


# --------------------------------------------------------------------------- #
# Asset
# --------------------------------------------------------------------------- #
class AssetCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    hostname: str
    asset_type: str
    tier: str = Field(..., pattern="^(Critical|Medium|Low)$")
    business_unit: str
    revenue_per_minute: float = Field(..., ge=0.0)
    pii_records_count: int = Field(0, ge=0)
    financial_records_count: int = Field(0, ge=0)
    is_rbi_regulated: bool = False
    is_sebi_regulated: bool = False
    network_hops_from_internet: int = Field(3, ge=1, le=10)
    classification_type: str = "Internal IT"
    is_iso27001_regulated: bool = True
    is_iso42001_regulated: bool = False
    is_third_party: bool = False
    vendor_name: Optional[str] = None
    vendor_risk_tier: Optional[str] = None
    soc2_attestation: bool = False
    data_residency_country: str = Field("IN", max_length=8)
    cross_border_transfer_enabled: bool = False
    destination_countries: Optional[str] = None
    transfer_legal_mechanism: Optional[str] = "None"
    is_rbi_localization_compliant: bool = True
    vulnerabilities: list[VulnerabilityCreate] = Field(default_factory=list)


class AssetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    hostname: str
    asset_type: str
    tier: str
    business_unit: str
    revenue_per_minute: float
    pii_records_count: int
    financial_records_count: int
    is_rbi_regulated: bool
    is_sebi_regulated: bool
    network_hops_from_internet: int
    classification_type: str
    is_iso27001_regulated: bool
    is_iso42001_regulated: bool
    is_third_party: bool
    vendor_name: Optional[str] = None
    vendor_risk_tier: Optional[str] = None
    soc2_attestation: bool
    data_residency_country: str = "IN"
    cross_border_transfer_enabled: bool = False
    destination_countries: Optional[str] = None
    transfer_legal_mechanism: Optional[str] = "None"
    is_rbi_localization_compliant: bool = True
    vulnerabilities: list[VulnerabilityRead] = Field(default_factory=list)

    # Populated by the API layer at read-time (not a DB column); represents
    # this individual asset's most recent estimated Expected Annual Loss.
    estimated_eal_inr: Optional[float] = None


# --------------------------------------------------------------------------- #
# Security Control
# --------------------------------------------------------------------------- #
class SecurityControlRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    target_tier: str
    cost_inr: float
    likelihood_reduction: float
    is_active: bool


class ControlRecommendation(BaseModel):
    """A single control chosen by the MILP optimizer, with its marginal impact."""

    model_config = ConfigDict(from_attributes=True)

    code: str
    name: str
    cost_inr: float
    likelihood_reduction: float
    target_tier: str
    marginal_eal_reduction_inr: float = Field(
        ..., description="This control's discounted contribution to total ΔEAL, in ₹."
    )


# --------------------------------------------------------------------------- #
# Budget Optimization
# --------------------------------------------------------------------------- #
class BudgetOptimizationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    budget_inr: float = Field(..., gt=0, examples=[5_000_000.0])


class OptimizationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    budget_inr: float
    selected_controls: list[ControlRecommendation]
    total_spent_inr: float
    remaining_budget_inr: float
    baseline_eal_inr: float
    projected_eal_inr: float
    net_risk_reduction_inr: float
    rosi_percent: float = Field(..., description="Return on Security Investment, in %.")


# --------------------------------------------------------------------------- #
# Data Lineage & Provenance
# --------------------------------------------------------------------------- #
class DataLineageFlowRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    origin_hostname: str
    intermediary_hostname: Optional[str] = None
    destination_hostname: str
    is_authorized: bool
    has_user_consent: bool
    records_exposed_pii: int
    records_exposed_financial: int
    detection_status: str
    leak_root_cause_identified: bool = False


class NetworkEdgeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_node: str
    target_node: str
    weight: float
    protocol: str
    is_segmented: bool
    is_authorized_flow: bool = True
    consent_recorded: bool = True
    flow_type: str = "Direct API"
    data_tags: Optional[str] = None


# --------------------------------------------------------------------------- #
# Enterprise Risk Summary
# --------------------------------------------------------------------------- #
class AssetRiskContribution(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    asset_id: int
    hostname: str
    tier: str
    asset_type: str
    eal_inr: float
    annual_event_frequency: float


class LossExceedancePoint(BaseModel):
    return_period_years: int
    loss_inr: float


class EnterpriseRiskSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_eal_inr: float
    var_95_inr: float
    var_99_inr: float
    top_5_riskiest_assets: list[AssetRiskContribution]
    total_regulatory_fine_exposure_inr: float
    loss_exceedance_curve: list[LossExceedancePoint]
    simulation_iterations: int
    generated_at: dt.datetime
    unauthorized_subprocessor_count: int = 0
    shadow_leakage_exposure_inr: float = 0.0
    identified_leak_vectors: list[DataLineageFlowRead] = Field(default_factory=list)



# --------------------------------------------------------------------------- #
# Compliance
# --------------------------------------------------------------------------- #
class ComplianceGap(BaseModel):
    framework: str
    category: str
    description: str
    recommended_control_codes: list[str] = Field(default_factory=list)


class FrameworkComplianceReport(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rbi_compliance_index_percent: float
    sebi_compliance_index_percent: float
    nist_csf_compliance_index_percent: float
    iso27001_compliance_index_percent: float
    iso42001_compliance_index_percent: float
    cross_border_compliance_index_percent: float = 100.0
    rbi_localization_status: str = "Compliant"
    overall_compliance_index_percent: float
    gaps: list[ComplianceGap]
    estimated_regulatory_penalty_exposure_inr: float


# --------------------------------------------------------------------------- #
# Simulation history
# --------------------------------------------------------------------------- #
class SimulationRunRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: dt.datetime
    total_eal_inr: float
    var_95_inr: float
    var_99_inr: float
    allocated_budget_inr: Optional[float]
    selected_controls_json: Optional[str]
