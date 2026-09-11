"""
graph_engine.py
---------------
Advanced Attack Graph and Lateral-Movement Engine built with NetworkX.

Features:
- Dynamically constructs attack graph topology by querying `NetworkEdge` and
  `Asset` models from PostgreSQL.
- Performs weighted Dijkstra shortest-path analysis from perimeter ingress
  nodes (source="INTERNET") to critical enterprise crown jewels.
- Calculates Path Exposure Coefficients (PEC) sensitive to hop distance,
  edge traversal costs, and active security controls (e.g. network micro-segmentation,
  Zero Trust, and WAF rules).
- Serializes graph topology to `{ "nodes": [...], "edges": [...] }` format
  compatible with D3.js, Cytoscape.js, Vis.js, and React Flow.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional, Union

import networkx as nx
from sqlalchemy.orm import Session

from models import Asset, DataLineageFlow, NetworkEdge, SecurityControl
from schemas import DataLineageFlowRead

# Fallback reference backbone used when database has not yet been seeded
FALLBACK_BACKBONE_EDGES: list[tuple[str, str, float, str, bool]] = [
    ("INTERNET", "upi-gateway-prod-01", 1.2, "HTTPS", False),
    ("INTERNET", "upi-gateway-prod-02", 1.2, "HTTPS", False),
    ("INTERNET", "mobile-banking-gw-01", 1.1, "HTTPS", False),
    ("INTERNET", "staff-portal-01", 1.5, "HTTPS", False),
    ("INTERNET", "staff-portal-02", 1.5, "HTTPS", False),
    ("staff-portal-01", "call-center-crm-01", 1.8, "HTTPS", False),
    ("staff-portal-02", "erp-hr-01", 2.0, "HTTPS", False),
    ("upi-gateway-prod-01", "trading-platform-01", 2.2, "INTERNAL_RPC", False),
    ("upi-gateway-prod-02", "trading-platform-01", 2.2, "INTERNAL_RPC", False),
    ("mobile-banking-gw-01", "trading-platform-01", 2.0, "INTERNAL_RPC", False),
    ("trading-platform-01", "core-bank-switch-01", 2.5, "INTERNAL_RPC", True),
    ("trading-platform-01", "core-bank-switch-02", 2.5, "INTERNAL_RPC", True),
    ("trading-platform-01", "cust-db-primary", 2.0, "SQL_NET", True),
    ("core-bank-switch-01", "cust-db-primary", 1.5, "INTERNAL_RPC", True),
    ("core-bank-switch-02", "cust-db-primary", 1.5, "INTERNAL_RPC", True),
    ("cust-db-primary", "cust-db-replica", 1.2, "DB_REPLICATION", True),
    ("cust-db-primary", "analytics-integration-gw", 1.8, "INTERNAL_RPC", True),
    ("analytics-integration-gw", "third-party-marketing-sync", 0.9, "HTTPS_DATA_EXPORT", False),
    ("call-center-crm-01", "cust-db-replica", 3.0, "HTTPS", True),
    ("erp-finance-01", "cust-db-primary", 2.8, "SQL_NET", True),
    ("erp-hr-01", "erp-finance-01", 2.4, "INTERNAL_RPC", False),
    ("office-wifi-controller", "branch-pos-north-12", 1.0, "WIFI_INTERNAL", False),
    ("office-wifi-controller", "branch-pos-south-07", 1.0, "WIFI_INTERNAL", False),
    ("office-wifi-controller", "branch-pos-west-03", 1.0, "WIFI_INTERNAL", False),
    ("branch-pos-north-12", "call-center-crm-01", 2.5, "VPN", False),
    ("branch-pos-south-07", "call-center-crm-01", 2.5, "VPN", False),
    ("branch-pos-west-03", "call-center-crm-01", 2.5, "VPN", False),
    ("core-bank-switch-01", "dr-site-core-switch", 3.5, "ASYNC_MIRROR", True),
    ("core-bank-switch-02", "dr-site-core-switch", 3.5, "ASYNC_MIRROR", True),
]

MAX_REASONABLE_HOPS: int = 8
MAX_REASONABLE_DISTANCE: float = 20.0
MIN_PEC: float = 0.05
MAX_PEC: float = 1.00


@dataclass(frozen=True)
class AssetGraphExposure:
    """Quantitative risk exposure metrics derived from attack graph topology."""

    asset_id: int
    hostname: str
    hops_from_internet: int
    path_exposure_coefficient: float  # Normalized in [0.05, 1.00], higher = more exposed
    dijkstra_distance: float = 0.0
    shortest_path: tuple[str, ...] = ()


@dataclass
class AssetLineageProfile:
    """Quantitative data provenance & indirect leak liability profile."""

    asset_id: int
    hostname: str
    is_unauthorized_sink: bool = False
    is_shadow_leak_origin: bool = False
    inherited_pii_count: int = 0
    inherited_fin_count: int = 0
    origin_hostname: Optional[str] = None
    intermediary_hostname: Optional[str] = None
    detection_status: str = "Legitimate Flow"
    leak_root_cause_identified: bool = False



class AttackGraphEngine:
    """
    Constructs, analyzes, and visualizes the enterprise attack graph.
    
    Dynamically loads topology from PostgreSQL `NetworkEdge` and `Asset` models
    and computes Dijkstra shortest attack paths, taking active security
    controls and network segmentation into account.
    """

    def __init__(
        self,
        assets: list[Asset] | None = None,
        edges: list[NetworkEdge] | None = None,
        session: Session | None = None,
        active_controls: list[Union[SecurityControl, str]] | None = None,
    ) -> None:
        """
        Initializes the Attack Graph Engine.

        Args:
            assets: Optional pre-loaded Asset instances.
            edges: Optional pre-loaded NetworkEdge instances.
            session: Optional active SQLAlchemy session to query assets/edges from PostgreSQL.
            active_controls: List of active SecurityControl instances or control codes.
        """
        self.session = session
        self._active_control_codes = self._parse_active_controls(active_controls)
        self.assets = self._load_assets(assets)
        self.edges = self._load_edges(edges)
        
        self.asset_by_hostname: dict[str, Asset] = {a.hostname: a for a in self.assets}
        self.asset_by_id: dict[int, Asset] = {a.id: a for a in self.assets}
        
        self.graph: nx.DiGraph = nx.DiGraph()
        self._build_graph()

    @staticmethod
    def _parse_active_controls(
        controls: list[Union[SecurityControl, str]] | None,
    ) -> set[str]:
        """Extracts active control codes from strings or SecurityControl instances."""
        if not controls:
            return set()
        codes: set[str] = set()
        for item in controls:
            if isinstance(item, str):
                codes.add(item.strip())
            elif isinstance(item, SecurityControl):
                if item.is_active:
                    codes.add(item.code.strip())
        return codes

    def _load_assets(self, assets: list[Asset] | None) -> list[Asset]:
        """Loads assets from arguments or queries them from PostgreSQL."""
        if assets is not None:
            return assets
        if self.session is not None:
            try:
                return self.session.query(Asset).all()
            except Exception:
                pass
        # Attempt fallback via local session if available
        try:
            from database import SessionLocal
            with SessionLocal() as db:
                return db.query(Asset).all()
        except Exception:
            return []

    def _load_edges(self, edges: list[NetworkEdge] | None) -> list[NetworkEdge]:
        """Loads network edges from arguments or queries them from PostgreSQL."""
        if edges is not None and len(edges) > 0:
            return edges
        if self.session is not None:
            try:
                db_edges = self.session.query(NetworkEdge).all()
                if db_edges:
                    return db_edges
            except Exception:
                pass
        try:
            from database import SessionLocal
            with SessionLocal() as db:
                db_edges = db.query(NetworkEdge).all()
                if db_edges:
                    return db_edges
        except Exception:
            pass

        # Fallback to synthesized reference edges if database table is empty
        fallback_objects: list[NetworkEdge] = []
        for idx, item in enumerate(FALLBACK_BACKBONE_EDGES, start=1):
            src, tgt, w, proto, seg = item[:5]
            auth = True
            consent = True
            ftype = "Direct API"
            if src == "cust-db-primary" and tgt == "analytics-integration-gw":
                auth = True
                consent = True
                ftype = "Sub-Processor Delegation"
            elif src == "analytics-integration-gw" and tgt == "third-party-marketing-sync":
                auth = False
                consent = False
                ftype = "Unauthorized Delegation"

            fallback_objects.append(
                NetworkEdge(
                    id=idx,
                    source_node=src,
                    target_node=tgt,
                    weight=w,
                    protocol=proto,
                    is_segmented=seg,
                    is_authorized_flow=auth,
                    consent_recorded=consent,
                    flow_type=ftype,
                )
            )
        return fallback_objects

    def _calculate_effective_edge_weight(self, edge: NetworkEdge) -> float:
        """
        Calculates the effective traversal cost of an edge based on its baseline
        difficulty and active security controls (e.g. segmentation, ZTNA, WAF, Consent Enforcement).
        """
        weight = float(edge.weight)

        # Inherent segmentation penalty
        if edge.is_segmented:
            weight *= 1.5

        # Active control multipliers
        if "CTRL_MICROSEG" in self._active_control_codes and edge.is_segmented:
            # Micro-segmentation drastically raises attacker effort to traverse segmented boundaries
            weight *= 3.0

        if "CTRL_ZERO_TRUST" in self._active_control_codes:
            # Zero Trust enforces continuous identity verification at every lateral hop
            weight *= 2.0

        if "CTRL_WAF" in self._active_control_codes and edge.source_node == "INTERNET":
            # Perimeter WAF filtering on inbound entry points
            weight *= 2.5

        if "CTRL_PAM" in self._active_control_codes and edge.protocol in ("SSH", "INTERNAL_RPC"):
            # Privileged access management hardens administrative and RPC conduits
            weight *= 1.8

        # Unauthorized sub-processor delegation without consent enforcement
        is_unauthorized = (not getattr(edge, "is_authorized_flow", True)) or (not getattr(edge, "consent_recorded", True))
        if is_unauthorized:
            if "CTRL_CONSENT_ENFORCEMENT" not in self._active_control_codes:
                # Heavily penalized traversal costs on unauthorized edges when CTRL_CONSENT_ENFORCEMENT is absent
                weight *= 4.0
            else:
                # Active consent verifier governs and blocks unauthorized pivots
                weight *= 1.2

        if "CTRL_EGRESS_DLP" in self._active_control_codes and (
            getattr(edge, "flow_type", "") in ("Unauthorized Delegation", "Sub-Processor Delegation")
            or "EXPORT" in getattr(edge, "protocol", "").upper()
        ):
            weight *= 2.5

        return max(weight, 0.1)

    def _build_graph(self) -> None:
        """Constructs the NetworkX directed graph populated with node and edge attributes."""
        self.graph.clear()

        # Add all known assets as nodes with risk metadata
        for asset in self.assets:
            self.graph.add_node(
                asset.hostname,
                asset_id=asset.id,
                hostname=asset.hostname,
                asset_type=asset.asset_type,
                tier=asset.tier,
                risk_level=asset.tier,
                business_unit=asset.business_unit,
                revenue_per_minute=asset.revenue_per_minute,
            )

        # Add edges and ensure referenced nodes (e.g. 'INTERNET') exist
        for idx, edge in enumerate(self.edges, start=1):
            for node_name in (edge.source_node, edge.target_node):
                if not self.graph.has_node(node_name):
                    is_internet = node_name == "INTERNET"
                    self.graph.add_node(
                        node_name,
                        asset_id=None,
                        hostname=node_name,
                        asset_type="External Gateway" if is_internet else "Internal Switch",
                        tier="Perimeter" if is_internet else "Infrastructure",
                        risk_level="External" if is_internet else "Medium",
                        business_unit="Network Operations",
                        revenue_per_minute=0.0,
                    )

            effective_weight = self._calculate_effective_edge_weight(edge)
            edge_id = f"edge-{edge.id or idx}"
            self.graph.add_edge(
                edge.source_node,
                edge.target_node,
                id=edge_id,
                weight=effective_weight,
                base_weight=float(edge.weight),
                protocol=edge.protocol,
                is_segmented=bool(edge.is_segmented),
                is_authorized_flow=bool(getattr(edge, "is_authorized_flow", True)),
                consent_recorded=bool(getattr(edge, "consent_recorded", True)),
                flow_type=str(getattr(edge, "flow_type", "Direct API")),
                data_tags=getattr(edge, "data_tags", None),
            )

    def compute_dijkstra_shortest_paths(
        self, source: str = "INTERNET"
    ) -> dict[str, tuple[list[str], float]]:
        """
        Computes weighted Dijkstra shortest paths and cumulative costs from a source
        node to all reachable nodes in the graph.

        Returns:
            Dictionary mapping target node names to (path_list, total_weight).
        """
        if not self.graph.has_node(source):
            return {}

        try:
            lengths = nx.single_source_dijkstra_path_length(
                self.graph, source=source, weight="weight"
            )
            paths = nx.single_source_dijkstra_path(
                self.graph, source=source, weight="weight"
            )
            return {node: (paths[node], float(lengths[node])) for node in paths}
        except Exception:
            return {}

    def compute_exposure(self, source: str = "INTERNET") -> dict[int, AssetGraphExposure]:
        """
        Calculates path exposure coefficients (PEC) for all enterprise assets
        based on hop count, weighted Dijkstra transit costs, and active segmentation controls.

        Higher PEC (up to 1.0) means higher exploitability / easier reachability.
        Lower PEC reflects deeper isolation and active defense controls.
        """
        dijkstra_data = self.compute_dijkstra_shortest_paths(source=source)
        results: dict[int, AssetGraphExposure] = {}

        for asset in self.assets:
            if asset.hostname in dijkstra_data:
                path, distance = dijkstra_data[asset.hostname]
                hops = max(len(path) - 1, 1)
                
                # Attenuation formula combining hop count and Dijkstra traversal cost
                # Baseline 1-hop distance of 1.0 produces PEC = 1.0
                effective_cost = 1.0 + 0.4 * (hops - 1) + 0.6 * max(distance - 1.0, 0.0)
                pec = 1.0 / effective_cost
                pec = max(MIN_PEC, min(MAX_PEC, pec))
            else:
                # Unreachable from perimeter
                hops = MAX_REASONABLE_HOPS
                distance = MAX_REASONABLE_DISTANCE
                path = []
                pec = MIN_PEC

            results[asset.id] = AssetGraphExposure(
                asset_id=asset.id,
                hostname=asset.hostname,
                hops_from_internet=hops,
                path_exposure_coefficient=round(pec, 4),
                dijkstra_distance=round(distance, 4),
                shortest_path=tuple(path),
            )

        return results

    def shortest_path_to_crown_jewels(
        self, source: str = "INTERNET"
    ) -> dict[int, dict[str, Any]]:
        """
        Returns Dijkstra shortest attack paths from the perimeter to all Critical-tier
        crown-jewel assets, providing actionable lateral movement trails.
        """
        dijkstra_data = self.compute_dijkstra_shortest_paths(source=source)
        results: dict[int, dict[str, Any]] = {}

        for asset in self.assets:
            if asset.tier != "Critical":
                continue

            if asset.hostname in dijkstra_data:
                path, distance = dijkstra_data[asset.hostname]
                results[asset.id] = {
                    "hostname": asset.hostname,
                    "tier": asset.tier,
                    "hops": max(len(path) - 1, 1),
                    "dijkstra_distance": round(distance, 3),
                    "path": path,
                }
            else:
                results[asset.id] = {
                    "hostname": asset.hostname,
                    "tier": asset.tier,
                    "hops": MAX_REASONABLE_HOPS,
                    "dijkstra_distance": MAX_REASONABLE_DISTANCE,
                    "path": [],
                }

        return results

    def trace_transitive_data_lineage(
        self,
    ) -> tuple[list[DataLineageFlowRead], dict[int, AssetLineageProfile]]:
        """
        Performs breadth-first data provenance tracing and taint propagation across
        the enterprise graph topology to detect unauthorized sub-processors and
        indirect data leakage (A -> B -> C).

        Identifies paths where Origin A transfers sensitive records (PII / Financial)
        to Intermediary B, and B delegates or transmits to Sink C without recorded
        authorization or data principal consent.

        Returns:
            - List of DataLineageFlowRead instances detailing detected flows.
            - Mapping from asset_id to AssetLineageProfile with inherited record liabilities.
        """
        lineage_profiles: dict[int, AssetLineageProfile] = {
            asset.id: AssetLineageProfile(asset_id=asset.id, hostname=asset.hostname)
            for asset in self.assets
        }

        flow_reads: list[DataLineageFlowRead] = []
        flow_id_counter = 1

        # Check for pre-existing DataLineageFlow records in DB session if available
        if self.session is not None:
            try:
                db_flows = self.session.query(DataLineageFlow).all()
                if db_flows:
                    for df in db_flows:
                        origin_host = self.asset_by_id.get(df.origin_asset_id)
                        inter_host = (
                            self.asset_by_id.get(df.intermediary_asset_id)
                            if df.intermediary_asset_id
                            else None
                        )
                        dest_host = self.asset_by_id.get(df.destination_asset_id)

                        origin_name = origin_host.hostname if origin_host else f"asset-{df.origin_asset_id}"
                        inter_name = inter_host.hostname if inter_host else None
                        dest_name = dest_host.hostname if dest_host else f"asset-{df.destination_asset_id}"

                        is_leak = (
                            (not df.is_authorized)
                            or (not df.has_user_consent)
                            or ("Unauthorized" in df.detection_status)
                        )

                        flow_reads.append(
                            DataLineageFlowRead(
                                id=df.id,
                                origin_hostname=origin_name,
                                intermediary_hostname=inter_name,
                                destination_hostname=dest_name,
                                is_authorized=df.is_authorized,
                                has_user_consent=df.has_user_consent,
                                records_exposed_pii=df.records_exposed_pii,
                                records_exposed_financial=df.records_exposed_financial,
                                detection_status=df.detection_status,
                                leak_root_cause_identified=is_leak,
                            )
                        )

                        if is_leak and df.destination_asset_id in lineage_profiles:
                            dest_prof = lineage_profiles[df.destination_asset_id]
                            dest_prof.is_unauthorized_sink = True
                            dest_prof.is_shadow_leak_origin = True
                            dest_prof.inherited_pii_count += df.records_exposed_pii
                            dest_prof.inherited_fin_count += df.records_exposed_financial
                            dest_prof.origin_hostname = origin_name
                            dest_prof.intermediary_hostname = inter_name
                            dest_prof.detection_status = df.detection_status
                            dest_prof.leak_root_cause_identified = True

                    if flow_reads:
                        return flow_reads, lineage_profiles
            except Exception:
                pass

        # Breadth-first graph traversal for data lineage & taint propagation
        origin_assets = [
            a for a in self.assets
            if (a.pii_records_count > 0 or a.financial_records_count > 0)
        ]

        seen_flows: set[tuple[str, Optional[str], str]] = set()

        for origin in origin_assets:
            if not self.graph.has_node(origin.hostname):
                continue

            for intermediary_name in self.graph.successors(origin.hostname):
                edge_ab_data = self.graph.get_edge_data(origin.hostname, intermediary_name) or {}
                ab_authorized = edge_ab_data.get("is_authorized_flow", True)
                ab_consent = edge_ab_data.get("consent_recorded", True)

                b_successors = [
                    succ for succ in self.graph.successors(intermediary_name)
                    if succ != origin.hostname
                ]

                if not b_successors:
                    flow_key = (origin.hostname, None, intermediary_name)
                    if flow_key not in seen_flows:
                        seen_flows.add(flow_key)
                        is_auth = ab_authorized and ab_consent
                        flow_reads.append(
                            DataLineageFlowRead(
                                id=flow_id_counter,
                                origin_hostname=origin.hostname,
                                intermediary_hostname=None,
                                destination_hostname=intermediary_name,
                                is_authorized=is_auth,
                                has_user_consent=ab_consent,
                                records_exposed_pii=origin.pii_records_count,
                                records_exposed_financial=origin.financial_records_count,
                                detection_status="Legitimate Flow" if is_auth else "Unauthorized Sub-Processing",
                                leak_root_cause_identified=not is_auth,
                            )
                        )
                        flow_id_counter += 1
                    continue

                for sink_name in b_successors:
                    flow_key = (origin.hostname, intermediary_name, sink_name)
                    if flow_key in seen_flows:
                        continue
                    seen_flows.add(flow_key)

                    edge_bc_data = self.graph.get_edge_data(intermediary_name, sink_name) or {}
                    bc_authorized = edge_bc_data.get("is_authorized_flow", True)
                    bc_consent = edge_bc_data.get("consent_recorded", True)
                    bc_flow_type = edge_bc_data.get("flow_type", "Direct API")

                    is_unauthorized_leak = (
                        not bc_authorized
                        or not bc_consent
                        or "Unauthorized" in bc_flow_type
                        or not ab_authorized
                    )

                    status = (
                        "Unauthorized Sub-Processing"
                        if is_unauthorized_leak
                        else "Legitimate Flow"
                    )

                    flow_reads.append(
                        DataLineageFlowRead(
                            id=flow_id_counter,
                            origin_hostname=origin.hostname,
                            intermediary_hostname=intermediary_name,
                            destination_hostname=sink_name,
                            is_authorized=not is_unauthorized_leak,
                            has_user_consent=bc_consent and ab_consent,
                            records_exposed_pii=origin.pii_records_count,
                            records_exposed_financial=origin.financial_records_count,
                            detection_status=status,
                            leak_root_cause_identified=is_unauthorized_leak,
                        )
                    )
                    flow_id_counter += 1

                    if is_unauthorized_leak:
                        if self.graph.has_node(sink_name):
                            self.graph.nodes[sink_name]["is_shadow_leak_origin"] = True
                            self.graph.nodes[sink_name]["is_unauthorized_sink"] = True
                            self.graph.nodes[sink_name]["taint_origin"] = origin.hostname

                        if self.graph.has_edge(intermediary_name, sink_name):
                            self.graph.edges[intermediary_name, sink_name]["is_high_risk_lateral_vector"] = True

                        sink_asset = self.asset_by_hostname.get(sink_name)
                        if sink_asset and sink_asset.id in lineage_profiles:
                            sp = lineage_profiles[sink_asset.id]
                            sp.is_unauthorized_sink = True
                            sp.is_shadow_leak_origin = True
                            sp.inherited_pii_count += origin.pii_records_count
                            sp.inherited_fin_count += origin.financial_records_count
                            sp.origin_hostname = origin.hostname
                            sp.intermediary_hostname = intermediary_name
                            sp.detection_status = "Unauthorized Sub-Processing"
                            sp.leak_root_cause_identified = True

        return flow_reads, lineage_profiles

    def get_graph_visual_json(self, source: str = "INTERNET") -> dict[str, list[dict[str, Any]]]:
        """
        Serializes graph topology into a unified JSON structure compatible with
        D3.js, Cytoscape.js, Vis.js, and React Flow.

        Includes node risk tiers, asset classifications, path exposure coefficients,
        edge traversal weights, protocols, segmentation status, and lineage annotations.
        """
        self.trace_transitive_data_lineage()
        exposure_map = self.compute_exposure(source=source)
        exposure_by_host = {
            self.asset_by_id[aid].hostname: exp
            for aid, exp in exposure_map.items()
            if aid in self.asset_by_id
        }

        nodes: list[dict[str, Any]] = []
        for node_id, attrs in self.graph.nodes(data=True):
            hostname = attrs.get("hostname", node_id)
            exp = exposure_by_host.get(hostname)
            
            hops = exp.hops_from_internet if exp else (0 if node_id == source else MAX_REASONABLE_HOPS)
            pec = exp.path_exposure_coefficient if exp else (1.0 if node_id == source else MIN_PEC)
            distance = exp.dijkstra_distance if exp else 0.0

            node_data = {
                "id": node_id,
                "label": hostname,
                "asset_id": attrs.get("asset_id"),
                "tier": attrs.get("tier", "Infrastructure"),
                "asset_type": attrs.get("asset_type", "Host"),
                "risk_level": attrs.get("risk_level", "Medium"),
                "business_unit": attrs.get("business_unit", ""),
                "revenue_per_minute": attrs.get("revenue_per_minute", 0.0),
                "hops_from_internet": hops,
                "path_exposure_coefficient": pec,
                "dijkstra_distance": distance,
                "is_shadow_leak_origin": attrs.get("is_shadow_leak_origin", False),
                "is_unauthorized_sink": attrs.get("is_unauthorized_sink", False),
                "taint_origin": attrs.get("taint_origin"),
            }

            # Both flat attributes and nested 'data' payload for cross-library compatibility
            nodes.append({
                **node_data,
                "data": node_data,
            })

        edges: list[dict[str, Any]] = []
        for src, tgt, attrs in self.graph.edges(data=True):
            edge_id = attrs.get("id", f"{src}->{tgt}")
            weight = attrs.get("weight", 1.0)
            base_weight = attrs.get("base_weight", weight)
            protocol = attrs.get("protocol", "HTTPS")
            is_segmented = attrs.get("is_segmented", False)

            edge_data = {
                "id": edge_id,
                "source": src,
                "target": tgt,
                "weight": round(weight, 3),
                "base_weight": round(base_weight, 3),
                "cost": round(weight, 3),
                "protocol": protocol,
                "is_segmented": is_segmented,
                "is_authorized_flow": attrs.get("is_authorized_flow", True),
                "consent_recorded": attrs.get("consent_recorded", True),
                "flow_type": attrs.get("flow_type", "Direct API"),
                "data_tags": attrs.get("data_tags"),
                "is_high_risk_lateral_vector": attrs.get("is_high_risk_lateral_vector", False),
            }

            edges.append({
                **edge_data,
                "data": edge_data,
            })

        return {
            "nodes": nodes,
            "edges": edges,
        }


def build_exposure_map(
    assets: list[Asset],
    edges: list[NetworkEdge] | None = None,
    session: Session | None = None,
    active_controls: list[Union[SecurityControl, str]] | None = None,
) -> dict[int, AssetGraphExposure]:
    """
    Convenience function that builds the attack graph and computes
    the exposure map for the supplied enterprise assets.
    """
    engine = AttackGraphEngine(
        assets=assets,
        edges=edges,
        session=session,
        active_controls=active_controls,
    )
    return engine.compute_exposure()
