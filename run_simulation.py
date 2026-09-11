"""
run_simulation.py
------------------
Standalone terminal runner for the CRQ platform. Executes the full pipeline
end-to-end against the SQLite database, without needing the FastAPI server:

    1. Initializes the SQLite database (creates tables if missing).
    2. Seeds synthetic enterprise data (idempotent).
    3. Runs a 10,000-iteration Monte Carlo simulation and prints the
       aggregate Enterprise Risk (EAL, VaR 95/99) in ₹.
    4. Runs the PuLP budget optimizer for a ₹50,00,000 budget and prints
       the chosen controls, total spent, and ROSI.
    5. Verifies the run was persisted to `SimulationRun` by querying SQLite
       directly and printing the stored record.

Usage:
    python run_simulation.py
"""

from __future__ import annotations

from database import SessionLocal, init_db
from models import Asset, SecurityControl, SimulationRun
from optimizer import optimize_budget_allocation
from quant_engine import run_enterprise_simulation
from seeder import seed_database

DEMO_BUDGET_INR = 5_000_000.0  # ₹50,00,000


def _format_inr(amount: float) -> str:
    """Formats a rupee amount with Indian-style comma grouping, e.g. ₹1,23,45,678.90."""
    is_negative = amount < 0
    amount = abs(amount)
    integer_part, _, decimal_part = f"{amount:.2f}".partition(".")

    if len(integer_part) > 3:
        last_three = integer_part[-3:]
        remaining = integer_part[:-3]
        grouped = []
        while len(remaining) > 2:
            grouped.insert(0, remaining[-2:])
            remaining = remaining[:-2]
        if remaining:
            grouped.insert(0, remaining)
        integer_part = ",".join(grouped + [last_three])

    sign = "-" if is_negative else ""
    return f"{sign}₹{integer_part}.{decimal_part}"


def main() -> None:
    print("=" * 78)
    print(" AI-Powered Continuous Cyber Risk Quantification (CRQ) Platform")
    print(" Standalone Simulation Runner")
    print("=" * 78)

    # --- Step 1: Initialize database ------------------------------------- #
    print("\n[1/5] Initializing SQLite database (cyber_risk.db)...")
    init_db()
    print("      Tables created/verified.")

    db = SessionLocal()
    try:
        # --- Step 2: Seed synthetic data ---------------------------------- #
        print("\n[2/5] Seeding synthetic enterprise telemetry...")
        summary = seed_database(db)
        print(
            f"      Inserted: {summary['assets']} assets, "
            f"{summary['vulnerabilities']} vulnerabilities, "
            f"{summary['controls']} security controls "
            "(0 values mean already seeded)."
        )

        assets = db.query(Asset).all()
        all_controls = db.query(SecurityControl).all()
        print(f"      Total assets in DB: {len(assets)} | Total controls in DB: {len(all_controls)}")

        # --- Step 3: Monte Carlo enterprise risk simulation ---------------- #
        print("\n[3/5] Running 10,000-iteration Monte Carlo enterprise risk simulation...")
        active_controls = [c for c in all_controls if c.is_active]
        result = run_enterprise_simulation(db, assets, active_controls, persist=True)

        print(f"      Expected Annual Loss (EAL):     {_format_inr(result.total_eal_inr)}")
        print(f"      Value at Risk (95% confidence):  {_format_inr(result.var_95_inr)}")
        print(f"      Value at Risk (99% confidence):  {_format_inr(result.var_99_inr)}")
        print(
            f"      Estimated Regulatory Fine Exposure (95th pct): "
            f"{_format_inr(result.total_regulatory_fine_exposure_inr)}"
        )

        print("\n      Top 5 riskiest assets by EAL:")
        top_5 = sorted(result.per_asset_results, key=lambda r: r.eal_inr, reverse=True)[:5]
        for rank, r in enumerate(top_5, start=1):
            print(
                f"        {rank}. {r.hostname:<24} ({r.tier:<8}) "
                f"lambda={r.annual_event_frequency:5.2f}/yr  EAL={_format_inr(r.eal_inr)}"
            )

        # --- Step 4: Budget-constrained optimization ------------------------ #
        print(f"\n[4/5] Running PuLP 0/1 knapsack budget optimizer for {_format_inr(DEMO_BUDGET_INR)}...")
        opt_result = optimize_budget_allocation(db, assets, all_controls, DEMO_BUDGET_INR)

        selected_codes = {c.code for c in opt_result.selected_controls}
        for control in all_controls:
            control.is_active = control.code in selected_codes
        db.commit()

        print(f"      Baseline EAL:   {_format_inr(opt_result.baseline_eal_inr)}")
        print(f"      Projected EAL:  {_format_inr(opt_result.projected_eal_inr)}")
        print(f"      Net Risk Reduction (Delta EAL): {_format_inr(opt_result.net_risk_reduction_inr)}")
        print(f"      Total Spent:    {_format_inr(opt_result.total_spent_inr)}")
        print(f"      Remaining Budget: {_format_inr(opt_result.remaining_budget_inr)}")
        print(f"      ROSI: {opt_result.rosi_percent:.2f}%")
        print("\n      Selected controls:")
        for control in opt_result.selected_controls:
            mv = opt_result.control_marginal_values[control.code]
            print(
                f"        - {control.code:<24} {control.name:<48} "
                f"cost={_format_inr(control.cost_inr):>18}  "
                f"marginal_dEAL={_format_inr(mv.adjusted_value_inr)}"
            )

        # Persist the optimizer run as well.
        import json as _json

        opt_run_record = SimulationRun(
            total_eal_inr=opt_result.projected_eal_inr,
            var_95_inr=result.var_95_inr,
            var_99_inr=result.var_99_inr,
            allocated_budget_inr=DEMO_BUDGET_INR,
            selected_controls_json=_json.dumps(sorted(selected_codes)),
        )
        db.add(opt_run_record)
        db.commit()
        db.refresh(opt_run_record)

        # --- Step 5: Verify persistence ------------------------------------- #
        print("\n[5/5] Verifying SimulationRun persistence in SQLite...")
        stored_run = (
            db.query(SimulationRun)
            .order_by(SimulationRun.timestamp.desc())
            .first()
        )
        if stored_run is None:
            print("      ERROR: No SimulationRun record found!")
        else:
            print("      Latest stored SimulationRun record:")
            print(f"        id                     = {stored_run.id}")
            print(f"        timestamp              = {stored_run.timestamp}")
            print(f"        total_eal_inr          = {_format_inr(stored_run.total_eal_inr)}")
            print(f"        var_95_inr             = {_format_inr(stored_run.var_95_inr)}")
            print(f"        var_99_inr             = {_format_inr(stored_run.var_99_inr)}")
            print(f"        allocated_budget_inr   = {_format_inr(stored_run.allocated_budget_inr or 0.0)}")
            print(f"        selected_controls_json = {stored_run.selected_controls_json}")

        total_runs = db.query(SimulationRun).count()
        print(f"\n      Total SimulationRun records in database: {total_runs}")

    finally:
        db.close()

    print("\n" + "=" * 78)
    print(" Simulation complete.")
    print("=" * 78)


if __name__ == "__main__":
    main()
