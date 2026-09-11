"""
compliance.py
-------------
Framework Compliance Mapper.

Evaluates the current security-control posture (which `SecurityControl`
rows are active) and vulnerability remediation status against three
frameworks relevant to Indian financial-sector cyber risk:

  - RBI Cyber Security Framework (customer data protection, network
    segregation, cyber crisis management)
  - SEBI CSCRF (incident reporting readiness, privileged access management)
  - NIST CSF 2.0 (Govern, Identify, Protect, Detect, Respond, Recover)

Each framework category maps to a set of required `SecurityControl` codes.
A category is considered "met" in proportion to how many of its required
controls are currently active; the framework's overall index is the mean
of its category scores. Unmet categories are surfaced as `ComplianceGap`
entries naming the specific controls needed to close the gap.
"""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from models import Asset, SecurityControl
from quant_engine import MonteCarloRiskEngine
from schemas import ComplianceGap, FrameworkComplianceReport

# --------------------------------------------------------------------------- #
# Framework -> category -> required control codes
# --------------------------------------------------------------------------- #
RBI_CSF_CATEGORIES: dict[str, list[str]] = {
    "Customer Data Protection": ["CTRL_DLP", "CTRL_PAM"],
    "Network Segregation": ["CTRL_MICROSEG", "CTRL_ZERO_TRUST"],
    "Cyber Crisis Management & Recovery": ["CTRL_INCIDENT_RESPONSE", "CTRL_BACKUP_IMMUTABLE"],
}

SEBI_CSCRF_CATEGORIES: dict[str, list[str]] = {
    "Incident Reporting Readiness": ["CTRL_SIEM_SOAR", "CTRL_INCIDENT_RESPONSE"],
    "Privileged Access Management": ["CTRL_PAM", "CTRL_MFA"],
}

NIST_CSF_CATEGORIES: dict[str, list[str]] = {
    "Govern": ["CTRL_SECURITY_TRAINING"],
    "Identify": ["CTRL_VULN_MGMT"],
    "Protect": ["CTRL_MFA", "CTRL_EDR_HARDEN", "CTRL_PATCH_AUTOMATION", "CTRL_ZERO_TRUST"],
    "Detect": ["CTRL_SIEM_SOAR"],
    "Respond": ["CTRL_INCIDENT_RESPONSE"],
    "Recover": ["CTRL_BACKUP_IMMUTABLE"],
}

ISO_27001_CATEGORIES: dict[str, list[str]] = {
    "A.5 Organizational Controls / TPRM": ["CTRL_TPRM_ASSESSMENT", "CTRL_INCIDENT_RESPONSE"],
    "A.8 Technological Controls": ["CTRL_MFA", "CTRL_EDR_HARDEN", "CTRL_PATCH_AUTOMATION", "CTRL_WAF"],
    "A.8.12 Data Leakage Prevention": ["CTRL_DLP", "CTRL_DATA_CLASSIFICATION"],
    "A.8.20 Network Security & Segregation": ["CTRL_MICROSEG", "CTRL_ZERO_TRUST"],
}

ISO_42001_CATEGORIES: dict[str, list[str]] = {
    "AI Risk Assessment & Treatment": ["CTRL_AI_GOVERNANCE", "CTRL_VULN_MGMT"],
    "Data Quality & Privacy for AI Systems": ["CTRL_DLP", "CTRL_DATA_CLASSIFICATION"],
    "Third-Party AI & Supply Chain Vulnerabilities": ["CTRL_SUPPLY_CHAIN_SEC", "CTRL_TPRM_ASSESSMENT"],
    "Monitoring & Logging for AI Workloads": ["CTRL_SIEM_SOAR"],
}

FRAMEWORK_DEFINITIONS: dict[str, dict[str, list[str]]] = {
    "RBI CSF": RBI_CSF_CATEGORIES,
    "SEBI CSCRF": SEBI_CSCRF_CATEGORIES,
    "NIST CSF 2.0": NIST_CSF_CATEGORIES,
    "ISO 27001:2022": ISO_27001_CATEGORIES,
    "ISO 42001:2023": ISO_42001_CATEGORIES,
}


@dataclass
class _FrameworkScore:
    index_percent: float
    gaps: list[ComplianceGap]


def _score_framework(
    framework_name: str,
    categories: dict[str, list[str]],
    active_control_codes: set[str],
) -> _FrameworkScore:
    """Scores a single framework as the mean of its category coverage ratios."""
    category_scores: list[float] = []
    gaps: list[ComplianceGap] = []

    for category_name, required_codes in categories.items():
        met_codes = [code for code in required_codes if code in active_control_codes]
        missing_codes = [code for code in required_codes if code not in active_control_codes]

        coverage_ratio = len(met_codes) / len(required_codes) if required_codes else 1.0
        category_scores.append(coverage_ratio)

        if missing_codes:
            gaps.append(
                ComplianceGap(
                    framework=framework_name,
                    category=category_name,
                    description=(
                        f"{category_name} is only {coverage_ratio * 100:.0f}% covered. "
                        f"Missing control(s): {', '.join(missing_codes)}."
                    ),
                    recommended_control_codes=missing_codes,
                )
            )

    index_percent = (sum(category_scores) / len(category_scores) * 100.0) if category_scores else 100.0
    return _FrameworkScore(index_percent=index_percent, gaps=gaps)


def audit_cross_border_compliance(
    assets: list[Asset], active_control_codes: set[str]
) -> tuple[float, str, list[ComplianceGap]]:
    """
    Audits cross-border data transfer compliance and data residency:
      1. RBI Payment Data Localization Directive (April 2018):
         Storage and end-to-end transaction processing of payment system data
         must reside strictly within India ('IN').
      2. DPDPA 2023 Section 16 (Cross-Border Transfer Restrictions):
         Personal data transfers outside India require approved legal transfer safeguards
         (SCC, BCR, Adequacy Decision, or Explicit Consent).
      3. Vendor/Third-Party Cross-Border Transfer:
         Foreign third-party vendor assets require active automated transfer tracking
         and safeguards (CTRL_CROSS_BORDER_GOVERNANCE).

    Returns:
      (cross_border_compliance_index_percent, rbi_localization_status, cross_border_gaps)
    """
    cross_border_gaps: list[ComplianceGap] = []
    rbi_non_compliant_count = 0

    cross_border_assets = [
        a for a in assets
        if getattr(a, "cross_border_transfer_enabled", False)
        or getattr(a, "data_residency_country", "IN") != "IN"
    ]

    violating_asset_ids: set[int] = set()

    for a in assets:
        is_rbi_reg = getattr(a, "is_rbi_regulated", False)
        fin_count = getattr(a, "financial_records_count", 0)
        pii_count = getattr(a, "pii_records_count", 0)
        residency = getattr(a, "data_residency_country", "IN")
        cb_enabled = getattr(a, "cross_border_transfer_enabled", False)
        dest_countries = getattr(a, "destination_countries", None) or "None"
        legal_mech = getattr(a, "transfer_legal_mechanism", "None") or "None"
        is_rbi_loc_compliant = getattr(a, "is_rbi_localization_compliant", True)
        is_tp = getattr(a, "is_third_party", False)

        # Rule 1: RBI Payment Data Localization Mandate
        rbi_violation = False
        if is_rbi_reg and fin_count > 0 and residency != "IN":
            rbi_violation = True
        if cb_enabled and not is_rbi_loc_compliant:
            rbi_violation = True
        if is_rbi_reg and not is_rbi_loc_compliant:
            rbi_violation = True

        if rbi_violation:
            rbi_non_compliant_count += 1
            violating_asset_ids.add(a.id)
            cross_border_gaps.append(
                ComplianceGap(
                    framework="RBI Data Localization Directive",
                    category="Payment Data Localization Violation",
                    description=(
                        f"Critical statutory violation on asset '{a.hostname}': RBI-regulated payment system data "
                        f"({fin_count:,} financial records) has jurisdiction '{residency}' / transfer enabled without "
                        f"strict domestic storage. Violates RBI Directive on Storage of Payment System Data (April 2018)."
                    ),
                    recommended_control_codes=["CTRL_DATA_RESIDENCY_ENCLAVE", "CTRL_MICROSEG"],
                )
            )

        # Rule 2: DPDPA 2023 Section 16 (Cross-Border Transfer Restrictions)
        if cb_enabled and pii_count > 0 and legal_mech in (None, "None"):
            violating_asset_ids.add(a.id)
            cross_border_gaps.append(
                ComplianceGap(
                    framework="DPDPA 2023",
                    category="Section 16 Cross-Border Transfer Restrictions",
                    description=(
                        f"Statutory transfer gap on asset '{a.hostname}': {pii_count:,} personal data (PII) records "
                        f"are transferred to destination '{dest_countries}' with unapproved transfer mechanism "
                        f"('{legal_mech}'). Statutory safeguards required under DPDPA 2023 Section 16."
                    ),
                    recommended_control_codes=["CTRL_CROSS_BORDER_GOVERNANCE"],
                )
            )

        # Rule 3: Vendor/Third-Party Cross-Border Transfer
        if is_tp and residency != "IN" and "CTRL_CROSS_BORDER_GOVERNANCE" not in active_control_codes:
            violating_asset_ids.add(a.id)
            cross_border_gaps.append(
                ComplianceGap(
                    framework="Third-Party Risk Management (TPRM)",
                    category="Offshore Vendor Governance & Transfer Safeguards",
                    description=(
                        f"Offshore vendor asset '{a.hostname}' ({getattr(a, 'vendor_name', None) or a.asset_type}) "
                        f"operates under foreign jurisdiction '{residency}' without active automated cross-border transfer tracking "
                        f"and legal transfer safeguards."
                    ),
                    recommended_control_codes=["CTRL_CROSS_BORDER_GOVERNANCE", "CTRL_TPRM_ASSESSMENT"],
                )
            )

    # Ratio of compliant cross-border flows vs total cross-border flows
    if cross_border_assets:
        compliant_flows = len(cross_border_assets) - len([a for a in cross_border_assets if a.id in violating_asset_ids])
        cross_border_index = max(0.0, min(100.0, (compliant_flows / len(cross_border_assets)) * 100.0))
    else:
        cross_border_index = 100.0

    rbi_localization_status = "Non-Compliant" if rbi_non_compliant_count > 0 else "Compliant"

    return cross_border_index, rbi_localization_status, cross_border_gaps


def audit_data_lineage_compliance(
    db: Session, active_control_codes: set[str]
) -> list[ComplianceGap]:
    """
    Audits data provenance lineage and sub-processor delegation under
    DPDPA 2023 Section 8(4) and ISO 27001:2022 Clause A.5.

    Flags statutory non-compliance if unauthorized/unconsented data propagation
    flows exist without active lineage tracing and zero-trust consent verifiers.
    """
    gaps: list[ComplianceGap] = []
    has_tracer = "CTRL_DATA_LINEAGE_TRACER" in active_control_codes
    has_consent_verifier = "CTRL_CONSENT_ENFORCEMENT" in active_control_codes

    try:
        from models import DataLineageFlow, NetworkEdge
        unauthorized_flows = (
            db.query(DataLineageFlow)
            .filter((DataLineageFlow.is_authorized.is_(False)) | (DataLineageFlow.has_user_consent.is_(False)))
            .all()
        )
        unauthorized_edges = (
            db.query(NetworkEdge)
            .filter((NetworkEdge.is_authorized_flow.is_(False)) | (NetworkEdge.consent_recorded.is_(False)))
            .all()
        )
    except Exception:
        unauthorized_flows = []
        unauthorized_edges = []

    if (unauthorized_flows or unauthorized_edges) and not has_tracer:
        count = len(unauthorized_flows) or len(unauthorized_edges)
        gaps.append(
            ComplianceGap(
                framework="DPDPA 2023",
                category="Section 8(4) Sub-Processor Governance & Oversight",
                description=(
                    f"Statutory compliance gap under DPDPA Section 8(4): {count} indirect/unauthorized data propagation "
                    f"vector(s) detected without active automated data provenance tracer. "
                    f"Data Fiduciaries must maintain continuous audit oversight over downstream data processors and sub-processors."
                ),
                recommended_control_codes=["CTRL_DATA_LINEAGE_TRACER", "CTRL_CONSENT_ENFORCEMENT"],
            )
        )

    if (unauthorized_flows or unauthorized_edges) and not has_consent_verifier:
        gaps.append(
            ComplianceGap(
                framework="ISO 27001:2022",
                category="Clause A.5 / Sub-Processor Consent & Delegation Governance",
                description=(
                    "Unauthorized data transfer pivots identified across intermediary boundaries without continuous zero-trust "
                    "consent validation or sub-processor delegation verification. Violates ISO 27001 Clause A.5 and RBI third-party guidelines."
                ),
                recommended_control_codes=["CTRL_CONSENT_ENFORCEMENT", "CTRL_EGRESS_DLP"],
            )
        )

    return gaps


def generate_compliance_report(db: Session) -> FrameworkComplianceReport:
    """
    Builds the full `FrameworkComplianceReport` by:
      1. Reading currently active `SecurityControl` rows from the database.
      2. Scoring each of RBI CSF, SEBI CSCRF, NIST CSF 2.0, ISO 27001:2022,
         and ISO 42001:2023 against them.
      3. Auditing statutory cross-border transfers & data residency compliance.
      4. Auditing data provenance lineage and unauthorized sub-processors.
      5. Estimating regulatory penalty exposure via a Monte Carlo run using
         the current (already-active) control posture.
    """
    active_controls: list[SecurityControl] = (
        db.query(SecurityControl).filter(SecurityControl.is_active.is_(True)).all()
    )
    active_control_codes = {c.code for c in active_controls}

    rbi_score = _score_framework("RBI CSF", RBI_CSF_CATEGORIES, active_control_codes)
    sebi_score = _score_framework("SEBI CSCRF", SEBI_CSCRF_CATEGORIES, active_control_codes)
    nist_score = _score_framework("NIST CSF 2.0", NIST_CSF_CATEGORIES, active_control_codes)
    iso27001_score = _score_framework("ISO 27001:2022", ISO_27001_CATEGORIES, active_control_codes)
    iso42001_score = _score_framework("ISO 42001:2023", ISO_42001_CATEGORIES, active_control_codes)

    assets: list[Asset] = db.query(Asset).all()

    cb_index, rbi_status, cb_gaps = audit_cross_border_compliance(assets, active_control_codes)
    lineage_gaps = audit_data_lineage_compliance(db, active_control_codes)

    overall_index = (
        rbi_score.index_percent
        + sebi_score.index_percent
        + nist_score.index_percent
        + iso27001_score.index_percent
        + iso42001_score.index_percent
    ) / 5.0

    all_gaps = (
        rbi_score.gaps
        + sebi_score.gaps
        + nist_score.gaps
        + iso27001_score.gaps
        + iso42001_score.gaps
        + cb_gaps
        + lineage_gaps
    )

    penalty_exposure = 0.0
    if assets:
        engine = MonteCarloRiskEngine(assets=assets, active_controls=active_controls)
        result = engine.run()
        penalty_exposure = result.total_regulatory_fine_exposure_inr

    return FrameworkComplianceReport(
        rbi_compliance_index_percent=round(rbi_score.index_percent, 2),
        sebi_compliance_index_percent=round(sebi_score.index_percent, 2),
        nist_csf_compliance_index_percent=round(nist_score.index_percent, 2),
        iso27001_compliance_index_percent=round(iso27001_score.index_percent, 2),
        iso42001_compliance_index_percent=round(iso42001_score.index_percent, 2),
        cross_border_compliance_index_percent=round(cb_index, 2),
        rbi_localization_status=rbi_status,
        overall_compliance_index_percent=round(overall_index, 2),
        gaps=all_gaps,
        estimated_regulatory_penalty_exposure_inr=penalty_exposure,
    )
