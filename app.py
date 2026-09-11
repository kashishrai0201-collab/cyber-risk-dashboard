"""
app.py
------
Production-grade Streamlit frontend dashboard for the AI-Powered Continuous
Cyber Risk Quantification (CRQ) Platform.

Connects to the FastAPI backend (default: http://127.0.0.1:8000) and exposes:
- Tab 1: Executive Risk Overview (EAL, VaR 95/99, Loss Exceedance Curve, Riskiest Assets)
- Tab 2: Budget Optimization (MILP Knapsack solver with ROSI and control recommendations)
- Tab 3: Regulatory Compliance (RBI CSF, SEBI CSCRF, NIST CSF 2.0 readiness & gap analysis)
- Tab 4: Asset Inventory (Enterprise IT/OT telemetry, vulnerabilities, and financial loss rates)
"""

from __future__ import annotations

import json
from typing import Any

import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import requests
import streamlit as st

# --------------------------------------------------------------------------- #
# Page Configuration & Global Styling
# --------------------------------------------------------------------------- #
st.set_page_config(
    page_title="Cyber Risk Quantification Platform",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom CSS for executive-grade aesthetics and high-contrast rendering
st.markdown(
    """
    <style>
    /* Metric Card container styling - Explicit light container */
    div[data-testid="stMetric"] {
        background: #FFFFFF !important;
        border: 1px solid #E2E8F0 !important;
        border-radius: 10px !important;
        padding: 16px 20px !important;
        box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06) !important;
        transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease !important;
    }
    div[data-testid="stMetric"]:hover {
        border-color: #CBD5E1 !important;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.10) !important;
        transform: translateY(-2px);
    }
    div[data-testid="stMetricLabel"] {
        font-size: 0.88rem !important;
        font-weight: 600 !important;
        color: #475569 !important;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    div[data-testid="stMetricLabel"] p,
    div[data-testid="stMetricLabel"] label,
    div[data-testid="stMetricLabel"] > div {
        color: #475569 !important;
    }
    div[data-testid="stMetricValue"] {
        font-size: 1.85rem !important;
        font-weight: 700 !important;
        color: #0F172A !important;
    }
    div[data-testid="stMetricValue"] > div,
    div[data-testid="stMetricValue"] span {
        color: #0F172A !important;
    }
    
    /* Explicit delta tag styling */
    div[data-testid="stMetricDelta"] {
        font-weight: 600 !important;
    }
    div[data-testid="stMetricDelta"] svg {
        fill: currentColor !important;
    }
    div[data-testid="stMetricDelta"] svg[data-testid="stMetricDeltaIcon-Up"],
    div[data-testid="stMetricDelta"]:has(svg[data-testid="stMetricDeltaIcon-Up"]),
    div[data-testid="stMetricDelta"]:has(svg[data-testid="stMetricDeltaIcon-Up"]) > div {
        color: #16A34A !important;
    }
    div[data-testid="stMetricDelta"] svg[data-testid="stMetricDeltaIcon-Down"],
    div[data-testid="stMetricDelta"]:has(svg[data-testid="stMetricDeltaIcon-Down"]),
    div[data-testid="stMetricDelta"]:has(svg[data-testid="stMetricDeltaIcon-Down"]) > div {
        color: #DC2626 !important;
    }
    
    /* Gaps & Alert Callout Box - High Contrast */
    .gap-card {
        background: #FEF2F2 !important;
        border: 1px solid #FCA5A5 !important;
        border-left: 4px solid #DC2626 !important;
        border-radius: 8px;
        padding: 14px 18px;
        margin-bottom: 12px;
        box-shadow: 0 1px 3px rgba(153, 27, 27, 0.05);
    }
    .gap-header {
        font-weight: 700;
        font-size: 0.95rem;
        color: #991B1B !important;
        display: flex;
        justify-content: space-between;
    }
    .gap-desc {
        color: #7F1D1D !important;
        font-size: 0.88rem;
        margin-top: 6px;
        line-height: 1.4;
    }
    .gap-controls {
        margin-top: 8px;
        font-size: 0.82rem;
        color: #991B1B !important;
        font-weight: 500;
    }
    .gap-controls b {
        color: #7F1D1D !important;
    }
    
    /* Tier Badges */
    .badge-critical {
        background-color: rgba(239, 68, 68, 0.12);
        color: #DC2626;
        border: 1px solid rgba(239, 68, 68, 0.35);
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 600;
    }
    .badge-medium {
        background-color: rgba(245, 158, 11, 0.12);
        color: #D97706;
        border: 1px solid rgba(245, 158, 11, 0.35);
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 600;
    }
    .badge-low {
        background-color: rgba(16, 185, 129, 0.12);
        color: #059669;
        border: 1px solid rgba(16, 185, 129, 0.35);
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 600;
    }
    </style>
    """,
    unsafe_allow_html=True,
)



# --------------------------------------------------------------------------- #
# Helper Functions: Currency Formatting & Safe HTTP Client
# --------------------------------------------------------------------------- #
def format_inr(value: float | int | None) -> str:
    """
    Formats a raw numeric value into Rupee notation:
    - Crores (₹ Cr) for values >= ₹1,00,00,000 (10M)
    - Lakhs (₹ L) for values >= ₹1,00,000 (100K)
    - Indian comma grouping for smaller numbers
    """
    if value is None:
        return "₹0.00"
    
    val = float(value)
    sign = "-" if val < 0 else ""
    abs_val = abs(val)

    if abs_val >= 10_000_000:
        return f"{sign}₹{abs_val / 10_000_000:.2f} Cr"
    elif abs_val >= 100_000:
        return f"{sign}₹{abs_val / 100_000:.2f} L"
    elif abs_val >= 1_000:
        integer_part, _, decimal_part = f"{abs_val:.2f}".partition(".")
        if len(integer_part) > 3:
            last_three = integer_part[-3:]
            remaining = integer_part[:-3]
            groups = []
            while len(remaining) > 2:
                groups.insert(0, remaining[-2:])
                remaining = remaining[:-2]
            if remaining:
                groups.insert(0, remaining)
            formatted = ",".join(groups + [last_three])
        else:
            formatted = integer_part
        return f"{sign}₹{formatted}.{decimal_part}"
    else:
        return f"{sign}₹{abs_val:.2f}"


def safe_get(url: str, params: dict[str, Any] | None = None, timeout: float = 12.0) -> tuple[bool, Any, str]:
    """
    Executes a safe GET request with custom timeout and structured error handling.
    Returns: (is_success, response_json_or_none, error_message_string)
    """
    try:
        response = requests.get(url, params=params, timeout=timeout)
        if response.status_code == 200:
            return True, response.json(), ""
        else:
            detail = ""
            try:
                detail = response.json().get("detail", response.text)
            except Exception:
                detail = response.text
            return False, None, f"HTTP {response.status_code}: {detail}"
    except requests.exceptions.ConnectionError:
        return False, None, f"Connection refused to backend at {url}. Ensure FastAPI is running."
    except requests.exceptions.Timeout:
        return False, None, f"Request timed out after {timeout}s while connecting to {url}."
    except requests.exceptions.RequestException as exc:
        return False, None, f"Network error: {str(exc)}"


def safe_post(url: str, json_data: dict[str, Any] | None = None, timeout: float = 60.0) -> tuple[bool, Any, str]:
    """
    Executes a safe POST request with custom timeout (default 60s) and structured error handling.
    Returns: (is_success, response_json_or_none, error_message_string)
    """
    try:
        response = requests.post(url, json=json_data, timeout=timeout)
        if response.status_code == 200:
            return True, response.json(), ""
        else:
            detail = ""
            try:
                detail = response.json().get("detail", response.text)
            except Exception:
                detail = response.text
            return False, None, f"HTTP {response.status_code}: {detail}"
    except requests.exceptions.ConnectionError:
        return False, None, f"Connection refused to backend at {url}. Ensure FastAPI is running."
    except requests.exceptions.Timeout:
        return False, None, f"Request timed out after {timeout}s while connecting to {url}."
    except requests.exceptions.RequestException as exc:
        return False, None, f"Network error: {str(exc)}"


@st.cache_data(ttl=300)
def get_cached_budget_optimization(
    backend_url: str, budget_inr: float
) -> tuple[bool, Any, str]:
    """
    Caches budget solver responses keyed on budget_inr with 5-minute TTL
    to prevent redundant backend solves on previously queried spend limits.
    """
    return safe_post(
        f"{backend_url}/api/optimize/budget",
        json_data={"budget_inr": float(budget_inr)},
        timeout=60.0,
    )


# --------------------------------------------------------------------------- #
# Sidebar: Configuration & Health Telemetry
# --------------------------------------------------------------------------- #
with st.sidebar:
    st.markdown("### 🛡️ CRQ Platform")
    st.caption("AI-Powered Continuous Cyber Risk Quantification")
    st.markdown("---")

    backend_url = st.text_input(
        "FastAPI Backend URL",
        value="http://127.0.0.1:8000",
        help="Base URL of the FastAPI server providing quantification and optimization APIs.",
    ).rstrip("/")

    # Check connection health
    is_healthy, health_data, health_err = safe_get(f"{backend_url}/", timeout=3.0)

    if is_healthy:
        st.success("🟢 **Backend Connected**")
        with st.expander("Server Telemetry", expanded=False):
            st.json(health_data)
    else:
        st.error("🔴 **Backend Offline**")
        st.caption(f"`{health_err}`")
        st.info("Start the API server via:\n```bash\nuvicorn main:app --reload --port 8000\n```")

    st.markdown("---")
    st.markdown("#### Database Administration")
    if st.button("🌱 Seed Synthetic Telemetry", use_container_width=True):
        with st.spinner("Seeding enterprise database..."):
            ok, seed_res, seed_err = safe_post(f"{backend_url}/api/seed", timeout=60.0)
            if ok:
                st.toast("Database seeded successfully!", icon="✅")
                st.cache_data.clear()
                st.rerun()
            else:
                st.error(f"Seeding failed: {seed_err}")

    if st.button("📥 Ingest Kaggle CVE Dataset", use_container_width=True):
        with st.spinner("Ingesting Kaggle CVE, CISA KEV & EPSS dataset..."):
            ok, kaggle_res, kaggle_err = safe_post(
                f"{backend_url}/api/seed/kaggle", timeout=60.0
            )
            if ok:
                count = kaggle_res.get("vulnerabilities_ingested", 0)
                mapped = len(kaggle_res.get("mapped_assets", []))
                st.toast(
                    f"Ingested {count} Kaggle CVEs across {mapped} assets!",
                    icon="✅",
                )
                st.cache_data.clear()
                st.rerun()
            else:
                st.error(f"Kaggle ingestion failed: {kaggle_err}")

    if st.button("🔄 Refresh Application Data", use_container_width=True):
        st.cache_data.clear()
        st.rerun()


    st.markdown("---")
    st.caption("Standards: RBI CSF • SEBI CSCRF • NIST CSF 2.0")


# --------------------------------------------------------------------------- #
# Main Header
# --------------------------------------------------------------------------- #
st.title("🛡️ Cyber Risk Quantification Platform")
st.markdown(
    "Enterprise financial loss modeling via **Monte Carlo simulations**, "
    "**Dijkstra attack path exposure**, and **MILP budget optimization**."
)

# --------------------------------------------------------------------------- #
# Application Tabs
# --------------------------------------------------------------------------- #
tab1, tab2, tab3, tab4 = st.tabs(
    [
        "📊 Executive Risk Overview",
        "🎯 Budget Optimization",
        "⚖️ Regulatory Compliance",
        "🖥️ Asset Inventory & Lineage",
    ]
)


# =========================================================================== #
# TAB 1: EXECUTIVE RISK OVERVIEW
# =========================================================================== #
with tab1:
    st.markdown("### 📈 Enterprise Financial Risk Exposure")
    st.caption("Aggregate loss metrics quantified in INR (₹) across 10,000 Monte Carlo stochastic scenarios.")

    ok, summary_data, err = safe_get(f"{backend_url}/api/quantification/enterprise")

    if not ok:
        st.warning(f"⚠️ Unable to load enterprise quantification: {err}")
        if "No assets found" in (err or ""):
            st.info("The database appears empty. Click **'Seed Synthetic Telemetry'** in the sidebar to populate initial data.")
    else:
        # Indirect Data Leak Detection Alert Callout
        unauth_leaks = [
            f for f in summary_data.get("identified_leak_vectors", [])
            if (not f.get("is_authorized", True) or not f.get("has_user_consent", True) or "Unauthorized" in f.get("detection_status", ""))
        ]
        if unauth_leaks or summary_data.get("unauthorized_subprocessor_count", 0) > 0:
            first_leak = unauth_leaks[0] if unauth_leaks else {}
            origin_h = first_leak.get("origin_hostname", "cust-db-primary")
            inter_h = first_leak.get("intermediary_hostname", "analytics-integration-gw")
            dest_h = first_leak.get("destination_hostname", "third-party-marketing-sync")
            st.error(
                f"⚠️ **Indirect Data Leak Detected:** Node C (`{dest_h}`) is exfiltrating records originating "
                f"from Node A (`{origin_h}`) via unauthorized delegation through Node B (`{inter_h}`)."
            )

        # Top KPI Metric Cards
        col1, col2, col3, col4, col5 = st.columns(5)
        
        with col1:
            st.metric(
                label="Expected Annual Loss (EAL)",
                value=format_inr(summary_data.get("total_eal_inr")),
                help="Mean annualized financial loss across direct disruption, data theft, and response costs.",
            )
        with col2:
            st.metric(
                label="95% Value at Risk (VaR 95)",
                value=format_inr(summary_data.get("var_95_inr")),
                help="Maximum expected loss within a single year at a 95% confidence level (1-in-20 year loss).",
            )
        with col3:
            st.metric(
                label="99% Value at Risk (VaR 99)",
                value=format_inr(summary_data.get("var_99_inr")),
                help="Severe catastrophic single-year loss threshold at a 99% confidence level (1-in-100 year event).",
            )
        with col4:
            st.metric(
                label="Regulatory Fine Exposure",
                value=format_inr(summary_data.get("total_regulatory_fine_exposure_inr")),
                help="Total statutory penalty exposure under RBI CSF, SEBI CSCRF, and DPDP Act provisions.",
            )
        with col5:
            shadow_exp = summary_data.get("shadow_leakage_exposure_inr", 0.0)
            unauth_cnt = summary_data.get("unauthorized_subprocessor_count", 0)
            st.metric(
                label="Shadow Leakage Risk Exposure",
                value=format_inr(shadow_exp),
                delta=f"{unauth_cnt} Unauthorized Leak{'s' if unauth_cnt != 1 else ''}" if unauth_cnt > 0 else "0 Leaks",
                delta_color="inverse" if unauth_cnt > 0 else "normal",
                help="Annualized financial loss exposure attributable to unauthorized third-party sub-processor delegation and indirect data leakage under DPDPA Section 8(4).",
            )

        st.markdown("---")

        # Visualizations: Loss Exceedance Curve & Riskiest Assets
        chart_col1, chart_col2 = st.columns([3, 2])

        with chart_col1:
            st.markdown("#### Loss Exceedance Curve (LEC)")
            st.caption("Probability of enterprise losses exceeding designated financial thresholds over varying return horizons.")

            lec_points = summary_data.get("loss_exceedance_curve", [])
            if lec_points:
                df_lec = pd.DataFrame(lec_points)
                df_lec["loss_formatted"] = df_lec["loss_inr"].apply(format_inr)

                fig_lec = go.Figure()
                fig_lec.add_trace(
                    go.Scatter(
                        x=df_lec["return_period_years"],
                        y=df_lec["loss_inr"],
                        mode="lines+markers",
                        name="Aggregate Loss Exceedance",
                        line=dict(color="#6366F1", width=3),
                        marker=dict(size=7, color="#818CF8"),
                        fill="tozeroy",
                        fillcolor="rgba(99, 102, 241, 0.12)",
                        hovertemplate="<b>Return Period:</b> %{x} Years<br><b>Loss:</b> %{customdata}<extra></extra>",
                        customdata=df_lec["loss_formatted"],
                    )
                )
                fig_lec.update_layout(
                    template="plotly_white",
                    paper_bgcolor="#FFFFFF",
                    plot_bgcolor="#FFFFFF",
                    font=dict(color="#1E293B"),
                    margin=dict(l=20, r=20, t=30, b=30),
                    xaxis=dict(
                        title="Return Period (Years)",
                        showgrid=True,
                        gridcolor="#E2E8F0",
                        color="#1E293B",
                        type="log",
                    ),
                    yaxis=dict(
                        title="Loss Threshold (₹)",
                        showgrid=True,
                        gridcolor="#E2E8F0",
                        color="#1E293B",
                    ),
                    height=360,
                )
                st.plotly_chart(fig_lec, use_container_width=True)
            else:
                st.info("No loss exceedance curve data available.")

        with chart_col2:
            st.markdown("#### Top Riskiest Assets by Criticality")
            st.caption("Assets contributing highest individual Expected Annual Loss (EAL) in ₹.")

            top_assets = summary_data.get("top_5_riskiest_assets", [])
            if top_assets:
                df_top = pd.DataFrame(top_assets)
                df_top["formatted_eal"] = df_top["eal_inr"].apply(format_inr)

                color_map = {
                    "Critical": "#EF4444",
                    "Medium": "#F59E0B",
                    "Low": "#10B981",
                }

                fig_top = px.bar(
                    df_top,
                    x="eal_inr",
                    y="hostname",
                    orientation="h",
                    color="tier",
                    color_discrete_map=color_map,
                    labels={"eal_inr": "EAL (₹)", "hostname": "Asset", "tier": "Tier"},
                    hover_data={
                        "eal_inr": False,
                        "formatted_eal": True,
                        "asset_type": True,
                        "annual_event_frequency": ":.3f",
                    },
                )
                fig_top.update_layout(
                    template="plotly_white",
                    paper_bgcolor="#FFFFFF",
                    plot_bgcolor="#FFFFFF",
                    font=dict(color="#1E293B"),
                    margin=dict(l=20, r=20, t=30, b=30),
                    xaxis=dict(showgrid=True, gridcolor="#E2E8F0", color="#1E293B"),
                    yaxis=dict(autorange="reversed", color="#1E293B"),
                    height=360,
                    showlegend=True,
                    legend=dict(
                        orientation="h",
                        yanchor="bottom",
                        y=1.02,
                        xanchor="right",
                        x=1,
                        font=dict(color="#1E293B"),
                    ),
                )
                st.plotly_chart(fig_top, use_container_width=True)
            else:
                st.info("No asset risk contributions returned.")


# =========================================================================== #
# TAB 2: BUDGET OPTIMIZATION (MILP KNAPSACK)
# =========================================================================== #
with tab2:
    st.markdown("### 🎯 Security Budget Allocation & Knapsack Optimization")
    st.caption("Solves a 0/1 Mixed-Integer Linear Program (MILP) to identify the optimal security investments maximizing ROSI under budget caps.")

    if "current_budget" not in st.session_state:
        st.session_state["current_budget"] = 5_000_000

    # Budget Optimization Form to eliminate slider request flooding
    with st.form("budget_optimization_form"):
        slider_col, _ = st.columns([3, 1])
        with slider_col:
            selected_budget = st.slider(
                "Target Security Investment Budget (₹)",
                min_value=500_000,
                max_value=15_000_000,
                value=int(st.session_state["current_budget"]),
                step=500_000,
                format="%d",
                help="Select budget ceiling for PuLP Mixed Integer Linear Programming solver.",
            )
            st.markdown(f"**Selected Spend Limit:** `{format_inr(selected_budget)}`")

        submitted = st.form_submit_button("🚀 Run Portfolio Optimization", type="primary")
        if submitted:
            st.session_state["current_budget"] = selected_budget

    active_budget = float(st.session_state["current_budget"])

    # Trigger optimization with client-side caching
    with st.spinner("Solving Mixed Integer Linear Program (MILP)..."):
        opt_ok, opt_data, opt_err = get_cached_budget_optimization(
            backend_url, active_budget
        )

    if not opt_ok:
        st.warning(f"⚠️ Optimization failed: {opt_err}")
    else:
        # Optimization Metrics
        m1, m2, m3, m4 = st.columns(4)
        with m1:
            st.metric(
                label="Total Capital Deployed",
                value=format_inr(opt_data.get("total_spent_inr")),
                delta=f"Remaining: {format_inr(opt_data.get('remaining_budget_inr'))}",
                delta_color="off",
            )
        with m2:
            st.metric(
                label="Baseline EAL (Pre-Investment)",
                value=format_inr(opt_data.get("baseline_eal_inr")),
            )
        with m3:
            st.metric(
                label="Net Risk Reduction (ΔEAL)",
                value=format_inr(opt_data.get("net_risk_reduction_inr")),
                delta=f"-{format_inr(opt_data.get('net_risk_reduction_inr'))}",
                delta_color="inverse",
            )
        with m4:
            st.metric(
                label="Return on Security Investment (ROSI)",
                value=f"{opt_data.get('rosi_percent', 0.0):.1f}%",
                help="Net Risk Reduction minus Capital Cost divided by Capital Cost.",
            )

        st.markdown("---")

        # Portfolio Comparison Chart & Selected Controls Table
        p_col1, p_col2 = st.columns([2, 3])

        with p_col1:
            st.markdown("#### Portfolio Risk Reduction Comparison")
            comp_df = pd.DataFrame(
                [
                    {"Stage": "Baseline Risk", "Amount": opt_data.get("baseline_eal_inr", 0)},
                    {"Stage": "Projected Risk", "Amount": opt_data.get("projected_eal_inr", 0)},
                    {"Stage": "Capital Deployed", "Amount": opt_data.get("total_spent_inr", 0)},
                ]
            )
            comp_df["Formatted"] = comp_df["Amount"].apply(format_inr)

            fig_comp = px.bar(
                comp_df,
                x="Stage",
                y="Amount",
                color="Stage",
                color_discrete_sequence=["#EF4444", "#10B981", "#6366F1"],
                text="Formatted",
            )
            fig_comp.update_layout(
                template="plotly_white",
                paper_bgcolor="#FFFFFF",
                plot_bgcolor="#FFFFFF",
                font=dict(color="#1E293B"),
                showlegend=False,
                height=350,
                yaxis=dict(title="INR (₹)", showgrid=True, gridcolor="#E2E8F0", color="#1E293B"),
                xaxis=dict(color="#1E293B"),
                margin=dict(l=10, r=10, t=20, b=20),
            )
            st.plotly_chart(fig_comp, use_container_width=True)

        with p_col2:
            st.markdown("#### Recommended Security Controls")
            controls = opt_data.get("selected_controls", [])
            if controls:
                df_ctrl = pd.DataFrame(controls)
                df_ctrl["Cost"] = df_ctrl["cost_inr"].apply(format_inr)
                df_ctrl["Efficacy"] = df_ctrl["likelihood_reduction"].apply(lambda v: f"{v*100:.0f}%")
                df_ctrl["Marginal Benefit"] = df_ctrl["marginal_eal_reduction_inr"].apply(format_inr)

                display_df = df_ctrl[["code", "name", "target_tier", "Cost", "Efficacy", "Marginal Benefit"]].rename(
                    columns={
                        "code": "Code",
                        "name": "Control Name",
                        "target_tier": "Scope",
                    }
                )
                st.dataframe(display_df, use_container_width=True, hide_index=True)
            else:
                st.info("No security controls fit within the allocated spend constraint.")


# =========================================================================== #
# TAB 3: REGULATORY COMPLIANCE (RBI / SEBI / NIST)
# =========================================================================== #
with tab3:
    st.markdown("### ⚖️ Regulatory Readiness & Compliance Gap Audit")
    st.caption("Continuous benchmarking against Reserve Bank of India (RBI CSF), SEBI CSCRF, NIST CSF 2.0, ISO 27001:2022, and ISO 42001:2023 frameworks.")

    comp_ok, comp_data, comp_err = safe_get(f"{backend_url}/api/compliance/status")

    if not comp_ok:
        st.warning(f"⚠️ Unable to load compliance assessment: {comp_err}")
    else:
        # Compliance KPI Cards
        rbi_pct = comp_data.get("rbi_compliance_index_percent", 0.0)
        sebi_pct = comp_data.get("sebi_compliance_index_percent", 0.0)
        nist_pct = comp_data.get("nist_csf_compliance_index_percent", 0.0)
        iso27001_pct = comp_data.get("iso27001_compliance_index_percent", 0.0)
        iso42001_pct = comp_data.get("iso42001_compliance_index_percent", 0.0)
        overall_pct = comp_data.get("overall_compliance_index_percent", 0.0)
        penalty_exposure = comp_data.get("estimated_regulatory_penalty_exposure_inr", 0.0)

        c1, c2, c3, c4, c5, c6 = st.columns(6)
        with c1:
            st.metric(
                label="RBI CSF Readiness",
                value=f"{rbi_pct:.1f}%",
                delta=f"{rbi_pct - 100:.1f}% to target",
                delta_color="normal" if rbi_pct >= 85 else "inverse",
            )
        with c2:
            st.metric(
                label="SEBI CSCRF Readiness",
                value=f"{sebi_pct:.1f}%",
                delta=f"{sebi_pct - 100:.1f}% to target",
                delta_color="normal" if sebi_pct >= 85 else "inverse",
            )
        with c3:
            st.metric(
                label="NIST CSF 2.0 Maturity",
                value=f"{nist_pct:.1f}%",
                delta=f"{nist_pct - 100:.1f}% to target",
                delta_color="normal" if nist_pct >= 85 else "inverse",
            )
        with c4:
            st.metric(
                label="ISO 27001:2022 Readiness",
                value=f"{iso27001_pct:.1f}%",
                delta=f"{iso27001_pct - 100:.1f}% to target",
                delta_color="normal" if iso27001_pct >= 85 else "inverse",
            )
        with c5:
            st.metric(
                label="ISO 42001:2023 AI Readiness",
                value=f"{iso42001_pct:.1f}%",
                delta=f"{iso42001_pct - 100:.1f}% to target",
                delta_color="normal" if iso42001_pct >= 85 else "inverse",
            )
        with c6:
            st.metric(
                label="Estimated Penalty Exposure",
                value=format_inr(penalty_exposure),
                help="Potential regulatory fines for non-compliance with critical directives.",
            )

        # Statutory Data Residency & Cross-Border Governance KPI Cards
        st.markdown("<div style='height: 10px;'></div>", unsafe_allow_html=True)
        cb_pct = comp_data.get("cross_border_compliance_index_percent", 100.0)
        rbi_loc_status = comp_data.get("rbi_localization_status", "Compliant")

        sb1, sb2, sb3 = st.columns(3)
        with sb1:
            st.metric(
                label="Cross-Border Transfer Readiness",
                value=f"{cb_pct:.1f}%",
                delta="Compliant" if cb_pct >= 90 else f"{100.0 - cb_pct:.1f}% Non-Compliant",
                delta_color="normal" if cb_pct >= 90 else "inverse",
                help="Statutory compliance index of cross-border data transfers evaluated under DPDPA 2023 & RBI directives.",
            )
        with sb2:
            st.metric(
                label="RBI Data Localization Status",
                value="Compliant ✅" if rbi_loc_status == "Compliant" else "Violation Detected 🚨",
                delta="Domestic Storage Mandate" if rbi_loc_status == "Compliant" else "Non-Compliant Data Location",
                delta_color="normal" if rbi_loc_status == "Compliant" else "inverse",
                help="Storage of Payment System Data within India (RBI Directive April 2018 / Master Direction).",
            )
        with sb3:
            st.metric(
                label="DPDPA Section 16 Safeguards",
                value="Enforced (SCC/BCR)" if cb_pct == 100.0 else "Action Required",
                delta="Valid Safeguards" if cb_pct == 100.0 else "Unapproved Transfer Rails",
                delta_color="normal" if cb_pct == 100.0 else "inverse",
                help="Requires approved legal transfer mechanisms (SCC, BCR, adequacy, or consent) for personal data export.",
            )

        # Sub-Processor Consent & Delegation Governance Audit Check (DPDPA Section 8 & ISO 27001 Clause A.5)
        st.markdown("<div style='height: 10px;'></div>", unsafe_allow_html=True)
        gaps_list = comp_data.get("gaps", [])
        lineage_gaps = [
            g for g in gaps_list
            if "Section 8(4)" in g.get("category", "") or "Clause A.5" in g.get("category", "") or "Sub-Processor" in g.get("category", "")
        ]

        sub_col1, sub_col2 = st.columns(2)
        with sub_col1:
            has_dpdpa_gap = any("Section 8(4)" in g.get("category", "") for g in lineage_gaps)
            st.metric(
                label="Sub-Processor Governance (DPDPA Sec 8)",
                value="Non-Compliant 🚨" if has_dpdpa_gap else "Compliant ✅",
                delta="Mandatory Lineage Tracer Missing" if has_dpdpa_gap else "Oversight Active",
                delta_color="inverse" if has_dpdpa_gap else "normal",
                help="DPDPA Section 8(4) statutory duty of data fiduciary to verify and audit downstream sub-processors.",
            )
        with sub_col2:
            has_iso_gap = any("Clause A.5" in g.get("category", "") for g in lineage_gaps)
            st.metric(
                label="ISO 27001 Clause A.5 Delegation Verifier",
                value="Action Required ⚠️" if has_iso_gap else "Governed ✅",
                delta="Zero-Trust Consent Gap" if has_iso_gap else "Consent Enforced",
                delta_color="inverse" if has_iso_gap else "normal",
                help="ISO 27001:2022 Clause A.5 organizational control requirement for sub-processor consent delegation.",
            )

        st.markdown("---")

        rad_col, gap_col = st.columns([1, 1])

        with rad_col:
            st.markdown("#### Framework Readiness Radar")
            radar_categories = ["RBI CSF", "SEBI CSCRF", "NIST CSF 2.0", "ISO 27001", "ISO 42001"]
            radar_values = [rbi_pct, sebi_pct, nist_pct, iso27001_pct, iso42001_pct]

            fig_radar = go.Figure()
            # Current compliance trace
            fig_radar.add_trace(
                go.Scatterpolar(
                    r=radar_values + [radar_values[0]],
                    theta=radar_categories + [radar_categories[0]],
                    fill="toself",
                    name="Current Readiness",
                    line=dict(color="#0284C7", width=2.5),
                    fillcolor="rgba(2, 132, 199, 0.20)",
                )
            )
            # Target 100% trace
            fig_radar.add_trace(
                go.Scatterpolar(
                    r=[100, 100, 100, 100, 100, 100],
                    theta=radar_categories + [radar_categories[0]],
                    mode="lines",
                    name="Regulatory Target (100%)",
                    line=dict(color="#94A3B8", dash="dash", width=1.5),
                )
            )
            fig_radar.update_layout(
                template="plotly_white",
                paper_bgcolor="#FFFFFF",
                plot_bgcolor="#FFFFFF",
                font=dict(color="#1E293B"),
                polar=dict(
                    bgcolor="#FFFFFF",
                    radialaxis=dict(
                        visible=True,
                        range=[0, 100],
                        showticklabels=True,
                        ticks="outside",
                        tickfont=dict(color="#1E293B", size=10),
                        gridcolor="#E2E8F0",
                        linecolor="#CBD5E1",
                    ),
                    angularaxis=dict(
                        gridcolor="#E2E8F0",
                        linecolor="#CBD5E1",
                        tickfont=dict(color="#1E293B", size=11, family="sans-serif"),
                    ),
                ),
                height=380,
                margin=dict(l=30, r=30, t=30, b=30),
                legend=dict(
                    orientation="h",
                    yanchor="bottom",
                    y=-0.22,
                    xanchor="center",
                    x=0.5,
                    font=dict(color="#1E293B"),
                ),
            )
            st.plotly_chart(fig_radar, use_container_width=True)

        with gap_col:
            st.markdown("#### Identified Gaps & Actionable Remediations")
            gaps = comp_data.get("gaps", [])
            if gaps:
                for idx, gap in enumerate(gaps):
                    rec_controls = ", ".join(gap.get("recommended_control_codes", [])) or "None specified"
                    st.markdown(
                        f"""
                        <div class="gap-card">
                            <div class="gap-header">
                                <span>⚠️ {gap.get('framework')} • {gap.get('category')}</span>
                            </div>
                            <div class="gap-desc">{gap.get('description')}</div>
                            <div class="gap-controls"><b>Recommended Fixes:</b> {rec_controls}</div>
                        </div>
                        """,
                        unsafe_allow_html=True,
                    )
            else:
                st.success("✅ Zero active regulatory gaps detected. Enterprise meets baseline standards.")

        # Cross-Border Data Transfer Audit Register Table
        st.markdown("---")
        st.markdown("#### 🌐 Cross-Border Data Transfer & Statutory Jurisdiction Audit")
        st.caption("Live statutory verification of data flows against RBI Payment Data Localization Directive and DPDPA 2023 Section 16 restrictions.")

        asset_flow_ok, asset_flow_data, _ = safe_get(f"{backend_url}/api/assets")
        if asset_flow_ok and asset_flow_data:
            audit_rows = []
            for item in asset_flow_data:
                residency = item.get("data_residency_country", "IN")
                cb_enabled = item.get("cross_border_transfer_enabled", False)
                dest = item.get("destination_countries") or "—"
                mech = item.get("transfer_legal_mechanism") or "None"
                rbi_loc = item.get("is_rbi_localization_compliant", True)
                is_rbi = item.get("is_rbi_regulated", False)
                fin_cnt = item.get("financial_records_count", 0)
                pii_cnt = item.get("pii_records_count", 0)
                is_tp = item.get("is_third_party", False)

                is_rbi_viol = (is_rbi and not rbi_loc) or (is_rbi and fin_cnt > 0 and residency != "IN") or (cb_enabled and not rbi_loc)
                is_dpdpa_viol = cb_enabled and pii_cnt > 0 and mech in (None, "None")
                is_tp_viol = is_tp and residency != "IN"

                status_label = "Compliant ✅"
                if is_rbi_viol:
                    status_label = "RBI Localization Violation 🚨"
                elif is_dpdpa_viol:
                    status_label = "DPDPA Sec 16 Violation ⚠️"
                elif is_tp_viol:
                    status_label = "Foreign Vendor Review ℹ️"

                audit_rows.append({
                    "Hostname": item.get("hostname"),
                    "Origin Country": f"{residency} 🇮🇳" if residency == "IN" else f"{residency} 🌐",
                    "Cross-Border Transfer": "Active 🌐" if cb_enabled else "Domestic Only 🔒",
                    "Destination Countries": dest,
                    "Applied Legal Safeguard": mech,
                    "RBI Localization": "Compliant ✅" if (rbi_loc and (not is_rbi or residency == "IN")) else "Non-Compliant 🚨",
                    "Statutory Compliance Status": status_label,
                })
            st.dataframe(pd.DataFrame(audit_rows), use_container_width=True, hide_index=True)


# =========================================================================== #
# TAB 4: ASSET INVENTORY & TELEMETRY
# =========================================================================== #
with tab4:
    st.markdown("### 🖥️ IT/OT Asset Inventory & Third-Party Risk (TPRM)")
    st.caption("Live enterprise asset register enriched with financial impact metrics, sensitive data counts, ISO compliance scope, and third-party vendor risk.")

    asset_ok, asset_data, asset_err = safe_get(f"{backend_url}/api/assets")

    if not asset_ok:
        st.warning(f"⚠️ Unable to load asset inventory: {asset_err}")
    else:
        if not asset_data:
            st.info("No assets found. Seed the database to display inventory.")
        else:
            df_assets = pd.DataFrame(asset_data)

            # Summary Metrics for Inventory & TPRM
            a1, a2, a3, a4, a5, a6 = st.columns(6)
            with a1:
                st.metric("Total Enterprise Hosts", len(df_assets))
            with a2:
                crit_count = len(df_assets[df_assets["tier"] == "Critical"]) if "tier" in df_assets else 0
                st.metric("Crown Jewel Assets", crit_count)
            with a3:
                tp_count = len(df_assets[df_assets["is_third_party"] == True]) if "is_third_party" in df_assets else 0
                st.metric("Third-Party Vendors", tp_count)
            with a4:
                ai_count = len(df_assets[df_assets["is_iso42001_regulated"] == True]) if "is_iso42001_regulated" in df_assets else 0
                st.metric("AI/ML Pipelines", ai_count)
            with a5:
                total_pii = df_assets["pii_records_count"].sum() if "pii_records_count" in df_assets else 0
                st.metric("Total PII Records", f"{total_pii:,}")
            with a6:
                total_fin = df_assets["financial_records_count"].sum() if "financial_records_count" in df_assets else 0
                st.metric("Total Financial Records", f"{total_fin:,}")

            st.markdown("---")

            # Filters
            f_col1, f_col2, f_col3, f_col4, f_col5 = st.columns([1, 1.1, 1.1, 1.2, 1.5])
            with f_col1:
                tier_filter = st.selectbox("Criticality Tier", ["All", "Critical", "Medium", "Low"])
            with f_col2:
                class_filter = st.selectbox(
                    "Classification Type",
                    [
                        "All",
                        "Core IT",
                        "AI/ML Model Pipeline",
                        "Third-Party SaaS",
                        "Third-Party Vendor API",
                        "Cloud Infrastructure",
                        "Data Repository",
                    ],
                )
            with f_col3:
                std_filter = st.selectbox(
                    "Standard & Governance Scope",
                    [
                        "All",
                        "ISO 27001 In-Scope",
                        "ISO 42001 In-Scope",
                        "Third-Party Only",
                        "RBI Regulated",
                        "SEBI Regulated",
                    ],
                )
            with f_col4:
                residency_scope = st.selectbox(
                    "Data Residency Scope",
                    [
                        "All",
                        "Domestic (India Only)",
                        "Cross-Border Active",
                        "Localization Non-Compliant",
                    ],
                )
            with f_col5:
                search_term = st.text_input("Search Hostname, Vendor, Unit, or Country", "").strip().lower()

            filtered_df = df_assets.copy()
            if tier_filter != "All":
                filtered_df = filtered_df[filtered_df["tier"] == tier_filter]
            if class_filter != "All" and "classification_type" in filtered_df:
                filtered_df = filtered_df[filtered_df["classification_type"] == class_filter]
            if std_filter == "ISO 27001 In-Scope" and "is_iso27001_regulated" in filtered_df:
                filtered_df = filtered_df[filtered_df["is_iso27001_regulated"] == True]
            elif std_filter == "ISO 42001 In-Scope" and "is_iso42001_regulated" in filtered_df:
                filtered_df = filtered_df[filtered_df["is_iso42001_regulated"] == True]
            elif std_filter == "Third-Party Only" and "is_third_party" in filtered_df:
                filtered_df = filtered_df[filtered_df["is_third_party"] == True]
            elif std_filter == "RBI Regulated" and "is_rbi_regulated" in filtered_df:
                filtered_df = filtered_df[filtered_df["is_rbi_regulated"] == True]
            elif std_filter == "SEBI Regulated" and "is_sebi_regulated" in filtered_df:
                filtered_df = filtered_df[filtered_df["is_sebi_regulated"] == True]

            # Data Residency Scope filter
            if residency_scope == "Domestic (India Only)" and "data_residency_country" in filtered_df:
                filtered_df = filtered_df[
                    (filtered_df["data_residency_country"] == "IN")
                    & (filtered_df["cross_border_transfer_enabled"] == False)
                ]
            elif residency_scope == "Cross-Border Active" and "cross_border_transfer_enabled" in filtered_df:
                filtered_df = filtered_df[
                    (filtered_df["cross_border_transfer_enabled"] == True)
                    | (filtered_df["data_residency_country"] != "IN")
                ]
            elif residency_scope == "Localization Non-Compliant" and "is_rbi_localization_compliant" in filtered_df:
                filtered_df = filtered_df[
                    (filtered_df["is_rbi_localization_compliant"] == False)
                    | ((filtered_df["is_rbi_regulated"] == True) & (filtered_df["data_residency_country"] != "IN"))
                ]

            if search_term:
                host_match = filtered_df["hostname"].astype(str).str.lower().str.contains(search_term)
                bu_match = filtered_df["business_unit"].astype(str).str.lower().str.contains(search_term)
                type_match = filtered_df["asset_type"].astype(str).str.lower().str.contains(search_term)
                class_match = (
                    filtered_df["classification_type"].fillna("").astype(str).str.lower().str.contains(search_term)
                    if "classification_type" in filtered_df
                    else False
                )
                vendor_match = (
                    filtered_df["vendor_name"].fillna("").astype(str).str.lower().str.contains(search_term)
                    if "vendor_name" in filtered_df
                    else False
                )
                country_match = (
                    filtered_df["data_residency_country"].fillna("").astype(str).str.lower().str.contains(search_term)
                    if "data_residency_country" in filtered_df
                    else False
                )
                filtered_df = filtered_df[host_match | bu_match | type_match | class_match | vendor_match | country_match]

            # Format DataFrame for Display with Third-Party & Residency Indicators
            display_table = pd.DataFrame()
            display_table["Hostname"] = filtered_df["hostname"]
            display_table["Classification"] = (
                filtered_df["classification_type"] if "classification_type" in filtered_df else "Internal IT"
            )
            display_table["Type"] = filtered_df["asset_type"]
            display_table["Tier"] = filtered_df["tier"]
            display_table["Residency (ISO)"] = (
                filtered_df["data_residency_country"].apply(lambda c: f"{c} 🇮🇳" if c == "IN" else f"{c} 🌐")
                if "data_residency_country" in filtered_df
                else "IN 🇮🇳"
            )
            display_table["Cross-Border Flow"] = (
                filtered_df["cross_border_transfer_enabled"].apply(lambda b: "Yes 🌐" if b else "No")
                if "cross_border_transfer_enabled" in filtered_df
                else "No"
            )
            display_table["Transfer Mechanism"] = (
                filtered_df["transfer_legal_mechanism"].fillna("None")
                if "transfer_legal_mechanism" in filtered_df
                else "None"
            )
            display_table["RBI Localized"] = (
                filtered_df.apply(
                    lambda row: "Non-Compliant 🚨"
                    if (not row.get("is_rbi_localization_compliant", True)) or (row.get("is_rbi_regulated", False) and row.get("data_residency_country") != "IN")
                    else ("Compliant ✅" if row.get("is_rbi_regulated", False) else "Domestic 🇮🇳"),
                    axis=1,
                )
                if "is_rbi_localization_compliant" in filtered_df
                else "Domestic 🇮🇳"
            )
            display_table["Third-Party"] = (
                filtered_df["is_third_party"].apply(lambda b: "External 🌐" if b else "Internal 🏢")
                if "is_third_party" in filtered_df
                else "Internal 🏢"
            )
            display_table["Vendor Name"] = (
                filtered_df["vendor_name"].fillna("—") if "vendor_name" in filtered_df else "—"
            )
            display_table["Vendor Risk Tier"] = (
                filtered_df["vendor_risk_tier"].apply(
                    lambda v: f"🚨 {v}"
                    if v == "Tier-1 Critical"
                    else (f"⚠️ {v}" if v == "Tier-2 High" else (f"ℹ️ {v}" if pd.notna(v) and v else "—"))
                )
                if "vendor_risk_tier" in filtered_df
                else "—"
            )
            display_table["SOC 2 Status"] = (
                filtered_df["soc2_attestation"].apply(lambda b: "Attested ✅" if b else "Uncertified ⚠️")
                if "soc2_attestation" in filtered_df
                else "Uncertified ⚠️"
            )
            display_table["ISO 27001"] = (
                filtered_df["is_iso27001_regulated"].apply(lambda b: "In-Scope" if b else "Exempt")
                if "is_iso27001_regulated" in filtered_df
                else "Exempt"
            )
            display_table["ISO 42001"] = (
                filtered_df["is_iso42001_regulated"].apply(lambda b: "In-Scope 🤖" if b else "Exempt")
                if "is_iso42001_regulated" in filtered_df
                else "Exempt"
            )
            display_table["Business Unit"] = filtered_df["business_unit"]
            display_table["Revenue Loss / Min"] = filtered_df["revenue_per_minute"].apply(format_inr)
            display_table["PII Records"] = filtered_df["pii_records_count"].apply(lambda n: f"{n:,}")
            display_table["Financial Records"] = filtered_df["financial_records_count"].apply(lambda n: f"{n:,}")
            display_table["Network Hops"] = filtered_df["network_hops_from_internet"]
            display_table["Estimated EAL"] = filtered_df["estimated_eal_inr"].apply(format_inr)

            st.dataframe(
                display_table,
                use_container_width=True,
                hide_index=True,
            )

            # Vulnerability Inspection Drawer
            with st.expander("🔍 Deep Dive: CVEs & Exploitation Scores for Selected Host", expanded=False):
                host_list = sorted(filtered_df["hostname"].unique().tolist())
                if host_list:
                    chosen_host = st.selectbox("Select Host", host_list)
                    host_record = next((a for a in asset_data if a["hostname"] == chosen_host), None)
                    if host_record and host_record.get("vulnerabilities"):
                        v_df = pd.DataFrame(host_record["vulnerabilities"])
                        v_display = v_df[["cve_id", "cvss_score", "epss_score", "cisa_kev", "patch_available", "is_patched"]].rename(
                            columns={
                                "cve_id": "CVE ID",
                                "cvss_score": "CVSS 3.1",
                                "epss_score": "EPSS Score",
                                "cisa_kev": "CISA KEV Listed",
                                "patch_available": "Patch Available",
                                "is_patched": "Remediated",
                            }
                        )
                        st.dataframe(v_display, use_container_width=True, hide_index=True)
                    else:
                        st.info(f"No active vulnerabilities mapped to {chosen_host}.")

            # ---------------------------------------------------------------- #
            # Unauthorized Data Flow & Lineage Tracer Interactive Table
            # ---------------------------------------------------------------- #
            st.markdown("---")
            st.markdown("#### 🕵️ Unauthorized Data Flow & Lineage Tracer")
            st.caption(
                "Breadth-first taint propagation ($A \\rightarrow B \\rightarrow C$) pinpointing indirect data leakage, "
                "unconsented sub-processor delegations, and causal liability attribution under DPDPA Section 8(4)."
            )

            lineage_ok, lineage_data, _ = safe_get(f"{backend_url}/api/lineage/flows")
            if not lineage_ok or not lineage_data:
                # Fallback to summary data identified vectors
                lineage_data = summary_data.get("identified_leak_vectors", []) if ok and summary_data else []

            if lineage_data:
                unauth_count = len([
                    f for f in lineage_data
                    if not f.get("is_authorized", True) or not f.get("has_user_consent", True) or "Unauthorized" in f.get("detection_status", "")
                ])
                if unauth_count > 0:
                    st.error(
                        f"🚨 **Critical Indirect Data Leak Identified:** {unauth_count} unauthorized delegation flow(s) detected. "
                        f"Core banking records originating from internal databases are traversing intermediary bridges to unconsented third-party sinks."
                    )
                else:
                    st.success("✅ All data provenance flows have recorded authorization and user consent boundaries verified.")

                flow_rows = []
                for f in lineage_data:
                    origin = f.get("origin_hostname", "—")
                    inter = f.get("intermediary_hostname") or "— (Direct)"
                    dest = f.get("destination_hostname", "—")
                    pii_exposed = f.get("records_exposed_pii", 0)
                    fin_exposed = f.get("records_exposed_financial", 0)
                    is_auth = f.get("is_authorized", True)
                    has_consent = f.get("has_user_consent", True)
                    is_leak = not is_auth or not has_consent or "Unauthorized" in f.get("detection_status", "")

                    consent_status = "Approved ✅" if (is_auth and has_consent) else "Unauthorized Delegation 🚨"
                    culprit = f"🚨 {dest} (Exfiltration Sink)" if is_leak else "None (Compliant)"

                    flow_rows.append({
                        "Originating Asset (A)": origin,
                        "Intermediate Gateway (B)": inter,
                        "Exfiltration / Sink Asset (C)": dest,
                        "Data Transferred (PII / Financial)": f"{pii_exposed:,} PII / {fin_exposed:,} Financial",
                        "Consent Verification Status": consent_status,
                        "Detection Status": f.get("detection_status", "Legitimate Flow"),
                        "Identified Causal Leak Culprit (C)": culprit,
                    })

                df_flows = pd.DataFrame(flow_rows)
                st.dataframe(df_flows, use_container_width=True, hide_index=True)
            else:
                st.info("No data lineage flows registered. Ensure attack graph topology and assets are seeded.")
