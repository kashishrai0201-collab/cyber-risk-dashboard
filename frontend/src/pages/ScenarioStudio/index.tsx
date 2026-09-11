import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { useEnterprise, useHistory } from '../../api/hooks'
import { formatINR, formatINRCompact } from '../../lib/format'
import { MetricInfoButton } from '../../components/common/ContextualHelpDrawer'

interface ScenarioExperiment {
  id: string
  name: string
  category: 'threat' | 'defense'
  description: string
  freqMod: number
  sevMod: number
  costInr: number
}

const PRESET_EXPERIMENTS: ScenarioExperiment[] = [
  {
    id: 'mfa_rollout',
    name: 'Universal FIDO2 MFA Rollout',
    category: 'defense',
    description: 'Enforce hardware-backed MFA across all corporate IT and administrative access.',
    freqMod: -0.45, // -45% breach frequency
    sevMod: 0.0,
    costInr: 4_500_000, // ₹45 L
  },
  {
    id: 'patch_kev',
    name: 'Emergency CISA KEV Remediation',
    category: 'defense',
    description: 'Immediate remediation of all 37 unpatched active vulnerabilities across payment gateways.',
    freqMod: -0.38,
    sevMod: -0.15,
    costInr: 3_200_000, // ₹32 L
  },
  {
    id: 'edr_expansion',
    name: 'MDR / EDR 100% Endpoint Coverage',
    category: 'defense',
    description: 'Deploy 24/7 managed detection and automated isolation to all regional branch systems.',
    freqMod: -0.22,
    sevMod: -0.30,
    costInr: 6_000_000, // ₹60 L
  },
  {
    id: 'immutable_backups',
    name: 'Air-Gapped Immutable Backups',
    category: 'defense',
    description: 'Zero-trust isolated snapshot storage to eliminate ransomware extortion leverage.',
    freqMod: 0.0,
    sevMod: -0.55,
    costInr: 7_500_000, // ₹75 L
  },
  {
    id: 'ransomware_campaign',
    name: 'Targeted Adversary Ransomware Campaign',
    category: 'threat',
    description: 'Adversary targeting core banking databases with double-extortion ransomware.',
    freqMod: +0.60,
    sevMod: +0.85,
    costInr: 0,
  },
  {
    id: 'supply_chain_breach',
    name: 'Third-Party Vendor SDK Compromise',
    category: 'threat',
    description: 'Compromised external payment library injected into production UPI gateways.',
    freqMod: +0.75,
    sevMod: +0.40,
    costInr: 0,
  },
]

export default function ScenarioStudioPage() {
  const { data: enterprise } = useEnterprise()
  const { data: history, isLoading: histLoading } = useHistory()

  // Selected interventions in active what-if experiment
  const [activeInterventions, setActiveInterventions] = useState<string[]>([
    'mfa_rollout',
    'patch_kev',
  ])

  // Custom threat multipliers
  const [threatMultiplier, setThreatMultiplier] = useState(1.0)
  const [severityMultiplier, setSeverityMultiplier] = useState(1.0)

  const baselineEAL = enterprise?.total_eal_inr ?? 2451979247

  // Calculate composite scenario outcome
  const scenarioResult = useMemo(() => {
    let netFreqMod = 0
    let netSevMod = 0
    let totalInvestment = 0

    activeInterventions.forEach((id) => {
      const exp = PRESET_EXPERIMENTS.find((e) => e.id === id)
      if (exp) {
        netFreqMod += exp.freqMod
        netSevMod += exp.sevMod
        totalInvestment += exp.costInr
      }
    })

    // Compound multiplier
    const effectiveFreq = Math.max(0.1, (1 + netFreqMod) * threatMultiplier)
    const effectiveSev = Math.max(0.1, (1 + netSevMod) * severityMultiplier)
    const scenarioEAL = Math.round(baselineEAL * effectiveFreq * effectiveSev)
    const delta = scenarioEAL - baselineEAL
    const pctChange = baselineEAL > 0 ? (delta / baselineEAL) * 100 : 0

    return {
      scenarioEAL,
      delta,
      pctChange,
      totalInvestment,
      effectiveFreq,
      effectiveSev,
    }
  }, [baselineEAL, activeInterventions, threatMultiplier, severityMultiplier])

  const toggleIntervention = (id: string) => {
    setActiveInterventions((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  // Simulation history trend data
  const trendData = (history ?? [])
    .slice()
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((run, i) => ({
      index: i + 1,
      eal: run.total_eal_inr,
      timestamp: new Date(run.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    }))

  // Comparison bar chart data
  const comparisonData = [
    { name: 'Baseline Risk', eal: baselineEAL, color: 'var(--risk-high)' },
    {
      name: 'Scenario Outcome',
      eal: scenarioResult.scenarioEAL,
      color: scenarioResult.delta <= 0 ? 'var(--risk-low)' : 'var(--risk-critical)',
    },
  ]

  return (
    <div className="page-container--wide" style={{ paddingBottom: 80 }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ paddingTop: 40, marginBottom: 40 }}
      >
        <div className="section-number" style={{ marginBottom: 12 }}>05 · WHAT-IF EXPERIMENTATION</div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.1 }}>
          Scenario Studio & Hypothesis Testing
        </h1>
        <p className="body-md" style={{ maxWidth: 580 }}>
          Stress-test organizational cyber resilience by toggling defensive controls and adversary threat vectors.
          Evaluate how simulated frequency and severity assumptions affect enterprise Expected Annual Loss.
        </p>
      </motion.div>

      {/* Hero Comparative Synthesis Banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 20,
          background: 'var(--surface-overlay)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          padding: 24,
          marginBottom: 40,
        }}
      >
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
            BASELINE ANNUAL LOSS
          </div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>
            {formatINR(baselineEAL)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Unmodified Current Telemetry
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
            SCENARIO PROJECTED LOSS
          </div>
          <div
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 26,
              fontWeight: 700,
              color: scenarioResult.delta <= 0 ? 'var(--risk-low)' : 'var(--risk-critical)',
            }}
          >
            {formatINR(scenarioResult.scenarioEAL)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            Post-Hypothesis Modeled Risk
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
            NET RISK DELTA
          </div>
          <div
            style={{
              fontFamily: 'Syne, sans-serif',
              fontSize: 26,
              fontWeight: 700,
              color: scenarioResult.delta <= 0 ? 'var(--risk-low)' : 'var(--risk-critical)',
            }}
          >
            {scenarioResult.delta <= 0 ? '↓ ' : '↑ '}
            {formatINRCompact(Math.abs(scenarioResult.delta))}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: scenarioResult.delta <= 0 ? 'var(--risk-low)' : 'var(--risk-critical)',
              marginTop: 4,
            }}
          >
            {scenarioResult.pctChange <= 0 ? '' : '+'}
            {scenarioResult.pctChange.toFixed(1)}% Relative Change
          </div>
        </div>

        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
            INTERVENTION CAPITAL
          </div>
          <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 26, fontWeight: 700, color: 'var(--accent)' }}>
            {formatINR(scenarioResult.totalInvestment)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
            {activeInterventions.length} Active Interventions
          </div>
        </div>
      </motion.div>

      {/* Main Studio Grid: Left Experiments & Multipliers, Right Analytical Comparison */}
      <div className="scenario-shell">
        {/* Left Column: Interventions & Parameters */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
            Experiment Portfolio
          </div>
          <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)', marginBottom: 20 }}>
            Toggle Defensive Controls & Threats
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 36 }}>
            {PRESET_EXPERIMENTS.map((exp) => {
              const isSelected = activeInterventions.includes(exp.id)
              const isThreat = exp.category === 'threat'

              return (
                <div
                  key={exp.id}
                  onClick={() => toggleIntervention(exp.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '16px 20px',
                    background: isSelected ? 'var(--surface-raised)' : 'var(--surface-overlay)',
                    border: `1px solid ${
                      isSelected
                        ? isThreat
                          ? 'var(--risk-critical)'
                          : 'var(--risk-low)'
                        : 'var(--border-subtle)'
                    }`,
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} // Handled by container
                    style={{ width: 16, height: 16, accentColor: isThreat ? '#FF3B30' : '#00E676' }}
                  />

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {exp.name}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: isThreat ? 'var(--risk-critical)' : 'var(--risk-low)',
                          background: isThreat ? 'rgba(224,84,84,0.1)' : 'rgba(37,184,122,0.1)',
                          padding: '2px 6px',
                          borderRadius: 2,
                        }}
                      >
                        {isThreat ? 'Adversary Vector' : 'Defensive Intervention'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {exp.description}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {exp.costInr > 0 && (
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                        {formatINR(exp.costInr)}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: isThreat ? 'var(--risk-critical)' : 'var(--risk-low)',
                      }}
                    >
                      {exp.freqMod !== 0 && `${exp.freqMod > 0 ? '+' : ''}${Math.round(exp.freqMod * 100)}% Freq `}
                      {exp.sevMod !== 0 && `${exp.sevMod > 0 ? '+' : ''}${Math.round(exp.sevMod * 100)}% Sev`}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Global Multiplier Sliders */}
          <div style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 20 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 16 }}>
              Adversary Environment Calibrations
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Attack Frequency Multiplier</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent)' }}>
                  {threatMultiplier.toFixed(1)}×
                </span>
              </div>
              <input
                type="range"
                min={0.2}
                max={3.0}
                step={0.1}
                value={threatMultiplier}
                onChange={(e) => setThreatMultiplier(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)' }}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: 'var(--text-secondary)' }}>Impact Severity Multiplier</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--risk-high)' }}>
                  {severityMultiplier.toFixed(1)}×
                </span>
              </div>
              <input
                type="range"
                min={0.2}
                max={3.0}
                step={0.1}
                value={severityMultiplier}
                onChange={(e) => setSeverityMultiplier(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--risk-high)' }}
              />
            </div>
          </div>
        </motion.div>

        {/* Right Column: Comparative Visualizations */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
        >
          {/* Baseline vs Scenario Bar Chart */}
          <div style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
              Analytical Comparison
            </div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Baseline EAL vs Scenario Projection
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 24 }}>
              Visualizing the modeled annual financial outcome delta under the current experimental hypothesis.
            </div>

            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData} margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}
                    axisLine={{ stroke: 'var(--border-subtle)' }}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => formatINRCompact(v)}
                    tick={{ fontSize: 10, fill: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono, monospace' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(v: any) => [formatINR(Number(v)), 'Expected Annual Loss']}
                    contentStyle={{ background: 'rgba(7,11,20,0.95)', border: '1px solid var(--border-emphasis)', borderRadius: 4, fontSize: 11, color: 'var(--text-primary)' }}
                  />
                  <Bar dataKey="eal" radius={[4, 4, 0, 0]}>
                    {comparisonData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Historical Simulation Trend */}
          {!histLoading && trendData.length > 1 && (
            <div style={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
                Simulation Track Record
              </div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>
                Historical Run Convergence ({trendData.length} Runs)
              </div>

              <div style={{ width: '100%', height: 160 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                    <defs>
                      <linearGradient id="scenTrendGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--steel)" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="var(--steel)" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="timestamp"
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
                    <Area
                      type="monotone"
                      dataKey="eal"
                      stroke="var(--steel-bright)"
                      strokeWidth={1.5}
                      fill="url(#scenTrendGrad)"
                      dot={{ r: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
