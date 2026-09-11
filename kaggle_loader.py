"""
kaggle_loader.py
----------------
Ingests and maps real CVEs from the Kaggle CISA KEV & EPSS Enriched Dataset
(`data/cve.csv`) into the CRQ platform's PostgreSQL database.

Topology Mapping Logic:
1. High-exploitability `NETWORK` attack vector CVEs with high EPSS scores
   are mapped to critical perimeter nodes:
   - `upi-gateway-prod-01`
   - `upi-gateway-prod-02`
   - `mobile-banking-gw-01`
2. Database and privilege escalation CVEs (`LOCAL` / `NETWORK` with high CVSS)
   are mapped to backend crown jewels:
   - `core-banking-db-01`
   - `cust-db-primary`
3. Representative CVEs are distributed across remaining enterprise assets by tier.
4. Existing mock vulnerabilities are cleared and real CVEs are persisted in an
   atomic SQLAlchemy transaction.
"""

from __future__ import annotations

import logging
import os
import random
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from models import Asset, NetworkEdge, Vulnerability

logger = logging.getLogger(__name__)

# Preferred paths for dataset discovery
DEFAULT_CSV_CANDIDATES = [
    Path("data") / "cve.csv",
    Path("Data") / "cve.csv",
    Path("data") / "cve_enriched.csv",
]

_PERIMETER_HOSTS = [
    "upi-gateway-prod-01",
    "upi-gateway-prod-02",
    "mobile-banking-gw-01",
]

_CROWN_JEWEL_HOSTS = [
    "core-banking-db-01",
    "cust-db-primary",
]


def find_dataset_path(custom_path: str | Path | None = None) -> Path:
    """Finds existing dataset file among common relative and absolute paths."""
    if custom_path:
        p = Path(custom_path)
        if p.exists():
            return p

    base_dir = Path(__file__).resolve().parent
    candidates = DEFAULT_CSV_CANDIDATES + [base_dir / c for c in DEFAULT_CSV_CANDIDATES]

    for cand in candidates:
        if cand.exists() and cand.is_file():
            return cand

    raise FileNotFoundError(
        f"Kaggle CVE dataset file not found. Checked: {[str(c) for c in candidates]}"
    )


def _resolve_column(df: pd.DataFrame, candidates: list[str]) -> str | None:
    """Returns the first matching column name present in DataFrame."""
    for col in candidates:
        if col in df.columns:
            return col
    return None


def load_and_normalize_cve_df(csv_path: Path) -> pd.DataFrame:
    """
    Loads `cve.csv` using Pandas and standardizes schema fields:
    - cve_id: string
    - cvss_score: float [0.0 - 10.0]
    - exploitability_score: float [0.0 - 10.0]
    - attack_vector: string ('NETWORK', 'LOCAL', 'ADJACENT_NETWORK', 'PHYSICAL')
    - epss_score: float [0.0 - 1.0]
    - cisa_kev: bool
    """
    logger.info("Reading Kaggle CVE dataset from %s", csv_path)
    df = pd.read_csv(csv_path, low_memory=False)

    col_id = _resolve_column(df, ["cve_id", "cveId", "CVE_ID", "cve"])
    col_cvss = _resolve_column(df, ["base_score", "cvss", "cvssV3_baseScore", "cvss_score"])
    col_exploit = _resolve_column(
        df, ["exploitability_score", "cvssV3_exploitabilityScore", "exploitabilityScore"]
    )
    col_av = _resolve_column(df, ["attack_vector", "attackVector", "attack_vec"])
    col_epss = _resolve_column(df, ["epss_score", "epss", "epssScore", "epss_perc"])
    col_kev = _resolve_column(df, ["cisa_kev", "known_exploited", "cisaKev", "cisa_known_exploited"])

    if not col_id:
        raise ValueError("Could not locate CVE identifier column in dataset.")

    normalized = pd.DataFrame()
    normalized["cve_id"] = df[col_id].astype(str).str.strip()

    if col_cvss:
        normalized["cvss_score"] = pd.to_numeric(df[col_cvss], errors="coerce").fillna(5.0)
    else:
        normalized["cvss_score"] = 5.0

    if col_exploit:
        normalized["exploitability_score"] = pd.to_numeric(
            df[col_exploit], errors="coerce"
        ).fillna(2.5)
    else:
        normalized["exploitability_score"] = 2.5

    if col_av:
        normalized["attack_vector"] = df[col_av].astype(str).str.upper().str.strip()
    else:
        normalized["attack_vector"] = "NETWORK"

    if col_epss:
        normalized["epss_score"] = pd.to_numeric(df[col_epss], errors="coerce").fillna(0.01)
    else:
        normalized["epss_score"] = 0.01

    if col_kev:
        kev_series = df[col_kev]
        if kev_series.dtype == bool:
            normalized["cisa_kev"] = kev_series.fillna(False)
        else:
            normalized["cisa_kev"] = (
                kev_series.astype(str)
                .str.lower()
                .isin(["true", "1", "yes", "y", "t"])
            )
    else:
        normalized["cisa_kev"] = False

    # Filter out empty or placeholder CVE IDs
    normalized = normalized[normalized["cve_id"].str.startswith("CVE-")].copy()
    normalized["cvss_score"] = normalized["cvss_score"].clip(0.0, 10.0).round(1)
    normalized["exploitability_score"] = normalized["exploitability_score"].clip(0.0, 10.0).round(1)
    normalized["epss_score"] = normalized["epss_score"].clip(0.0, 1.0).round(5)

    return normalized


def ensure_topology_nodes(db: Session) -> None:
    """Ensures crown jewel node `core-banking-db-01` and required topology edges exist."""
    core_db = db.query(Asset).filter(Asset.hostname == "core-banking-db-01").first()
    if not core_db:
        core_db = Asset(
            hostname="core-banking-db-01",
            asset_type="Customer DB",
            tier="Critical",
            business_unit="Retail Banking",
            revenue_per_minute=75_000.0,
            pii_records_count=350_000,
            financial_records_count=500_000,
            is_rbi_regulated=True,
            is_sebi_regulated=True,
            network_hops_from_internet=3,
        )
        db.add(core_db)
        db.flush()

    # Ensure edge exists in network_edges if table is used
    existing_edge = (
        db.query(NetworkEdge)
        .filter(
            NetworkEdge.source_node == "core-bank-switch-01",
            NetworkEdge.target_node == "core-banking-db-01",
        )
        .first()
    )
    if not existing_edge:
        db.add(
            NetworkEdge(
                source_node="core-bank-switch-01",
                target_node="core-banking-db-01",
                weight=1.5,
                protocol="SQL_NET",
                is_segmented=True,
            )
        )
        db.flush()


def ingest_kaggle_cves(
    db: Session, csv_path: str | Path | None = None
) -> dict[str, Any]:
    """
    Ingests Kaggle CVE dataset, performs topology mapping to assets, clears existing
    mock entries, and commits new vulnerabilities in an atomic transaction.
    """
    rng = random.Random(42)
    dataset_file = find_dataset_path(csv_path)
    df = load_and_normalize_cve_df(dataset_file)

    # Make sure all required asset nodes exist
    ensure_topology_nodes(db)

    assets = db.query(Asset).all()
    if not assets:
        raise RuntimeError("No assets found in database. Seed asset inventory first.")

    asset_by_host = {a.hostname: a for a in assets}

    # 1. Candidate pools
    # Perimeter: NETWORK attack vector, high EPSS, high exploitability
    perimeter_pool = df[
        (df["attack_vector"] == "NETWORK")
        & (df["epss_score"] >= 0.20)
        & (df["exploitability_score"] >= 2.8)
    ].sort_values(by=["epss_score", "cvss_score"], ascending=False)

    if len(perimeter_pool) < 30:
        # Fallback to general high EPSS network pool
        perimeter_pool = df[df["attack_vector"] == "NETWORK"].sort_values(
            by=["epss_score", "cvss_score"], ascending=False
        )

    # Backend Crown Jewels: Database / privilege escalation (LOCAL or NETWORK with high CVSS >= 8.5)
    crown_jewel_pool = df[
        (df["attack_vector"].isin(["LOCAL", "NETWORK"]))
        & (df["cvss_score"] >= 8.5)
    ].sort_values(by=["cvss_score", "epss_score"], ascending=False)

    # General pool for other assets
    general_pool = df.sort_values(by=["cvss_score", "epss_score"], ascending=False)

    used_cve_ids: set[str] = set()
    new_vuln_records: list[Vulnerability] = []
    mapped_assets: set[str] = set()

    def _pick_cves(pool_df: pd.DataFrame, count: int) -> list[dict[str, Any]]:
        selected: list[dict[str, Any]] = []
        for _, row in pool_df.iterrows():
            cve_id = row["cve_id"]
            if cve_id in used_cve_ids:
                continue
            used_cve_ids.add(cve_id)
            selected.append(
                {
                    "cve_id": cve_id,
                    "cvss_score": float(row["cvss_score"]),
                    "epss_score": float(row["epss_score"]),
                    "cisa_kev": bool(row["cisa_kev"]),
                    "patch_available": True,
                    "is_patched": rng.random() < 0.15,  # 15% remediated
                }
            )
            if len(selected) >= count:
                break
        return selected

    # 2. Map Perimeter nodes
    for hostname in _PERIMETER_HOSTS:
        asset = asset_by_host.get(hostname)
        if not asset:
            continue
        cve_data_list = _pick_cves(perimeter_pool, count=6)
        for cve_data in cve_data_list:
            new_vuln_records.append(Vulnerability(asset_id=asset.id, **cve_data))
        mapped_assets.add(hostname)

    # 3. Map Crown Jewels
    for hostname in _CROWN_JEWEL_HOSTS:
        asset = asset_by_host.get(hostname)
        if not asset:
            continue
        cve_data_list = _pick_cves(crown_jewel_pool, count=6)
        for cve_data in cve_data_list:
            new_vuln_records.append(Vulnerability(asset_id=asset.id, **cve_data))
        mapped_assets.add(hostname)

    # 4. Map Remaining Assets by Tier
    for asset in assets:
        if asset.hostname in mapped_assets:
            continue

        if asset.tier == "Critical":
            count = 4
            pool = crown_jewel_pool
        elif asset.tier == "Medium":
            count = 2
            pool = general_pool[general_pool["cvss_score"] >= 6.0]
        else:
            count = 1
            pool = general_pool

        cve_data_list = _pick_cves(pool, count=count)
        for cve_data in cve_data_list:
            new_vuln_records.append(Vulnerability(asset_id=asset.id, **cve_data))
        mapped_assets.add(asset.hostname)

    # 5. Database transaction: delete existing mock entries and insert real CVEs
    try:
        db.query(Vulnerability).delete()
        db.add_all(new_vuln_records)
        db.commit()
    except Exception:
        db.rollback()
        raise

    # Invalidate optimizer caches so new CVE landscape is immediately reflected
    try:
        from optimizer import clear_optimizer_cache
        clear_optimizer_cache()
    except ImportError:
        pass

    result = {
        "status": "ok",
        "vulnerabilities_ingested": len(new_vuln_records),
        "mapped_assets": sorted(list(mapped_assets)),
        "message": (
            f"Successfully ingested {len(new_vuln_records)} real Kaggle CVEs "
            f"across {len(mapped_assets)} enterprise assets."
        ),
    }
    return result
