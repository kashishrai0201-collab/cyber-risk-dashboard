"""
quant_engine.py
---------------
AIML Probability & Financial Impact Engine.

Pipeline
--------
1. Likelihood calibration: converts (CVSS, EPSS, attack-graph exposure,
   active control efficacy) into a calibrated annual event frequency (λ)
   per asset via a logistic-sigmoid link function.
2. Financial impact modeling: builds a per-event composite loss distribution
   from outage cost, data-breach cost, Indian regulatory penalties
   (DPDPA 2023, RBI CSF, SEBI CSCRF), and forensics/incident-response cost.
3. Monte Carlo simulation: a vectorized compound Poisson process (Poisson
   frequency x per-event severity) run for 10,000 iterations per asset,
   from which Expected Annual Loss (EAL), Value at Risk (VaR 95 / 99), and
   a loss exceedance curve are derived, then persisted to `SimulationRun`.

All monetary values are in Indian Rupees (₹).
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass, field

import numpy as np
from scipy import stats
from sqlalchemy.orm import Session

from graph_engine import (
    AssetGraphExposure,
    AssetLineageProfile,
    AttackGraphEngine,
    build_exposure_map,
)
from models import Asset, SecurityControl, SimulationRun

# --------------------------------------------------------------------------- #
# Global calibration constants
# --------------------------------------------------------------------------- #
N_ITERATIONS = 10_000
RNG_SEED = 2024

# Logistic-sigmoid likelihood calibration: p = sigmoid(k * (score - x0)).
# `score` combines CVSS (0-10), 10*EPSS (0-10), and 10*GraphWeight (0-10)
# onto a comparable 0-30 raw scale, plus a small per-extra-vulnerability
# bonus (see `calibrate_asset_annual_frequency`). x0/k are centered so that
# only a genuinely severe, highly-exploitable, internet-exposed, multi-CVE
# posture pushes the sigmoid near saturation -- avoiding every Critical
# asset being (unrealistically) treated as certain to be breached.
SIGMOID_K = 0.30
SIGMOID_X0 = 20.0

# Ceiling on realistic annual breach *event* frequency by asset tier, applied
# as a multiplier on the sigmoid-calibrated exploit probability to produce
# the final Poisson rate (lambda). This bounds even a maximally exploitable,
# maximally exposed Critical asset to a plausible worst-case number of
# successful compromises per year, rather than letting compounded
# probabilities imply near-continuous breach activity.
TIER_MAX_ANNUAL_FREQUENCY = {"Critical": 4.0, "Medium": 1.5, "Low": 0.5}

# Residual/zero-day risk applied even to assets with no *currently known,
# unpatched* CVEs -- no real system has zero risk.
BASELINE_EXPLOIT_PROBABILITY = 0.02

# Small additive bonus to the combined raw score per extra unpatched
# vulnerability beyond the first, modeling increased attack surface without
# re-introducing runaway multiplicative compounding across many CVEs.
PER_EXTRA_VULN_SCORE_BONUS = 0.5

# Indian regulatory constants (₹)
DPDPA_MAX_PENALTY_INR = 2_500_000_000.0  # ₹250 Crore
RBI_SEBI_FINE_MIN_INR = 1_000_000.0  # ₹10 Lakh
RBI_SEBI_FINE_MAX_INR = 10_000_000.0  # ₹1 Crore
FORENSICS_COST_MIN_INR = 1_500_000.0  # ₹15 Lakh
FORENSICS_COST_MAX_INR = 3_500_000.0  # ₹35 Lakh

PII_RECORD_COST_INR = 1_200.0
FINANCIAL_RECORD_COST_INR = 2_500.0

# Reportable-incident downtime threshold (hours) above which RBI/SEBI
# incident-reporting fines become applicable for regulated assets.
REPORTABLE_DOWNTIME_HOURS = 2.0

LOSS_EXCEEDANCE_RETURN_PERIODS = (10, 50, 100)


# --------------------------------------------------------------------------- #
# Helper: Beta-PERT sampling
# --------------------------------------------------------------------------- #
def _pert_rvs(
    min_val: float, mode: float, max_val: float, size: tuple[int, ...], rng: np.random.Generator
) -> np.ndarray:
    """
    Draws samples from a Beta-PERT distribution parameterized by
    (minimum, most-likely, maximum), a standard choice for expert-elicited
    risk quantities (e.g. downtime hours, breach-record fractions) where a
    full historical loss dataset is unavailable.

    The PERT distribution is a reparameterized Beta distribution with
    shape parameters derived from the three-point estimate:
        alpha = 1 + 4 * (mode - min) / (max - min)
        beta  = 1 + 4 * (max - mode) / (max - min)
    """
    if max_val <= min_val:
        return np.full(size, min_val, dtype=float)
    alpha = 1.0 + 4.0 * (mode - min_val) / (max_val - min_val)
    beta = 1.0 + 4.0 * (max_val - mode) / (max_val - min_val)
    unit_samples = stats.beta.rvs(alpha, beta, size=size, random_state=rng)
    return min_val + unit_samples * (max_val - min_val)


# --------------------------------------------------------------------------- #
# Likelihood calibration
# --------------------------------------------------------------------------- #
def _sigmoid(x: np.ndarray | float) -> np.ndarray | float:
    return 1.0 / (1.0 + np.exp(-x))


def _vulnerability_raw_score(cvss_score: float, epss_score: float, graph_weight: float) -> float:
    """
    Combines CVSS (0-10), 10*EPSS (0-10), and 10*GraphWeight (0-10) onto a
    comparable 0-30 raw severity/exposure scale, prior to the sigmoid link.
    """
    return cvss_score + 10.0 * epss_score + 10.0 * graph_weight


def calibrate_vulnerability_exploit_probability(
    cvss_score: float,
    epss_score: float,
    graph_weight: float,
    active_control_efficacies: list[float],
) -> float:
    """
    Computes the calibrated probability that a single, isolated vulnerability
    would be exploited in a given attack attempt, using the logistic-sigmoid
    link function:

        p = sigmoid(k * (CVSS + 10*EPSS + 10*GraphWeight - x0))
            * PRODUCT_c (1 - efficacy_c) for c in active controls

    This is exposed primarily for per-CVE reporting/auditing; asset-level
    annual frequency is calibrated by `calibrate_asset_annual_frequency`,
    which combines an asset's *worst* vulnerability with a bounded bonus for
    additional exposure rather than compounding every CVE multiplicatively
    (which would unrealistically saturate risk for any multi-CVE asset).
    """
    raw_score = _vulnerability_raw_score(cvss_score, epss_score, graph_weight)
    base_probability = float(_sigmoid(SIGMOID_K * (raw_score - SIGMOID_X0)))

    control_survival_factor = 1.0
    for efficacy in active_control_efficacies:
        control_survival_factor *= (1.0 - efficacy)

    return base_probability * control_survival_factor


def calibrate_asset_annual_frequency(
    asset: Asset,
    graph_exposure: AssetGraphExposure,
    active_controls: list[SecurityControl],
) -> float:
    """
    Calibrates the annual breach-event frequency (lambda) for an asset,
    suitable as a Poisson rate parameter.

    Rather than compounding every unpatched vulnerability's probability via
    a probabilistic OR (which saturates to near-certainty for any asset with
    more than a handful of CVEs), the combined exposure score is built from
    the single *worst* unpatched vulnerability plus a small additive bonus
    per additional unpatched vulnerability (representing incremental attack
    surface without runaway compounding). That score is passed through the
    sigmoid link and then scaled by a tier-specific ceiling on realistic
    annual breach frequency (`TIER_MAX_ANNUAL_FREQUENCY`), so even a
    maximally exploitable, maximally exposed asset is bounded to a plausible
    worst-case number of successful compromises per year.

    Active security controls reduce the exploit probability multiplicatively
    via their `likelihood_reduction` efficacy.
    """
    controls_for_asset = [
        c
        for c in active_controls
        if c.target_tier == "All" or c.target_tier == asset.tier
    ]
    control_survival_factor = 1.0
    for control in controls_for_asset:
        control_survival_factor *= (1.0 - control.likelihood_reduction)

    tier_max_frequency = TIER_MAX_ANNUAL_FREQUENCY.get(asset.tier, 1.5)
    unpatched_vulns = [v for v in asset.vulnerabilities if not v.is_patched]

    if not unpatched_vulns:
        exploit_probability = BASELINE_EXPLOIT_PROBABILITY
    else:
        raw_scores = [
            _vulnerability_raw_score(
                v.cvss_score, v.epss_score, graph_exposure.path_exposure_coefficient
            )
            for v in unpatched_vulns
        ]
        combined_score = max(raw_scores) + PER_EXTRA_VULN_SCORE_BONUS * (len(unpatched_vulns) - 1)
        exploit_probability = float(_sigmoid(SIGMOID_K * (combined_score - SIGMOID_X0)))

    return tier_max_frequency * exploit_probability * control_survival_factor


# --------------------------------------------------------------------------- #
# Financial impact modeling
# --------------------------------------------------------------------------- #
def _downtime_hours_params(tier: str) -> tuple[float, float, float]:
    """Beta-PERT (min, mode, max) downtime hours per incident, by asset tier."""
    return {
        "Critical": (1.0, 4.0, 24.0),
        "Medium": (0.5, 2.0, 12.0),
        "Low": (0.25, 1.0, 6.0),
    }.get(tier, (0.5, 2.0, 12.0))


def _breach_fraction_params(tier: str) -> tuple[float, float, float]:
    """
    Beta-PERT (min, mode, max) fraction of an asset's PII/financial records
    exposed in a *data-breach* incident (not every incident is a breach;
    see `_sample_composite_event_losses` for the breach-occurrence gate).
    """
    return {
        "Critical": (0.02, 0.10, 0.60),
        "Medium": (0.01, 0.05, 0.35),
        "Low": (0.005, 0.02, 0.15),
    }.get(tier, (0.01, 0.05, 0.35))


def _sample_composite_event_losses(
    asset: Asset,
    n_events: int,
    rng: np.random.Generator,
    asset_lineage: Optional[AssetLineageProfile] = None,
) -> np.ndarray:
    """
    Samples the per-event composite loss (₹) for `n_events` independent
    security incidents affecting `asset`, combining five cost components:

      1. Outage cost      = downtime_hours (Beta-PERT) x revenue_per_minute x 60
      2. Data breach cost = breach_fraction (Beta-PERT) x records x per-record cost,
                             gated by a per-incident breach-occurrence Bernoulli draw
                             (incorporates inherited records if asset is an unauthorized sink)
      3. Regulatory penalty:
           - DPDPA 2023 penalty, scaled by breach severity and record volume
           - RBI CSF / SEBI CSCRF fine, gated by regulated status and a
             reportable-downtime threshold
           - Cross-border statutory penalty
           - Downstream unauthorized sub-processor violation fine under DPDPA Section 8(4) & RBI Guidelines
      4. Forensics & incident response cost (Uniform ₹15L - ₹35L)

    Returns an array of shape (n_events,) of total composite losses in ₹.
    """
    if n_events == 0:
        return np.array([], dtype=float)

    size = (n_events,)

    # --- 1. Outage cost --------------------------------------------------- #
    dt_min, dt_mode, dt_max = _downtime_hours_params(asset.tier)
    downtime_hours = _pert_rvs(dt_min, dt_mode, dt_max, size, rng)
    outage_cost = downtime_hours * asset.revenue_per_minute * 60.0

    # --- 2. Data breach cost ------------------------------------------------#
    breach_occurs = rng.random(size) < {"Critical": 0.55, "Medium": 0.35, "Low": 0.20}.get(
        asset.tier, 0.35
    )
    bf_min, bf_mode, bf_max = _breach_fraction_params(asset.tier)
    breach_fraction = _pert_rvs(bf_min, bf_mode, bf_max, size, rng)

    records_pii = float(asset.pii_records_count)
    records_fin = float(asset.financial_records_count)

    # Downstream unauthorized leak liability calculation
    subprocessor_violation_fine = np.zeros(size, dtype=float)
    if asset_lineage is not None and getattr(asset_lineage, "is_unauthorized_sink", False):
        # Asset C exposes Origin A's records
        records_pii = float(asset.pii_records_count + getattr(asset_lineage, "inherited_pii_count", 0))
        records_fin = float(asset.financial_records_count + getattr(asset_lineage, "inherited_fin_count", 0))

        # Statutory third-party failure fine under DPDPA Section 8(4) & RBI Guidelines:
        # Dual penalty: Primary exfiltration penalty + failure of data principal consent oversight
        subprocessor_violation_fine = np.where(
            breach_occurs,
            rng.uniform(15_000_000.0, 40_000_000.0, size=size),  # ₹1.5 Cr to ₹4 Cr
            0.0,
        )

    records_exposed_pii = breach_fraction * records_pii
    records_exposed_fin = breach_fraction * records_fin
    data_breach_cost = np.where(
        breach_occurs,
        records_exposed_pii * PII_RECORD_COST_INR
        + records_exposed_fin * FINANCIAL_RECORD_COST_INR,
        0.0,
    )

    # --- 3a. DPDPA 2023 penalty -------------------------------------------- #
    total_records_breached = records_exposed_pii + records_exposed_fin
    severity_factor = np.clip(total_records_breached / 5_000_000.0, 0.0, 1.0)
    discretion_multiplier = np.clip(
        stats.lognorm.rvs(s=0.5, scale=0.06, size=size, random_state=rng), 0.0, 1.0
    )
    dpdpa_penalty = np.where(
        breach_occurs,
        DPDPA_MAX_PENALTY_INR * severity_factor * discretion_multiplier,
        0.0,
    )

    # --- 3b. RBI CSF / SEBI CSCRF fine -------------------------------------- #
    is_regulated = asset.is_rbi_regulated or asset.is_sebi_regulated
    reportable_incident = downtime_hours >= REPORTABLE_DOWNTIME_HOURS
    rbi_sebi_fine = np.where(
        is_regulated & reportable_incident,
        rng.uniform(RBI_SEBI_FINE_MIN_INR, RBI_SEBI_FINE_MAX_INR, size=size),
        0.0,
    )

    # --- 3c. Cross-border statutory penalty --------------------------------- #
    is_rbi_reg = getattr(asset, "is_rbi_regulated", False)
    is_rbi_loc = getattr(asset, "is_rbi_localization_compliant", True)
    cb_enabled = getattr(asset, "cross_border_transfer_enabled", False)
    legal_mech = getattr(asset, "transfer_legal_mechanism", "None") or "None"

    cross_border_violation = (
        (is_rbi_reg and not is_rbi_loc)
        or (cb_enabled and legal_mech in (None, "None"))
    )
    cross_border_fine = np.where(
        cross_border_violation & breach_occurs,
        rng.uniform(20_000_000.0, 50_000_000.0, size=size),  # ₹2 Cr to ₹5 Cr statutory enforcement fine
        0.0,
    )

    # --- 4. Forensics & incident response cost ------------------------------#
    forensics_cost = rng.uniform(FORENSICS_COST_MIN_INR, FORENSICS_COST_MAX_INR, size=size)

    total_loss = (
        outage_cost
        + data_breach_cost
        + dpdpa_penalty
        + rbi_sebi_fine
        + cross_border_fine
        + subprocessor_violation_fine
        + forensics_cost
    )
    return total_loss


# --------------------------------------------------------------------------- #
# Monte Carlo Simulation Engine
# --------------------------------------------------------------------------- #
@dataclass
class AssetSimulationResult:
    asset_id: int
    hostname: str
    tier: str
    asset_type: str
    annual_event_frequency: float
    eal_inr: float
    var_95_inr: float
    var_99_inr: float
    annual_loss_samples: np.ndarray = field(repr=False)


@dataclass
class EnterpriseSimulationResult:
    total_eal_inr: float
    var_95_inr: float
    var_99_inr: float
    per_asset_results: list[AssetSimulationResult]
    aggregate_loss_samples: np.ndarray = field(repr=False)
    total_regulatory_fine_exposure_inr: float
    iterations: int = N_ITERATIONS
    unauthorized_subprocessor_count: int = 0
    shadow_leakage_exposure_inr: float = 0.0
    identified_leak_vectors: list[Any] = field(default_factory=list)


class MonteCarloRiskEngine:
    """
    Runs a vectorized compound-Poisson Monte Carlo simulation across all
    assets to quantify Expected Annual Loss (EAL) and Value at Risk (VaR).

    Vectorization strategy: for each asset, `n_iterations` Poisson draws
    give the number of loss *events* in each simulated year. Rather than
    looping event-by-event, we draw a (n_iterations x max_events) matrix of
    candidate per-event severities and mask out entries beyond each
    iteration's actual event count, then sum across events per iteration.
    This keeps the simulation fully vectorized in NumPy even though the
    event count varies stochastically per iteration.
    """

    def __init__(
        self,
        assets: list[Asset],
        active_controls: list[SecurityControl] | None = None,
        n_iterations: int = N_ITERATIONS,
        seed: int = RNG_SEED,
        session: Session | None = None,
    ) -> None:
        self.assets = assets
        self.active_controls = active_controls or []
        self.n_iterations = n_iterations
        self.rng = np.random.default_rng(seed)
        self.session = session
        self.graph_engine = AttackGraphEngine(
            assets=assets,
            active_controls=self.active_controls,
            session=self.session,
        )
        self.exposure_map = self.graph_engine.compute_exposure()
        self.lineage_flows, self.lineage_profiles = self.graph_engine.trace_transitive_data_lineage()

    def _simulate_asset(self, asset: Asset) -> AssetSimulationResult:
        exposure = self.exposure_map[asset.id]
        lam = calibrate_asset_annual_frequency(asset, exposure, self.active_controls)

        event_counts = self.rng.poisson(lam=lam, size=self.n_iterations)
        max_events = int(event_counts.max()) if event_counts.size else 0

        if max_events == 0:
            annual_losses = np.zeros(self.n_iterations, dtype=float)
        else:
            lineage_prof = self.lineage_profiles.get(asset.id)
            candidate_losses = _sample_composite_event_losses(
                asset, self.n_iterations * max_events, self.rng, asset_lineage=lineage_prof
            ).reshape(self.n_iterations, max_events)
            event_slot_mask = np.arange(max_events)[None, :] < event_counts[:, None]
            annual_losses = (candidate_losses * event_slot_mask).sum(axis=1)

        eal = float(np.mean(annual_losses))
        var_95 = float(np.percentile(annual_losses, 95))
        var_99 = float(np.percentile(annual_losses, 99))

        return AssetSimulationResult(
            asset_id=asset.id,
            hostname=asset.hostname,
            tier=asset.tier,
            asset_type=asset.asset_type,
            annual_event_frequency=round(lam, 4),
            eal_inr=eal,
            var_95_inr=var_95,
            var_99_inr=var_99,
            annual_loss_samples=annual_losses,
        )

    def run(self) -> EnterpriseSimulationResult:
        """Executes the full enterprise Monte Carlo simulation."""
        per_asset_results = [self._simulate_asset(asset) for asset in self.assets]

        if per_asset_results:
            aggregate_losses = np.sum(
                [r.annual_loss_samples for r in per_asset_results], axis=0
            )
        else:
            aggregate_losses = np.zeros(self.n_iterations, dtype=float)

        total_eal = float(np.mean(aggregate_losses))
        var_95 = float(np.percentile(aggregate_losses, 95))
        var_99 = float(np.percentile(aggregate_losses, 99))

        # Regulatory-fine-only exposure estimate (DPDPA + RBI/SEBI + Cross-Border + Sub-Processor),
        # reported as the 95th percentile of a dedicated re-simulation of the
        # penalty components alone -- useful for the compliance dashboard.
        total_regulatory_exposure = self._estimate_regulatory_exposure()

        unauthorized_vectors = [
            f for f in self.lineage_flows
            if (not f.is_authorized or not f.has_user_consent or "Unauthorized" in f.detection_status)
        ]
        unauthorized_count = len(unauthorized_vectors)

        shadow_leakage_exposure = 0.0
        for r in per_asset_results:
            prof = self.lineage_profiles.get(r.asset_id)
            if prof and prof.is_unauthorized_sink:
                shadow_leakage_exposure += r.eal_inr

        return EnterpriseSimulationResult(
            total_eal_inr=total_eal,
            var_95_inr=var_95,
            var_99_inr=var_99,
            per_asset_results=per_asset_results,
            aggregate_loss_samples=aggregate_losses,
            total_regulatory_fine_exposure_inr=total_regulatory_exposure,
            iterations=self.n_iterations,
            unauthorized_subprocessor_count=unauthorized_count,
            shadow_leakage_exposure_inr=shadow_leakage_exposure,
            identified_leak_vectors=self.lineage_flows,
        )

    def _estimate_regulatory_exposure(self) -> float:
        """
        Isolates the regulatory-penalty share of the 95th-percentile annual
        loss across all assets, by re-deriving DPDPA + RBI/SEBI penalty
        samples with the same seeded RNG stream logic used in the main run.
        A fresh, independently seeded generator is used here so this
        estimate does not perturb the primary EAL/VaR simulation stream.
        """
        local_rng = np.random.default_rng(RNG_SEED + 1)
        penalty_totals = np.zeros(self.n_iterations, dtype=float)

        for asset in self.assets:
            exposure = self.exposure_map[asset.id]
            lam = calibrate_asset_annual_frequency(asset, exposure, self.active_controls)
            event_counts = local_rng.poisson(lam=lam, size=self.n_iterations)
            max_events = int(event_counts.max()) if event_counts.size else 0
            if max_events == 0:
                continue

            n = self.n_iterations * max_events
            size = (n,)
            breach_occurs = local_rng.random(size) < {
                "Critical": 0.55,
                "Medium": 0.35,
                "Low": 0.20,
            }.get(asset.tier, 0.35)
            bf_min, bf_mode, bf_max = _breach_fraction_params(asset.tier)
            breach_fraction = _pert_rvs(bf_min, bf_mode, bf_max, size, local_rng)

            records_pii = float(asset.pii_records_count)
            records_fin = float(asset.financial_records_count)
            lineage_prof = self.lineage_profiles.get(asset.id)
            subprocessor_fine = np.zeros(size, dtype=float)
            if lineage_prof is not None and getattr(lineage_prof, "is_unauthorized_sink", False):
                records_pii = float(asset.pii_records_count + getattr(lineage_prof, "inherited_pii_count", 0))
                records_fin = float(asset.financial_records_count + getattr(lineage_prof, "inherited_fin_count", 0))
                subprocessor_fine = np.where(
                    breach_occurs,
                    local_rng.uniform(15_000_000.0, 40_000_000.0, size=size),
                    0.0,
                )

            records_breached = breach_fraction * (records_pii + records_fin)
            severity_factor = np.clip(records_breached / 5_000_000.0, 0.0, 1.0)
            discretion_multiplier = np.clip(
                stats.lognorm.rvs(s=0.5, scale=0.06, size=size, random_state=local_rng), 0.0, 1.0
            )
            dpdpa = np.where(
                breach_occurs, DPDPA_MAX_PENALTY_INR * severity_factor * discretion_multiplier, 0.0
            )

            downtime_hours = _pert_rvs(*_downtime_hours_params(asset.tier), size, local_rng)
            is_regulated = asset.is_rbi_regulated or asset.is_sebi_regulated
            reportable = downtime_hours >= REPORTABLE_DOWNTIME_HOURS
            rbi_sebi = np.where(
                is_regulated & reportable,
                local_rng.uniform(RBI_SEBI_FINE_MIN_INR, RBI_SEBI_FINE_MAX_INR, size=size),
                0.0,
            )

            is_rbi_reg = getattr(asset, "is_rbi_regulated", False)
            is_rbi_loc = getattr(asset, "is_rbi_localization_compliant", True)
            cb_enabled = getattr(asset, "cross_border_transfer_enabled", False)
            legal_mech = getattr(asset, "transfer_legal_mechanism", "None") or "None"

            cross_border_violation = (
                (is_rbi_reg and not is_rbi_loc)
                or (cb_enabled and legal_mech in (None, "None"))
            )
            cross_border_fine = np.where(
                cross_border_violation & breach_occurs,
                local_rng.uniform(20_000_000.0, 50_000_000.0, size=size),
                0.0,
            )

            per_event_penalty = (dpdpa + rbi_sebi + cross_border_fine + subprocessor_fine).reshape(
                self.n_iterations, max_events
            )
            event_slot_mask = np.arange(max_events)[None, :] < event_counts[:, None]
            penalty_totals += (per_event_penalty * event_slot_mask).sum(axis=1)

        return float(np.percentile(penalty_totals, 95)) if self.assets else 0.0

    def loss_exceedance_curve(
        self, aggregate_losses: np.ndarray
    ) -> list[tuple[int, float]]:
        """
        Computes Loss Exceedance Curve points for standard return periods.
        A "1-in-T-year loss" is the loss level exceeded with probability
        1/T, i.e. the (1 - 1/T) quantile of the annual aggregate loss
        distribution.
        """
        points: list[tuple[int, float]] = []
        for t in LOSS_EXCEEDANCE_RETURN_PERIODS:
            quantile = 1.0 - (1.0 / t)
            loss_at_quantile = float(np.percentile(aggregate_losses, quantile * 100.0))
            points.append((t, loss_at_quantile))
        return points


def run_enterprise_simulation(
    db: Session,
    assets: list[Asset],
    active_controls: list[SecurityControl] | None = None,
    persist: bool = True,
    allocated_budget_inr: float | None = None,
) -> EnterpriseSimulationResult:
    """
    Convenience entry point: runs the full Monte Carlo simulation and
    optionally persists the aggregate result to the `SimulationRun` table.
    """
    engine = MonteCarloRiskEngine(assets=assets, active_controls=active_controls, session=db)
    result = engine.run()

    if persist:
        selected_codes = [c.code for c in (active_controls or [])]
        run_record = SimulationRun(
            total_eal_inr=result.total_eal_inr,
            var_95_inr=result.var_95_inr,
            var_99_inr=result.var_99_inr,
            allocated_budget_inr=allocated_budget_inr,
            selected_controls_json=json.dumps(selected_codes),
        )
        db.add(run_record)
        db.commit()
        db.refresh(run_record)

    return result

