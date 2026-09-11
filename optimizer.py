"""
optimizer.py
------------
Budget-Constrained Security Investment Optimizer.

Formulates and solves a 0/1 knapsack-style Mixed-Integer Linear Program
(MILP) with PuLP: given a budget B (₹) and a catalogue of candidate
`SecurityControl` rows, choose the subset of controls that maximizes total
financial risk reduction (ΔEAL) without exceeding the budget.

Because the underlying likelihood model in `quant_engine.py` combines
control efficacies *multiplicatively* (stacking survival probabilities),
the true joint ΔEAL of a control set is not a simple linear sum of
per-control effects. To keep the optimization tractable as a linear
program while still respecting this non-linearity, we:

  1. Compute each control's *standalone* marginal ΔEAL (its effect if it
     were the only control deployed).
  2. Apply a "marginal efficiency discount factor" to controls that
     overlap in scope with many other candidates targeting the same asset
     tier -- an overlap-based proxy for diminishing returns, since several
     controls hardening the same tier will realize less *combined* benefit
     than the sum of their standalone effects.
  3. Solve the MILP on these discounted, linear coefficients.
  4. Re-run the full Monte Carlo simulation once more with the *actual*
     selected control set turned on together, to report the true
     (non-linear) projected EAL and ROSI -- the MILP's linear objective is
     used purely to *select* a good portfolio, not to report the final
     numbers.
"""

from __future__ import annotations

from dataclasses import dataclass

import pulp
from sqlalchemy.orm import Session

from models import Asset, SecurityControl
from quant_engine import MonteCarloRiskEngine

# Discount strength: each additional overlapping control (same target tier,
# or "All"-scoped) reduces this control's linear objective coefficient by
# roughly this fraction, modeling saturating security returns.
OVERLAP_DISCOUNT_RATE = 0.12


@dataclass
class ControlMarginalValue:
    control: SecurityControl
    standalone_reduction_inr: float
    overlap_count: int
    discount_factor: float
    adjusted_value_inr: float


@dataclass
class OptimizationResult:
    selected_controls: list[SecurityControl]
    control_marginal_values: dict[str, ControlMarginalValue]
    total_spent_inr: float
    remaining_budget_inr: float
    baseline_eal_inr: float
    projected_eal_inr: float
    net_risk_reduction_inr: float
    rosi_percent: float


def _scope_overlaps(a: SecurityControl, b: SecurityControl) -> bool:
    """True if two controls' target tiers meaningfully overlap in scope."""
    if a.code == b.code:
        return False
    if a.target_tier == "All" or b.target_tier == "All":
        return True
    return a.target_tier == b.target_tier


def _compute_marginal_values(
    assets: list[Asset],
    candidate_controls: list[SecurityControl],
    baseline_eal_inr: float,
) -> dict[str, ControlMarginalValue]:
    """
    For each candidate control, runs a standalone Monte Carlo simulation
    with only that control active to measure its marginal ΔEAL, then
    applies the overlap-based diminishing-returns discount.
    """
    marginal_values: dict[str, ControlMarginalValue] = {}

    for control in candidate_controls:
        engine = MonteCarloRiskEngine(assets=assets, active_controls=[control])
        result = engine.run()
        standalone_reduction = max(baseline_eal_inr - result.total_eal_inr, 0.0)

        overlap_count = sum(
            1 for other in candidate_controls if _scope_overlaps(control, other)
        )
        discount_factor = 1.0 / (1.0 + OVERLAP_DISCOUNT_RATE * overlap_count)
        adjusted_value = standalone_reduction * discount_factor

        marginal_values[control.code] = ControlMarginalValue(
            control=control,
            standalone_reduction_inr=standalone_reduction,
            overlap_count=overlap_count,
            discount_factor=discount_factor,
            adjusted_value_inr=adjusted_value,
        )

    return marginal_values


def optimize_budget_allocation(
    db: Session,
    assets: list[Asset],
    candidate_controls: list[SecurityControl],
    budget_inr: float,
) -> OptimizationResult:
    """
    Solves the 0/1 knapsack MILP: maximize discounted ΔEAL subject to a
    total cost constraint, then re-simulates the chosen portfolio jointly
    to report true (non-linear) projected EAL and ROSI.
    """
    baseline_engine = MonteCarloRiskEngine(assets=assets, active_controls=[])
    baseline_result = baseline_engine.run()
    baseline_eal = baseline_result.total_eal_inr

    marginal_values = _compute_marginal_values(assets, candidate_controls, baseline_eal)

    # --- Build and solve the 0/1 knapsack MILP --------------------------- #
    problem = pulp.LpProblem("Security_Investment_Optimization", pulp.LpMaximize)

    decision_vars: dict[str, pulp.LpVariable] = {
        control.code: pulp.LpVariable(f"select_{control.code}", cat="Binary")
        for control in candidate_controls
    }

    # Objective: maximize total discounted risk reduction (ΔEAL, in ₹).
    problem += pulp.lpSum(
        decision_vars[control.code] * marginal_values[control.code].adjusted_value_inr
        for control in candidate_controls
    ), "Total_Discounted_Risk_Reduction"

    # Constraint: total deployment cost must not exceed the budget.
    problem += (
        pulp.lpSum(decision_vars[control.code] * control.cost_inr for control in candidate_controls)
        <= budget_inr,
        "Budget_Constraint",
    )

    solver = pulp.PULP_CBC_CMD(msg=False)
    problem.solve(solver)

    selected_controls = [
        control
        for control in candidate_controls
        if decision_vars[control.code].value() == 1
    ]
    total_spent = sum(c.cost_inr for c in selected_controls)

    # --- Re-simulate the actual joint portfolio for true reported numbers --#
    if selected_controls:
        joint_engine = MonteCarloRiskEngine(assets=assets, active_controls=selected_controls)
        joint_result = joint_engine.run()
        projected_eal = joint_result.total_eal_inr
    else:
        projected_eal = baseline_eal

    net_risk_reduction = baseline_eal - projected_eal
    rosi_percent = (
        ((net_risk_reduction - total_spent) / total_spent) * 100.0 if total_spent > 0 else 0.0
    )

    return OptimizationResult(
        selected_controls=selected_controls,
        control_marginal_values=marginal_values,
        total_spent_inr=total_spent,
        remaining_budget_inr=budget_inr - total_spent,
        baseline_eal_inr=baseline_eal,
        projected_eal_inr=projected_eal,
        net_risk_reduction_inr=net_risk_reduction,
        rosi_percent=rosi_percent,
    )
