"""
seeder.py
---------
Synthetic telemetry generator for the CRQ platform.

Seeds a realistic enterprise inventory:
    - 18 assets across Critical / Medium / Low tiers spanning core banking,
      payments, customer data, and back-office systems.
    - 30+ CVEs (with realistic CVSS 3.1 and EPSS distributions, including
      several CISA KEV-listed vulnerabilities) distributed across assets.
    - A candidate security control catalogue with realistic INR pricing.

`seed_database` is idempotent: re-running it against an already-seeded
database is a safe no-op (it checks for existing rows before inserting).
"""

from __future__ import annotations

import random
from typing import Any

from sqlalchemy.orm import Session

from models import Asset, DataLineageFlow, NetworkEdge, SecurityControl, Vulnerability

# A fixed seed keeps the "synthetic" data reproducible across runs, which
# matters for grading / demoing consistent EAL numbers.
_RNG_SEED = 42


# --------------------------------------------------------------------------- #
# Asset catalogue
# --------------------------------------------------------------------------- #
# Each tuple: (hostname, asset_type, tier, business_unit, revenue_per_minute,
#              pii_records, financial_records, rbi_regulated, sebi_regulated,
#              network_hops_from_internet, classification_type, is_iso27001,
#              is_iso42001, is_third_party, vendor_name, vendor_risk_tier,
#              soc2_attestation)
_ASSET_CATALOGUE: list[tuple[Any, ...]] = [
    ("core-bank-switch-01", "Core Banking Switch", "Critical", "Retail Banking", 60_000.0, 0, 150_000, True, False, 4, "Core IT", True, False, False, None, None, False),
    ("core-bank-switch-02", "Core Banking Switch", "Critical", "Retail Banking", 60_000.0, 0, 150_000, True, False, 4, "Core IT", True, False, False, None, None, False),
    ("upi-gateway-prod-01", "UPI Gateway", "Critical", "Digital Payments", 90_000.0, 0, 400_000, True, False, 2, "Core IT", True, False, False, None, None, False),
    ("upi-gateway-prod-02", "UPI Gateway", "Critical", "Digital Payments", 90_000.0, 0, 400_000, True, False, 2, "Core IT", True, False, False, None, None, False),
    ("cust-db-primary", "Customer DB", "Critical", "Retail Banking", 25_000.0, 300_000, 120_000, True, True, 3, "Data Repository", True, False, False, None, None, False),
    ("cust-db-replica", "Customer DB", "Critical", "Retail Banking", 12_000.0, 300_000, 120_000, True, True, 3, "Data Repository", True, False, False, None, None, False),
    ("trading-platform-01", "Core Banking Switch", "Critical", "Capital Markets", 45_000.0, 40_000, 60_000, False, True, 3, "Core IT", True, False, False, None, None, False),
    ("erp-finance-01", "Internal ERP", "Medium", "Finance & Accounts", 6_000.0, 15_000, 40_000, False, False, 4, "Core IT", True, False, False, None, None, False),
    ("erp-hr-01", "Internal ERP", "Medium", "Human Resources", 3_000.0, 30_000, 3_000, False, False, 4, "Core IT", True, False, False, None, None, False),
    ("staff-portal-01", "Staff Portal", "Medium", "Corporate IT", 2_000.0, 10_000, 0, False, False, 2, "Core IT", True, False, False, None, None, False),
    ("staff-portal-02", "Staff Portal", "Medium", "Corporate IT", 2_000.0, 10_000, 0, False, False, 2, "Core IT", True, False, False, None, None, False),
    ("branch-pos-north-12", "Office POS", "Low", "Branch Operations", 800.0, 500, 5_000, False, False, 5, "Core IT", True, False, False, None, None, False),
    ("branch-pos-south-07", "Office POS", "Low", "Branch Operations", 800.0, 500, 5_000, False, False, 5, "Core IT", True, False, False, None, None, False),
    ("branch-pos-west-03", "Office POS", "Low", "Branch Operations", 800.0, 500, 5_000, False, False, 5, "Core IT", True, False, False, None, None, False),
    ("call-center-crm-01", "Internal ERP", "Medium", "Customer Support", 5_000.0, 80_000, 30_000, False, False, 3, "Core IT", True, False, False, None, None, False),
    ("mobile-banking-gw-01", "UPI Gateway", "Critical", "Digital Payments", 80_000.0, 0, 350_000, True, False, 2, "Core IT", True, False, False, None, None, False),
    ("dr-site-core-switch", "Core Banking Switch", "Medium", "Retail Banking", 20_000.0, 0, 60_000, True, False, 5, "Core IT", True, False, False, None, None, False),
    ("office-wifi-controller", "Office POS", "Low", "Corporate IT", 300.0, 0, 0, False, False, 6, "Core IT", True, False, False, None, None, False),
    # Synthetic TPRM & AI/ML Assets
    ("payment-aggregator-api", "Third-Party Vendor API", "Critical", "Digital Payments", 70000.0, 50000, 250000, True, False, 2, "Third-Party Vendor API", True, False, True, "RazorPay Enterprise Rails", "Tier-1 Critical", True),
    ("fraud-detection-model-01", "AI/ML Model Pipeline", "Critical", "Risk Management", 50000.0, 150000, 300000, True, True, 3, "AI/ML Model Pipeline", True, True, False, None, None, False),
    ("hr-cloud-saas-gateway", "Third-Party SaaS", "Medium", "Human Resources", 4000.0, 35000, 0, False, False, 2, "Third-Party SaaS", True, False, True, "Workday Connector", "Tier-2 High", True),
    # Cross-Border Data Transfer & Statutory Non-Compliant Test Vectors
    ("global-crm-cloud", "Third-Party SaaS", "Medium", "Customer Support", 5000.0, 80000, 0, False, False, 2, "US", True, "US", "None", True),
    ("offshore-payment-analytics", "UPI Gateway", "Critical", "Digital Payments", 60000.0, 10000, 200000, True, False, 2, "SG", True, "SG,US", "Standard Contractual Clauses (SCC)", False),
    # Sub-Processor Provenance & Unauthorized Shadow Leak Vectors (A -> B -> C)
    ("analytics-integration-gw", "Internal Gateway", "Medium", "Business Intelligence", 5000.0, 0, 0, False, False, 3, "Cloud Infrastructure", True, False, False, None, None, False),
    ("third-party-marketing-sync", "Third-Party SaaS", "Medium", "Marketing & Growth", 2000.0, 0, 0, False, False, 2, "Third-Party SaaS", False, False, True, "AdTarget Marketing Cloud Inc", "Tier-2 High", False),
]

# --------------------------------------------------------------------------- #
# CVE catalogue (authentic-style CVSS 3.1 base scores + EPSS percentiles)
# --------------------------------------------------------------------------- #
# Each tuple: (cve_id, cvss_score, epss_score, cisa_kev, patch_available)
_CVE_CATALOGUE: list[tuple[str, float, float, bool, bool]] = [
    ("CVE-2024-21413", 9.8, 0.94, True, True),
    ("CVE-2024-3400", 10.0, 0.97, True, True),
    ("CVE-2023-46805", 8.2, 0.89, True, True),
    ("CVE-2024-21887", 9.1, 0.91, True, True),
    ("CVE-2023-4966", 7.5, 0.85, True, True),
    ("CVE-2024-27198", 9.8, 0.88, True, True),
    ("CVE-2021-44228", 10.0, 0.97, True, True),
    ("CVE-2022-22965", 9.8, 0.90, True, True),
    ("CVE-2023-34362", 9.8, 0.93, True, True),
    ("CVE-2024-1709", 10.0, 0.90, True, True),
    ("CVE-2023-22515", 9.8, 0.82, True, True),
    ("CVE-2020-1472", 10.0, 0.86, True, True),
    ("CVE-2019-0708", 9.8, 0.79, True, True),
    ("CVE-2017-0144", 8.1, 0.71, True, True),
    ("CVE-2023-27997", 9.8, 0.77, True, True),
    ("CVE-2024-23897", 9.8, 0.66, False, True),
    ("CVE-2023-38831", 7.8, 0.63, True, True),
    ("CVE-2024-21762", 9.8, 0.72, True, True),
    ("CVE-2022-30190", 7.8, 0.58, True, True),
    ("CVE-2023-20887", 9.8, 0.55, False, True),
    ("CVE-2024-4577", 9.8, 0.61, True, True),
    ("CVE-2021-26855", 9.8, 0.74, True, True),
    ("CVE-2023-29357", 9.8, 0.52, False, True),
    ("CVE-2022-26134", 9.8, 0.60, True, True),
    ("CVE-2023-3519", 9.8, 0.68, True, True),
    ("CVE-2024-6387", 8.1, 0.47, False, True),
    ("CVE-2023-2868", 9.8, 0.39, True, True),
    ("CVE-2021-34527", 8.8, 0.65, True, True),
    ("CVE-2022-41082", 8.8, 0.49, True, True),
    ("CVE-2019-19781", 9.8, 0.70, True, True),
    ("CVE-2023-42793", 9.8, 0.44, True, True),
    ("CVE-2024-29847", 9.8, 0.31, False, True),
    ("CVE-2022-1388", 9.8, 0.53, True, True),
    ("CVE-2023-48788", 9.3, 0.36, True, True),
    ("CVE-2021-21985", 9.8, 0.41, True, True),
]

# --------------------------------------------------------------------------- #
# Security control catalogue (INR pricing, likelihood reduction efficacy)
# --------------------------------------------------------------------------- #
_CONTROL_CATALOGUE: list[tuple[str, str, str, float, float]] = [
    ("CTRL_MFA", "Enterprise-wide Multi-Factor Authentication", "All", 800_000.0, 0.35),
    ("CTRL_MICROSEG", "Network Micro-Segmentation (Core Segment)", "Critical", 2_500_000.0, 0.45),
    ("CTRL_EDR_HARDEN", "EDR Rollout & Endpoint Hardening", "All", 1_200_000.0, 0.30),
    ("CTRL_PATCH_AUTOMATION", "Automated Patch Management Pipeline", "All", 900_000.0, 0.40),
    ("CTRL_WAF", "Web Application Firewall (DMZ)", "Critical", 1_500_000.0, 0.28),
    ("CTRL_PAM", "Privileged Access Management Suite", "Critical", 1_800_000.0, 0.38),
    ("CTRL_SIEM_SOAR", "SIEM + SOAR 24x7 Monitoring", "All", 2_500_000.0, 0.32),
    ("CTRL_DLP", "Data Loss Prevention for PII/Financial Data", "Critical", 1_100_000.0, 0.25),
    ("CTRL_BACKUP_IMMUTABLE", "Immutable Offsite Backups & Ransomware Recovery", "All", 700_000.0, 0.22),
    ("CTRL_VULN_MGMT", "Continuous Vulnerability Management Program", "All", 600_000.0, 0.33),
    ("CTRL_ZERO_TRUST", "Zero Trust Network Access (ZTNA) Rollout", "All", 2_200_000.0, 0.42),
    ("CTRL_INCIDENT_RESPONSE", "Retainer-based Incident Response & Forensics", "All", 500_000.0, 0.15),
    ("CTRL_EMAIL_SECURITY", "Advanced Email Security Gateway (Anti-Phishing)", "All", 650_000.0, 0.20),
    ("CTRL_API_SECURITY", "API Security Gateway for UPI/Payment Rails", "Critical", 1_900_000.0, 0.36),
    ("CTRL_SECURITY_TRAINING", "Org-wide Security Awareness Training Program", "All", 300_000.0, 0.12),
    # Candidate Security Controls for AI & Third-Party Governance
    ("CTRL_AI_GOVERNANCE", "AI Safety Guardrails & Model Risk Management", "Critical", 1_800_000.0, 0.35),
    ("CTRL_TPRM_ASSESSMENT", "Automated Third-Party Vendor Risk Monitoring & SOC2 Auditing", "All", 1_200_000.0, 0.28),
    ("CTRL_DATA_CLASSIFICATION", "Automated Asset Discovery & Cryptographic Tagging", "All", 900_000.0, 0.25),
    ("CTRL_SUPPLY_CHAIN_SEC", "Software Bill of Materials (SBOM) & Third-Party Dependency Scanning", "Critical", 1_400_000.0, 0.32),
    # Candidate Security Controls for Data Residency & Cross-Border Compliance
    ("CTRL_DATA_RESIDENCY_ENCLAVE", "Sovereign Cloud Data Enclaves & Localized HSM Encryption", "Critical", 2_500_000.0, 0.35),
    ("CTRL_CROSS_BORDER_GOVERNANCE", "Automated Cross-Border Transfer Tracking & Legal Transfer Safeguards", "All", 1_000_000.0, 0.22),
    # Candidate Security Controls for Supply-Chain Lineage & Sub-Processor Governance
    ("CTRL_DATA_LINEAGE_TRACER", "Automated Data Flow & Sub-Processor Provenance Tracer", "All", 1_600_000.0, 0.38),
    ("CTRL_EGRESS_DLP", "API Boundary Egress Filtering & DLP Guardrails", "Critical", 1_500_000.0, 0.40),
    ("CTRL_CONSENT_ENFORCEMENT", "Zero-Trust Consent & Sub-Processor Delegation Verifier", "All", 1_100_000.0, 0.34),
]

ENTERPRISE_NETWORK_EDGES: list[tuple[Any, ...]] = [
    # Perimeter to DMZ Gateways
    ("INTERNET", "upi-gateway-prod-01", 1.2, "HTTPS", False),
    ("INTERNET", "upi-gateway-prod-02", 1.2, "HTTPS", False),
    ("INTERNET", "mobile-banking-gw-01", 1.1, "HTTPS", False),
    ("INTERNET", "staff-portal-01", 1.5, "HTTPS", False),
    ("INTERNET", "staff-portal-02", 1.5, "HTTPS", False),

    # DMZ to Corporate & HR Services
    ("staff-portal-01", "call-center-crm-01", 1.8, "HTTPS", False),
    ("staff-portal-02", "erp-hr-01", 2.0, "HTTPS", False),
    ("erp-hr-01", "erp-finance-01", 2.4, "INTERNAL_RPC", False),

    # DMZ to Core Application Layer
    ("upi-gateway-prod-01", "trading-platform-01", 2.2, "INTERNAL_RPC", False),
    ("upi-gateway-prod-02", "trading-platform-01", 2.2, "INTERNAL_RPC", False),
    ("mobile-banking-gw-01", "trading-platform-01", 2.0, "INTERNAL_RPC", False),

    # Application Layer to Core Banking Systems (Segmented Crown Jewels)
    ("trading-platform-01", "core-bank-switch-01", 2.5, "INTERNAL_RPC", True),
    ("trading-platform-01", "core-bank-switch-02", 2.5, "INTERNAL_RPC", True),
    ("trading-platform-01", "cust-db-primary", 2.0, "SQL_NET", True),
    ("core-bank-switch-01", "cust-db-primary", 1.5, "INTERNAL_RPC", True),
    ("core-bank-switch-02", "cust-db-primary", 1.5, "INTERNAL_RPC", True),

    # Database Replication & Internal Analytics
    ("cust-db-primary", "cust-db-replica", 1.2, "DB_REPLICATION", True),
    ("call-center-crm-01", "cust-db-replica", 3.0, "HTTPS", True),
    ("erp-finance-01", "cust-db-primary", 2.8, "SQL_NET", True),

    # Branch Operations & Office Controllers
    ("office-wifi-controller", "branch-pos-north-12", 1.0, "WIFI_INTERNAL", False),
    ("office-wifi-controller", "branch-pos-south-07", 1.0, "WIFI_INTERNAL", False),
    ("office-wifi-controller", "branch-pos-west-03", 1.0, "WIFI_INTERNAL", False),
    ("branch-pos-north-12", "call-center-crm-01", 2.5, "VPN", False),
    ("branch-pos-south-07", "call-center-crm-01", 2.5, "VPN", False),
    ("branch-pos-west-03", "call-center-crm-01", 2.5, "VPN", False),

    # Disaster Recovery Site Replication
    ("core-bank-switch-01", "dr-site-core-switch", 3.5, "ASYNC_MIRROR", True),
    ("core-bank-switch-02", "dr-site-core-switch", 3.5, "ASYNC_MIRROR", True),

    # Third-Party Vendor Integrations & AI Pipeline Topology
    ("INTERNET", "payment-aggregator-api", 1.2, "HTTPS", False),
    ("payment-aggregator-api", "upi-gateway-prod-01", 1.4, "INTERNAL_RPC", False),
    ("INTERNET", "hr-cloud-saas-gateway", 1.5, "HTTPS", False),
    ("hr-cloud-saas-gateway", "erp-hr-01", 1.8, "HTTPS", False),
    ("trading-platform-01", "fraud-detection-model-01", 1.6, "INTERNAL_RPC", False),
    ("fraud-detection-model-01", "cust-db-primary", 1.8, "SQL_NET", True),

    # Cross-Border & Foreign Cloud Integrations
    ("INTERNET", "global-crm-cloud", 1.5, "HTTPS", False),
    ("global-crm-cloud", "call-center-crm-01", 2.0, "HTTPS", False),
    ("INTERNET", "offshore-payment-analytics", 1.3, "HTTPS", False),
    ("offshore-payment-analytics", "upi-gateway-prod-01", 1.8, "INTERNAL_RPC", False),

    # Data Provenance & Unauthorized Shadow Leak Vectors (A -> B -> C)
    ("cust-db-primary", "analytics-integration-gw", 1.8, "INTERNAL_RPC", True, True, True, "Authorized Shared", "cust-db-primary:PII,cust-db-primary:FINANCIAL"),
    ("analytics-integration-gw", "third-party-marketing-sync", 0.9, "HTTPS_DATA_EXPORT", False, False, False, "Unauthorized Delegation", "cust-db-primary:PII,cust-db-primary:FINANCIAL"),
]


def _generate_vulnerabilities_for_asset(
    rng: random.Random, asset_tier: str
) -> list[dict]:
    """
    Assigns a realistic subset of CVEs to an asset. Critical-tier assets get
    more (and more severe / more likely to be actively exploited) CVEs than
    Low-tier assets, reflecting typical attack-surface concentration.
    """
    tier_cve_count = {"Critical": 4, "Medium": 2, "Low": 1}
    count = tier_cve_count.get(asset_tier, 1)

    # Bias toward higher-severity CVEs for Critical assets by sampling from
    # the top half of the catalogue (sorted by CVSS) more often.
    sorted_cves = sorted(_CVE_CATALOGUE, key=lambda c: c[1], reverse=True)
    if asset_tier == "Critical":
        pool = sorted_cves[: len(sorted_cves) // 2 + 5]
    else:
        pool = sorted_cves

    chosen = rng.sample(pool, k=min(count, len(pool)))
    vulns = []
    for cve_id, cvss, epss, kev, patch_available in chosen:
        # Add small jitter so repeated assets referencing the same CVE differ
        # slightly in observed EPSS (as would occur with real telemetry
        # collected at different scan times).
        jittered_epss = min(max(epss + rng.uniform(-0.03, 0.03), 0.01), 0.99)
        vulns.append(
            {
                "cve_id": cve_id,
                "cvss_score": cvss,
                "epss_score": round(jittered_epss, 4),
                "cisa_kev": kev,
                "patch_available": patch_available,
                "is_patched": rng.random() < 0.15,  # 15% already remediated
            }
        )
    return vulns


def seed_database(db: Session) -> dict[str, int]:
    """
    Idempotently seeds assets, vulnerabilities, and security controls.

    Returns a small summary dict of how many rows were inserted in this call
    (0 for a table that was already populated).
    """
    rng = random.Random(_RNG_SEED)
    summary = {"assets": 0, "vulnerabilities": 0, "controls": 0}

    # --- Assets + Vulnerabilities ---------------------------------------- #
    existing_hostnames = {h for (h,) in db.query(Asset.hostname).all()}
    for entry in _ASSET_CATALOGUE:
        hostname = entry[0]
        if hostname in existing_hostnames:
            continue

        asset_type = entry[1]
        tier = entry[2]
        business_unit = entry[3]
        revenue_per_minute = entry[4]
        pii_count = entry[5]
        fin_count = entry[6]
        rbi_reg = entry[7]
        sebi_reg = entry[8]
        hops = entry[9]

        if len(entry) == 15:
            # Cross-border tuple: (..., data_residency, cb_enabled, dest_countries, legal_mech, rbi_loc_compliant)
            data_residency_country = entry[10]
            cross_border_transfer_enabled = entry[11]
            destination_countries = entry[12]
            transfer_legal_mechanism = entry[13]
            is_rbi_localization_compliant = entry[14]

            classification_type = "Third-Party SaaS" if "SaaS" in asset_type else ("Core IT" if "Core" in asset_type else "Cloud Infrastructure")
            is_iso27001 = True
            is_iso42001 = False
            is_third_party = True if "Third-Party" in asset_type or "offshore" in hostname else False
            vendor_name = "Global CRM Services Ltd" if "crm" in hostname else ("Offshore Analytics Singapore Pte" if "offshore" in hostname else None)
            vendor_risk_tier = "Tier-2 High" if tier == "Medium" else ("Tier-1 Critical" if tier == "Critical" else "Tier-3 Standard")
            soc2_attestation = False
        elif len(entry) >= 17:
            classification_type = entry[10]
            is_iso27001 = entry[11]
            is_iso42001 = entry[12]
            is_third_party = entry[13]
            vendor_name = entry[14]
            vendor_risk_tier = entry[15]
            soc2_attestation = entry[16]

            data_residency_country = entry[17] if len(entry) > 17 else "IN"
            cross_border_transfer_enabled = entry[18] if len(entry) > 18 else False
            destination_countries = entry[19] if len(entry) > 19 else None
            transfer_legal_mechanism = entry[20] if len(entry) > 20 else "None"
            is_rbi_localization_compliant = entry[21] if len(entry) > 21 else True
        else:
            classification_type = "Core IT"
            is_iso27001 = True
            is_iso42001 = False
            is_third_party = False
            vendor_name = None
            vendor_risk_tier = None
            soc2_attestation = False
            data_residency_country = "IN"
            cross_border_transfer_enabled = False
            destination_countries = None
            transfer_legal_mechanism = "None"
            is_rbi_localization_compliant = True

        asset = Asset(
            hostname=hostname,
            asset_type=asset_type,
            tier=tier,
            business_unit=business_unit,
            revenue_per_minute=revenue_per_minute,
            pii_records_count=pii_count,
            financial_records_count=fin_count,
            is_rbi_regulated=rbi_reg,
            is_sebi_regulated=sebi_reg,
            network_hops_from_internet=hops,
            classification_type=classification_type,
            is_iso27001_regulated=is_iso27001,
            is_iso42001_regulated=is_iso42001,
            is_third_party=is_third_party,
            vendor_name=vendor_name,
            vendor_risk_tier=vendor_risk_tier,
            soc2_attestation=soc2_attestation,
            data_residency_country=data_residency_country,
            cross_border_transfer_enabled=cross_border_transfer_enabled,
            destination_countries=destination_countries,
            transfer_legal_mechanism=transfer_legal_mechanism,
            is_rbi_localization_compliant=is_rbi_localization_compliant,
        )
        for vuln_data in _generate_vulnerabilities_for_asset(rng, tier):
            asset.vulnerabilities.append(Vulnerability(**vuln_data))
            summary["vulnerabilities"] += 1

        db.add(asset)
        summary["assets"] += 1

    db.commit()

    # --- Security Controls -------------------------------------------------#
    existing_codes = {c for (c,) in db.query(SecurityControl.code).all()}
    for code, name, target_tier, cost_inr, likelihood_reduction in _CONTROL_CATALOGUE:
        if code in existing_codes:
            continue
        db.add(
            SecurityControl(
                code=code,
                name=name,
                target_tier=target_tier,
                cost_inr=cost_inr,
                likelihood_reduction=likelihood_reduction,
                is_active=False,
            )
        )
        summary["controls"] += 1

    db.commit()

    # --- Network Edges ---------------------------------------------------- #
    existing_edges_count = db.query(NetworkEdge).count()
    if existing_edges_count == 0:
        summary["network_edges"] = 0
        for entry in ENTERPRISE_NETWORK_EDGES:
            src, tgt, weight, proto, is_seg = entry[:5]
            is_auth = entry[5] if len(entry) > 5 else True
            consent = entry[6] if len(entry) > 6 else True
            flow_type = entry[7] if len(entry) > 7 else "Direct API"
            data_tags = entry[8] if len(entry) > 8 else None
            db.add(
                NetworkEdge(
                    source_node=src,
                    target_node=tgt,
                    weight=weight,
                    protocol=proto,
                    is_segmented=is_seg,
                    is_authorized_flow=is_auth,
                    consent_recorded=consent,
                    flow_type=flow_type,
                    data_tags=data_tags,
                )
            )
            summary["network_edges"] += 1
        db.commit()

    # --- Data Lineage Flows ----------------------------------------------- #
    existing_lineage_count = db.query(DataLineageFlow).count()
    if existing_lineage_count == 0:
        summary["lineage_flows"] = 0
        node_a = db.query(Asset).filter_by(hostname="cust-db-primary").first()
        node_b = db.query(Asset).filter_by(hostname="analytics-integration-gw").first()
        node_c = db.query(Asset).filter_by(hostname="third-party-marketing-sync").first()

        if node_a and node_b and node_c:
            flow = DataLineageFlow(
                origin_asset_id=node_a.id,
                intermediary_asset_id=node_b.id,
                destination_asset_id=node_c.id,
                is_authorized=False,
                has_user_consent=False,
                records_exposed_pii=node_a.pii_records_count,
                records_exposed_financial=node_a.financial_records_count,
                detection_status="Unauthorized Sub-Processing",
            )
            db.add(flow)
            summary["lineage_flows"] += 1
            db.commit()

    return summary
