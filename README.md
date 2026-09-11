# AI-Powered Continuous Cyber Risk Quantification (CRQ) & Investment Optimization Platform

Quantifies enterprise cyber risk in Indian Rupees (₹), computes Expected Annual Loss (EAL)
and Value at Risk (VaR) via Monte Carlo simulation, maps exposure to RBI CSF / SEBI CSCRF /
NIST CSF 2.0, and solves a budget-constrained security investment optimization problem
(0/1 knapsack via Integer Linear Programming).

## Quick start

```bash
pip install -r requirements.txt --break-system-packages   # or use a virtualenv

# Option A: standalone terminal demo (no server needed)
python run_simulation.py

# Option B: full REST API
uvicorn main:app --reload --port 8000
# then open http://127.0.0.1:8000/docs for interactive Swagger UI
```

The first run creates `cyber_risk.db` (SQLite) in the working directory and is safe to
re-run — seeding is idempotent.

## Architecture

| Module | Responsibility |
|---|---|
| `database.py` | SQLAlchemy 2.0 engine, `SessionLocal`, `get_db` FastAPI dependency |
| `models.py` | ORM models: `Asset`, `Vulnerability`, `SecurityControl`, `SimulationRun` |
| `schemas.py` | Pydantic v2 request/response DTOs |
| `seeder.py` | Idempotent synthetic telemetry generator (18 assets, 48 CVEs, 15 controls) |
| `graph_engine.py` | NetworkX attack graph; computes path exposure coefficient per asset |
| `quant_engine.py` | Logistic-sigmoid likelihood calibration, financial impact modeling (outage, breach, DPDPA/RBI/SEBI penalties, forensics), vectorized compound-Poisson Monte Carlo (10,000 iterations) |
| `optimizer.py` | PuLP 0/1 knapsack MILP for budget-constrained control selection, with an overlap-based diminishing-returns discount and ROSI computation |
| `compliance.py` | Maps active controls to RBI CSF / SEBI CSCRF / NIST CSF 2.0 categories and reports gaps |
| `main.py` | FastAPI REST server wiring all of the above together |
| `run_simulation.py` | Standalone CLI runner exercising the full pipeline end-to-end |

## API summary

- `POST /api/seed` — seed the database
- `GET /api/assets` — assets + vulnerabilities + per-asset EAL
- `GET /api/quantification/enterprise` — EAL, VaR95/99, top-5 riskiest assets, regulatory exposure, loss exceedance curve (also logs a `SimulationRun`)
- `GET /api/quantification/loss-exceedance` — loss exceedance curve only
- `POST /api/optimize/budget` — `{"budget_inr": float}` → optimal control portfolio + ROSI (also activates the chosen controls and logs a `SimulationRun`)
- `GET /api/compliance/status` — framework compliance scores and gaps
- `GET /api/simulations/history` — all past `SimulationRun` records

## Modeling notes (for the AIML reviewers)

- **Likelihood**: each asset's annual breach frequency (λ, a Poisson rate) is calibrated
  from its *worst* unpatched vulnerability's `CVSS + 10·EPSS + 10·GraphExposure` score
  through a logistic-sigmoid link, with a small additive bonus per extra unpatched CVE
  (avoiding runaway multiplicative compounding across many CVEs), then capped by a
  tier-specific maximum realistic annual frequency. Active controls reduce λ
  multiplicatively via `(1 - likelihood_reduction)`.
- **Severity**: each simulated event's loss is a composite of Beta-PERT-distributed
  downtime cost, a Beta-PERT breach-fraction applied to PII/financial record costs, a
  DPDPA-2023-style penalty (log-normal regulator-discretion multiplier), an RBI/SEBI fine
  gated on regulated status and reportable downtime, and a uniform forensics/IR cost.
- **Monte Carlo**: a vectorized compound-Poisson process — for each asset, `n_iterations`
  Poisson draws give the event count per simulated year; a matrix of candidate severities
  is masked per iteration and summed, avoiding Python-level event loops.
- **Optimizer**: the MILP objective uses each control's *standalone* marginal ΔEAL
  (from an isolated Monte Carlo run), discounted by an overlap factor when multiple
  candidates target the same asset tier, to keep the objective linear despite the
  underlying multiplicative risk model. The final reported ΔEAL/ROSI comes from a joint
  re-simulation of the actually selected portfolio.

## For the CSE-core reviewers

- Explicit SQLAlchemy 2.0 `Mapped[...]` declarative models with real foreign keys,
  cascading deletes (`Vulnerability` cascades from `Asset`), and `lazy="selectin"`
  eager loading for the nested vulnerability relationship.
- Session lifecycle is dependency-injected via `get_db()` for FastAPI and used directly
  with `SessionLocal()` in the standalone CLI runner.
- Pydantic v2 schemas are strict on `*Create` DTOs (`extra="forbid"`) and use
  `from_attributes=True` for ORM-to-DTO reads.
