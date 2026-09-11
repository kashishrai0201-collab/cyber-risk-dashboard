"""
db_init.py
----------
Database initialization and bootstrapping script for the CRQ platform.

Capabilities:
1. Tests the PostgreSQL connection and retrieves server telemetry.
2. Drops and recreates all database tables with safety confirmation guards.
3. Populates initial seed data:
   - Enterprise IT/OT assets spanning Critical, Medium, and Low tiers.
   - Authentic CVE records with CVSS 3.1 and EPSS distributions.
   - Comprehensive security controls catalogue.
   - Enterprise NetworkEdge topology for dynamic lateral-movement analysis.
4. Verifies attack graph connectivity and Dijkstra reachability from the perimeter.

Usage:
    python db_init.py            # Prompts before dropping tables
    python db_init.py --force    # Non-interactive automated deployment
    python db_init.py --test-only # Verifies DB connectivity without changes
"""

from __future__ import annotations

import argparse
import sys
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session

from database import Base, SessionLocal, engine
from graph_engine import AttackGraphEngine
from models import Asset, DataLineageFlow, NetworkEdge, SecurityControl, Vulnerability
from seeder import _ASSET_CATALOGUE, _CONTROL_CATALOGUE, _generate_vulnerabilities_for_asset, _RNG_SEED
import random

# --------------------------------------------------------------------------- #
# Enterprise Network Topology Seed Data
# --------------------------------------------------------------------------- #
# Tuples: (source_node, target_node, weight, protocol, is_segmented)
ENTERPRISE_NETWORK_EDGES: list[tuple[str, str, float, str, bool]] = [
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


def test_database_connection() -> bool:
    """
    Validates connectivity to the configured database engine and prints diagnostics.
    """
    print(f"[*] Testing connection to: {engine.url.render_as_string(hide_password=True)} ...")
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1;")).scalar()
            try:
                version_info = conn.execute(text("SELECT version();")).scalar()
            except Exception:
                version_info = "Unknown (non-PostgreSQL dialect)"

            if result == 1:
                print("[+] Connection successful!")
                print(f"[+] Engine Dialect : {engine.dialect.name}")
                print(f"[+] Server Version : {version_info}")
                return True
            else:
                print("[-] Unexpected query result during health check.")
                return False
    except OperationalError as exc:
        print("[-] Database connection failed: OperationalError")
        print(f"    Details: {exc.orig if hasattr(exc, 'orig') else exc}")
        print("    Ensure PostgreSQL is running and DATABASE_URL is properly configured.")
        return False
    except SQLAlchemyError as exc:
        print(f"[-] SQLAlchemy Error during connection test: {exc}")
        return False


def drop_and_recreate_tables() -> None:
    """Drops all existing tables in the schema and recreates them from ORM metadata."""
    print("[*] Dropping all existing database tables...")
    Base.metadata.drop_all(bind=engine)
    print("[+] Existing tables dropped.")

    print("[*] Creating all schema tables from declarative models...")
    Base.metadata.create_all(bind=engine)
    print("[+] All tables successfully created.")


def seed_enterprise_data(db: Session) -> dict[str, int]:
    """
    Populates initial enterprise inventory, vulnerabilities, controls, and network edges.
    """
    rng = random.Random(_RNG_SEED)
    summary: dict[str, int] = {
        "assets": 0,
        "vulnerabilities": 0,
        "controls": 0,
        "network_edges": 0,
    }

    print("[*] Seeding assets and vulnerabilities...")
    for entry in _ASSET_CATALOGUE:
        hostname = entry[0]
        asset_type = entry[1]
        tier = entry[2]
        business_unit = entry[3]
        rev_per_min = entry[4]
        pii_count = entry[5]
        fin_count = entry[6]
        rbi_reg = entry[7]
        sebi_reg = entry[8]
        hops = entry[9]

        if len(entry) == 15:
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
            revenue_per_minute=rev_per_min,
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

    print("[*] Seeding security controls catalogue...")
    for code, name, target_tier, cost_inr, likelihood_reduction in _CONTROL_CATALOGUE:
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

    print("[*] Seeding network attack graph edges...")
    for entry in ENTERPRISE_NETWORK_EDGES:
        src, tgt, weight, proto, is_seg = entry[:5]
        is_auth = entry[5] if len(entry) > 5 else True
        consent = entry[6] if len(entry) > 6 else True
        flow_type = entry[7] if len(entry) > 7 else "Direct API"
        data_tags = entry[8] if len(entry) > 8 else None
        edge = NetworkEdge(
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
        db.add(edge)
        summary["network_edges"] += 1

    print("[*] Seeding data lineage & provenance flows...")
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
        summary["data_lineage_flows"] = 1

    db.commit()
    print(f"[+] Seeding complete: {summary}")
    return summary


def verify_attack_graph(db: Session) -> None:
    """Verifies that the attack graph engine correctly parses the seeded topology."""
    print("\n[*] Verifying attack graph Dijkstra path calculations...")
    engine_inst = AttackGraphEngine(session=db)
    crown_jewels = engine_inst.shortest_path_to_crown_jewels(source="INTERNET")

    print(f"[+] Attack graph nodes count : {engine_inst.graph.number_of_nodes()}")
    print(f"[+] Attack graph edges count : {engine_inst.graph.number_of_edges()}")
    print(f"[+] Critical Crown Jewels reachable: {len(crown_jewels)}")

    for asset_id, data in crown_jewels.items():
        path_str = " -> ".join(data["path"]) if data["path"] else "UNREACHABLE"
        print(f"    • [{data['tier']}] {data['hostname']}: hops={data['hops']}, cost={data['dijkstra_distance']}")
        print(f"      Path: {path_str}")


def parse_arguments() -> argparse.Namespace:
    """Configures CLI flags for database initialization."""
    parser = argparse.ArgumentParser(
        description="Bootstrap and seed the PostgreSQL database for the Cyber Risk Quantification platform."
    )
    parser.add_argument(
        "-f", "--force",
        action="store_true",
        help="Execute drop and recreate without interactive confirmation prompt.",
    )
    parser.add_argument(
        "--test-only",
        action="store_true",
        help="Test database connection without altering schemas or data.",
    )
    parser.add_argument(
        "--skip-seed",
        action="store_true",
        help="Create tables without populating seed data.",
    )
    return parser.parse_args()


def main() -> None:
    """Primary entry point for the database initialization workflow."""
    args = parse_arguments()

    print("=" * 76)
    print(" AI-Powered Cyber Risk Quantification Platform - Database Initializer")
    print("=" * 76)

    # 1. Test database connection
    if not test_database_connection():
        sys.exit(1)

    if args.test_only:
        print("[+] Test-only flag specified. Exiting cleanly.")
        sys.exit(0)

    # 2. Confirmation prompt
    if not args.force:
        confirm = input("\n[?] WARNING: This will DROP and RECREATE all tables. Continue? (y/N): ").strip().lower()
        if confirm not in ("y", "yes"):
            print("[-] Operation aborted by user.")
            sys.exit(0)

    # 3. Drop and recreate tables
    try:
        drop_and_recreate_tables()
    except SQLAlchemyError as exc:
        print(f"[-] Error dropping or creating tables: {exc}")
        sys.exit(1)

    # 4. Seed initial enterprise records
    if not args.skip_seed:
        with SessionLocal() as db:
            try:
                seed_enterprise_data(db)
                verify_attack_graph(db)
            except SQLAlchemyError as exc:
                db.rollback()
                print(f"[-] Database error during seeding: {exc}")
                sys.exit(1)

    print("\n[+] Database initialization completed successfully.")


if __name__ == "__main__":
    main()
