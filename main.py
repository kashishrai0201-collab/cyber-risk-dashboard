"""
main.py
-------
FastAPI server exposing the CRQ platform's REST API.

Run with:
    uvicorn main:app --reload --port 8000

Interactive API docs are available at /docs once the server is running.
"""

from __future__ import annotations

import json

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import schemas
from compliance import generate_compliance_report
from database import get_db, init_db
from models import Asset, SecurityControl, SimulationRun
from optimizer import optimize_budget_allocation
from quant_engine import MonteCarloRiskEngine, run_enterprise_simulation
from seeder import seed_database

app = FastAPI(
    title="AI-Powered Continuous Cyber Risk Quantification (CRQ) Platform",
    description=(
        "Quantifies cyber risk in INR via Monte Carlo simulation, maps exposure to "
        "RBI CSF / SEBI CSCRF, and optimizes security investment under budget constraints."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    """Creates database tables on first launch if they do not already exist."""
    init_db()


# --------------------------------------------------------------------------- #
# Seeding
# --------------------------------------------------------------------------- #
@app.post("/api/seed", tags=["Admin"])
def seed(db: Session = Depends(get_db)) -> dict:
    """Seeds the database with synthetic enterprise assets, CVEs, and controls."""
    summary = seed_database(db)
    return {"status": "ok", "inserted": summary}


# --------------------------------------------------------------------------- #
# Assets
# --------------------------------------------------------------------------- #
@app.get("/api/assets", response_model=list[schemas.AssetRead], tags=["Assets"])
def list_assets(db: Session = Depends(get_db)) -> list[Asset]:
    """Returns all assets with their vulnerabilities and current estimated EAL."""
    assets = db.query(Asset).all()
    if not assets:
        return []

    active_controls = db.query(SecurityControl).filter(SecurityControl.is_active.is_(True)).all()
    engine = MonteCarloRiskEngine(assets=assets, active_controls=active_controls)
    result = engine.run()
    eal_by_asset_id = {r.asset_id: r.eal_inr for r in result.per_asset_results}

    output: list[schemas.AssetRead] = []
    for asset in assets:
        asset_read = schemas.AssetRead.model_validate(asset)
        asset_read.estimated_eal_inr = eal_by_asset_id.get(asset.id, 0.0)
        output.append(asset_read)
    return output


# --------------------------------------------------------------------------- #
# Enterprise Quantification
# --------------------------------------------------------------------------- #
@app.get(
    "/api/quantification/enterprise",
    response_model=schemas.EnterpriseRiskSummary,
    tags=["Quantification"],
)
def enterprise_quantification(db: Session = Depends(get_db)) -> schemas.EnterpriseRiskSummary:
    """
    Runs the full enterprise Monte Carlo simulation, logs the result to
    `SimulationRun`, and returns EAL, VaR 95/99, top-5 riskiest assets,
    regulatory fine exposure, and the loss exceedance curve.
    """
    assets = db.query(Asset).all()
    if not assets:
        raise HTTPException(status_code=400, detail="No assets found. Call POST /api/seed first.")

    active_controls = db.query(SecurityControl).filter(SecurityControl.is_active.is_(True)).all()
    result = run_enterprise_simulation(db, assets, active_controls, persist=True)

    top_5 = sorted(result.per_asset_results, key=lambda r: r.eal_inr, reverse=True)[:5]
    top_5_contributions = [
        schemas.AssetRiskContribution(
            asset_id=r.asset_id,
            hostname=r.hostname,
            tier=r.tier,
            asset_type=r.asset_type,
            eal_inr=round(r.eal_inr, 2),
            annual_event_frequency=r.annual_event_frequency,
        )
        for r in top_5
    ]

    engine = MonteCarloRiskEngine(assets=assets, active_controls=active_controls)
    curve_points = engine.loss_exceedance_curve(result.aggregate_loss_samples)

    latest_run = (
        db.query(SimulationRun).order_by(SimulationRun.timestamp.desc()).first()
    )

    return schemas.EnterpriseRiskSummary(
        total_eal_inr=round(result.total_eal_inr, 2),
        var_95_inr=round(result.var_95_inr, 2),
        var_99_inr=round(result.var_99_inr, 2),
        top_5_riskiest_assets=top_5_contributions,
        total_regulatory_fine_exposure_inr=round(result.total_regulatory_fine_exposure_inr, 2),
        loss_exceedance_curve=[
            schemas.LossExceedancePoint(return_period_years=t, loss_inr=round(loss, 2))
            for t, loss in curve_points
        ],
        simulation_iterations=result.iterations,
        generated_at=latest_run.timestamp if latest_run else __import__("datetime").datetime.utcnow(),
        unauthorized_subprocessor_count=result.unauthorized_subprocessor_count,
        shadow_leakage_exposure_inr=round(result.shadow_leakage_exposure_inr, 2),
        identified_leak_vectors=result.identified_leak_vectors,
    )


@app.get(
    "/api/lineage/flows",
    response_model=list[schemas.DataLineageFlowRead],
    tags=["Data Lineage & Provenance"],
)
def get_data_lineage_flows(db: Session = Depends(get_db)) -> list[schemas.DataLineageFlowRead]:
    """Returns all data provenance and transitive sub-processor delegation flows."""
    assets = db.query(Asset).all()
    if not assets:
        raise HTTPException(status_code=400, detail="No assets found. Call POST /api/seed first.")

    active_controls = db.query(SecurityControl).filter(SecurityControl.is_active.is_(True)).all()
    from graph_engine import AttackGraphEngine
    engine = AttackGraphEngine(assets=assets, session=db, active_controls=active_controls)
    flows, _ = engine.trace_transitive_data_lineage()
    return flows


@app.get(
    "/api/quantification/loss-exceedance",
    response_model=list[schemas.LossExceedancePoint],
    tags=["Quantification"],
)
def loss_exceedance_curve(db: Session = Depends(get_db)) -> list[schemas.LossExceedancePoint]:
    """Returns Loss Exceedance Curve data points for frontend plotting."""
    assets = db.query(Asset).all()
    if not assets:
        raise HTTPException(status_code=400, detail="No assets found. Call POST /api/seed first.")

    active_controls = db.query(SecurityControl).filter(SecurityControl.is_active.is_(True)).all()
    engine = MonteCarloRiskEngine(assets=assets, active_controls=active_controls)
    result = engine.run()
    curve_points = engine.loss_exceedance_curve(result.aggregate_loss_samples)

    return [
        schemas.LossExceedancePoint(return_period_years=t, loss_inr=round(loss, 2))
        for t, loss in curve_points
    ]


# --------------------------------------------------------------------------- #
# Budget Optimization
# --------------------------------------------------------------------------- #
@app.post(
    "/api/optimize/budget",
    response_model=schemas.OptimizationResponse,
    tags=["Optimization"],
)
def optimize_budget(
    request: schemas.BudgetOptimizationRequest, db: Session = Depends(get_db)
) -> schemas.OptimizationResponse:
    """
    Solves the 0/1 knapsack MILP for the given INR budget, activates the
    selected controls in the database, logs the run to `SimulationRun`,
    and returns the chosen portfolio with ROSI.
    """
    assets = db.query(Asset).all()
    if not assets:
        raise HTTPException(status_code=400, detail="No assets found. Call POST /api/seed first.")

    candidate_controls = db.query(SecurityControl).all()
    if not candidate_controls:
        raise HTTPException(status_code=400, detail="No security controls found. Call POST /api/seed first.")

    result = optimize_budget_allocation(db, assets, candidate_controls, request.budget_inr)

    selected_codes = {c.code for c in result.selected_controls}
    for control in candidate_controls:
        control.is_active = control.code in selected_codes
    db.commit()

    run_record = SimulationRun(
        total_eal_inr=result.projected_eal_inr,
        var_95_inr=0.0,
        var_99_inr=0.0,
        allocated_budget_inr=request.budget_inr,
        selected_controls_json=json.dumps(sorted(selected_codes)),
    )
    db.add(run_record)
    db.commit()

    recommendations = [
        schemas.ControlRecommendation(
            code=c.code,
            name=c.name,
            cost_inr=c.cost_inr,
            likelihood_reduction=c.likelihood_reduction,
            target_tier=c.target_tier,
            marginal_eal_reduction_inr=round(
                result.control_marginal_values[c.code].adjusted_value_inr, 2
            ),
        )
        for c in result.selected_controls
    ]

    return schemas.OptimizationResponse(
        budget_inr=request.budget_inr,
        selected_controls=recommendations,
        total_spent_inr=round(result.total_spent_inr, 2),
        remaining_budget_inr=round(result.remaining_budget_inr, 2),
        baseline_eal_inr=round(result.baseline_eal_inr, 2),
        projected_eal_inr=round(result.projected_eal_inr, 2),
        net_risk_reduction_inr=round(result.net_risk_reduction_inr, 2),
        rosi_percent=round(result.rosi_percent, 2),
    )


# --------------------------------------------------------------------------- #
# Compliance
# --------------------------------------------------------------------------- #
@app.get(
    "/api/compliance/status",
    response_model=schemas.FrameworkComplianceReport,
    tags=["Compliance"],
)
def compliance_status(db: Session = Depends(get_db)) -> schemas.FrameworkComplianceReport:
    """Returns RBI CSF / SEBI CSCRF / NIST CSF 2.0 compliance scores and gaps."""
    return generate_compliance_report(db)


# --------------------------------------------------------------------------- #
# Simulation History
# --------------------------------------------------------------------------- #
@app.get(
    "/api/simulations/history",
    response_model=list[schemas.SimulationRunRead],
    tags=["Quantification"],
)
def simulation_history(db: Session = Depends(get_db)) -> list[SimulationRun]:
    """Returns all past simulation runs, most recent first."""
    return db.query(SimulationRun).order_by(SimulationRun.timestamp.desc()).all()


@app.get("/", tags=["Admin"])
def root() -> dict:
    """Basic health-check / welcome route."""
    return {
        "service": "CRQ Platform API",
        "docs": "/docs",
        "status": "running",
    }
