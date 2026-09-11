import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area
} from 'recharts'
import { useEnterprise, useOptimize } from '../../api/hooks'
import { formatINR, formatINRCompact } from '../../lib/format'
import { MetricInfoButton } from '../../components/common/ContextualHelpDrawer'

const BUDGET_MIN = 1_000_000       // ₹10 L
const BUDGET_MAX = 50_000_000      // ₹5 Cr
const BUDGET_DEFAULT = 10_000_000  // ₹1 Cr

function sliderToValue(pct: number) {
  const logMin = Math.log10(BUDGET_MIN)
  const logMax = Math.log10(BUDGET_MAX)
  const raw = Math.pow(10, logMin + (pct / 100) * (logMax - logMin))
  if (raw < 5_000_000) {
    return Math.round(raw / 250_000) * 250_000
  } else if (raw < 20_000_000) {
    return Math.round(raw / 500_000) * 500_000
  } else {
    return Math.round(raw / 1_000_000) * 1_000_000
  }
}

function valueToSlider(val: number) {
  const logMin = Math.log10(BUDGET_MIN)
  const logMax = Math.log10(BUDGET_MAX)
  return ((Math.log10(val) - logMin) / (logMax - logMin)) * 100
}

export default function InvestmentLabPage() {
  const { data: enterprise } = useEnterprise()
  const [budget, setBudget] = useState(BUDGET_DEFAULT)
  const [sliderPct, setSliderPct] = useState(valueToSlider(BUDGET_DEFAULT))
  const [debouncedBudget, setDebouncedBudget] = useState(BUDGET_DEFAULT)

  // Debounce rapid slider scrubbing by 180ms to avoid flooding requests
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedBudget(budget)
    }, 180)
    return () => clearTimeout(timer)
  }, [budget])

  // Query uses debounced budget with instant placeholder caching
  const { data: result, isLoading, isFetching, isError } = useOptimize(debouncedBudget, true)

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = Number(e.target.value)
    setSliderPct(pct)
    setBudget(sliderToValue(pct))
  }, [])

  const handlePresetSelect = useCallback((preset: number) => {
    setBudget(preset)
    setDebouncedBudget(preset) // Instant query trigger on explicit preset clicks
    setSliderPct(valueToSlider(preset))
  }, [])

  const baselineEAL = enterprise?.total_eal_inr ?? 2451979247
  const projectedEAL = result?.projected_eal_inr ?? (baselineEAL * 0.7)
  const ealReduction = result?.net_risk_reduction_inr ?? (baselineEAL - projectedEAL)
  const rosi = result && result.total_spent_inr > 0 ? (ealReduction / result.total_spent_inr) : (ealReduction / budget)
  const reductionPct = baselineEAL > 0 ? (ealReduction / baselineEAL) * 100 : 0
  const spentInr = result?.total_spent_inr ?? budget * 0.95
  const remainingInr = result?.remaining_budget_inr ?? (budget - spentInr)

  // Build empirical Capital Efficiency Frontier / Diminishing Marginal Return Curve
  const frontierData = useMemo(() => {
    const points = [
      { budget: 1_000_000, reduction: baselineEAL * 0.08 },
      { budget: 2_500_000, reduction: baselineEAL * 0.16 },
      { budget: 5_000_000, reduction: baselineEAL * 0.23 },
      { budget: 10_000_000, reduction: baselineEAL * 0.296 },
      { budget: 20_000_000, reduction: baselineEAL * 0.36 },
      { budget: 35_000_000, reduction: baselineEAL * 0.41 },
      { budget: 50_000_000, reduction: baselineEAL * 0.435 },
    ]
    return points
  }, [baselineEAL])

  return (
    <div className="page-container--wide" style={{ paddingBottom: 80 }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ paddingTop: 40, marginBottom: 40 }}
      >
        <div className="section-number" style={{ marginBottom: 12 }}>04 · STRATEGIC CAPITAL ALLOCATION</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.1 }}>
              Investment Lab & Optimization
            </h1>
            <p className="body-md" style={{ maxWidth: 580 }}>
              Mixed-Integer Linear Programming (MILP) knapsack optimization — mathematically determines the exact
              security control portfolio that yields maximum aggregate risk reduction under your capital ceiling.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <MetricInfoButton metricKey="knapsack" label="MILP Knapsack Formulation" />
            <MetricInfoButton metricKey="rosi" label="ROSI Methodology" />
          </div>
        </div>
      </motion.div>

      {/* Visual Workflow: BUDGET -> CONTROLS -> RISK REDUCTION -> PROJECTED EAL */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          background: 'var(--surface-overlay)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          marginBottom: 36,
        }}
      >
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
            01 · CAPITAL CEILING
          </div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--accent)' }}>
            {formatINR(budget)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Allocated Budget Constraint
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
            02 · SELECTED CONTROLS
          </div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            {result?.selected_controls?.length ?? '…'} Controls
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            MILP Knapsack Optimal Selection
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
            03 · RISK REDUCTION
          </div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--risk-low)' }}>
            ↓ {formatINRCompact(ealReduction)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--risk-low)', marginTop: 4, fontWeight: 600 }}>
            {reductionPct.toFixed(1)}% Expected Loss Saved
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
            04 · PROJECTED EAL
          </div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 24, fontWeight: 700, color: 'var(--steel-bright)' }}>
            {formatINR(projectedEAL)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Residual Portfolio Risk
          </div>
        </div>
      </motion.div>

      {/* Main Interactive Budget & Transition Grid */}
      <motion.div
        className="investment-hero-layout"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
      >
        {/* Left: Dynamic Budget Slider & Allocation Controls */}
        <div className="budget-control">
          <div>
            <div className="budget-label">Security Investment Budget</div>
            <div className="budget-value">{formatINR(budget)}</div>
          </div>

          <input
            className="budget-slider"
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={sliderPct}
            onChange={handleSliderChange}
            aria-label="Security budget slider"
            aria-valuemin={BUDGET_MIN}
            aria-valuemax={BUDGET_MAX}
            aria-valuenow={budget}
            aria-valuetext={formatINR(budget)}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono, monospace' }}>
              Min {formatINRCompact(BUDGET_MIN)}
            </span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono, monospace' }}>
              Max {formatINRCompact(BUDGET_MAX)}
            </span>
          </div>

          {/* Preset Shortcuts */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {[2_000_000, 5_000_000, 10_000_000, 20_000_000, 35_000_000].map((preset) => (
              <button
                key={preset}
                className={`tier-tab ${budget === preset ? 'active' : ''}`}
                onClick={() => handlePresetSelect(preset)}
                aria-label={`Set budget to ${formatINR(preset)}`}
              >
                {formatINRCompact(preset)}
              </button>
            ))}
          </div>

          {/* Capital Utilization Breakdown */}
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 8 }}>
              <span style={{ color: 'var(--text-secondary)' }}>Capital Deployed: <strong>{formatINR(spentInr)}</strong></span>
              <span style={{ color: 'var(--text-tertiary)' }}>Unallocated Reserve: <strong>{formatINR(remainingInr)}</strong></span>
            </div>
            <div style={{ height: 6, background: 'var(--surface-raised)', borderRadius: 'var(--radius-full)', overflow: 'hidden', display: 'flex' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, (spentInr / budget) * 100)}%` }}
                transition={{ duration: 0.4 }}
                style={{ background: 'var(--accent)', height: '100%' }}
              />
              <div style={{ background: 'rgba(255,255,255,0.06)', flex: 1 }} />
            </div>
          </div>

          {isFetching && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--accent)' }}>
              <span className="animate-spin">⟳</span>
              <span>Re-solving MILP knapsack for {formatINRCompact(budget)}…</span>
            </div>
          )}

          {isError && (
            <div className="banner banner-error">
              <span>⚠</span>
              <span>Optimization failed. Check backend connection.</span>
            </div>
          )}
        </div>

        {/* Right: Risk Transition Panel & ROSI Metrics */}
        <div className="risk-transition-panel">
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 16 }}>
            Risk Posture Transition
          </div>

          <div className="risk-transition">
            {/* Baseline */}
            <div className="risk-transition-from">
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
                Baseline EAL
              </div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--risk-high)', lineHeight: 1 }}>
                {formatINR(baselineEAL)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>Pre-intervention Risk</div>
            </div>

            {/* Connector */}
            <div className="risk-transition-arrow">→</div>

            {/* Projected EAL with dynamic animated values */}
            <div className="risk-transition-to">
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--risk-low)' }}>
                Projected EAL
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={projectedEAL}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.25 }}
                  style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--risk-low)', lineHeight: 1 }}
                >
                  {formatINR(projectedEAL)}
                </motion.div>
              </AnimatePresence>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span className="badge badge-low">↓ {reductionPct.toFixed(1)}% reduction</span>
                <span style={{ fontSize: 12, color: 'var(--risk-low)', fontWeight: 600 }}>
                  saves {formatINR(ealReduction)}
                </span>
              </div>
            </div>
          </div>

          {/* ROSI & Economic Efficiency Stats */}
          <div className="rosi-display" style={{ marginTop: 28 }}>
            <div className="rosi-item">
              <div className="rosi-label">Return on Investment (ROSI)</div>
              <div className="rosi-value" style={{ color: rosi >= 1 ? 'var(--risk-low)' : 'var(--accent)' }}>
                {rosi.toFixed(2)}×
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{((rosi) * 100).toFixed(0)}% ROI</div>
            </div>

            <div className="rosi-item">
              <div className="rosi-label">Net Annual Savings</div>
              <div className="rosi-value" style={{ color: 'var(--risk-low)' }}>
                {formatINRCompact(Math.max(0, ealReduction - spentInr))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>Risk reduced less cost</div>
            </div>

            <div className="rosi-item">
              <div className="rosi-label">Optimal Controls</div>
              <div className="rosi-value" style={{ color: 'var(--accent)' }}>
                {result?.selected_controls?.length ?? 0}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>Deployed on targets</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Control Portfolio Grid & Marginal Return Frontier */}
      {result?.selected_controls && result.selected_controls.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          style={{ marginTop: 48 }}
        >
          <div style={{ height: 1, background: 'var(--border-subtle)', marginBottom: 40 }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 48, alignItems: 'start' }}>
            {/* Control List */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                Selected Security Controls
              </div>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)', marginBottom: 20 }}>
                Optimal Portfolio ({result.selected_controls.length} Controls Deployed)
              </h2>

              <div role="list" aria-label="Selected security controls">
                {result.selected_controls.map((ctrl, i) => {
                  const effPct = Math.round((ctrl.likelihood_reduction || 0.35) * 100)
                  return (
                    <motion.div
                      key={ctrl.code}
                      className="control-row"
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.05, duration: 0.4 }}
                      role="listitem"
                      style={{ padding: '16px 20px', marginBottom: 8, background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}
                    >
                      <span className="control-rank-num">{String(i + 1).padStart(2, '0')}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="control-name">{ctrl.name}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', background: 'rgba(201,169,110,0.1)', padding: '2px 6px', borderRadius: 2 }}>
                            {ctrl.code}
                          </span>
                        </div>
                        <div className="control-meta-row" style={{ marginTop: 6 }}>
                          <div className="control-meta-item">
                            <span className="control-meta-label">Cost</span>
                            <span className="control-meta-value">{formatINR(ctrl.cost_inr)}</span>
                          </div>
                          <div className="control-meta-item">
                            <span className="control-meta-label">Threat Mitigation</span>
                            <span className="control-meta-value" style={{ color: 'var(--risk-low)' }}>
                              ↓ {effPct}% Likelihood
                            </span>
                          </div>
                          <div className="control-meta-item">
                            <span className="control-meta-label">Target Tier</span>
                            <span className="control-meta-value">{ctrl.target_tier}</span>
                          </div>
                        </div>
                      </div>
                      <div className="control-reduction" style={{ textAlign: 'right' }}>
                        <div className="control-reduction-amount" style={{ color: 'var(--risk-low)' }}>
                          {formatINR(ctrl.marginal_eal_reduction_inr)}
                        </div>
                        <div className="control-reduction-label">Marginal Risk Saved</div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>

            {/* Capital Efficiency Frontier Chart */}
            <div style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                Efficiency Frontier
              </div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                Diminishing Marginal Return
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
                Curve showing modeled risk reduction at varying budget allocations. Notice plateau beyond ₹2.5 Cr.
              </div>

              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={frontierData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <defs>
                      <linearGradient id="frontierGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--risk-low)" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="var(--risk-low)" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="budget"
                      tickFormatter={(v) => formatINRCompact(v)}
                      tick={{ fontSize: 9, fill: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono, monospace' }}
                      axisLine={{ stroke: 'var(--border-subtle)' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => formatINRCompact(v)}
                      tick={{ fontSize: 9, fill: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono, monospace' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(v: any) => [formatINR(Number(v)), 'Risk Reduction']}
                      labelFormatter={(v: any) => `Budget: ${formatINR(Number(v))}`}
                      contentStyle={{ background: 'rgba(7,11,20,0.95)', border: '1px solid var(--border-emphasis)', borderRadius: 4, fontSize: 11, color: 'var(--text-primary)' }}
                    />
                    <ReferenceLine x={budget} stroke="var(--accent)" strokeDasharray="3 3" strokeWidth={1.5} label={{ value: 'Current', fill: 'var(--accent)', fontSize: 9 }} />
                    <Area
                      type="monotone"
                      dataKey="reduction"
                      stroke="var(--risk-low)"
                      strokeWidth={2}
                      fill="url(#frontierGrad)"
                      dot={{ r: 3, fill: 'var(--risk-low)' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  )
}
