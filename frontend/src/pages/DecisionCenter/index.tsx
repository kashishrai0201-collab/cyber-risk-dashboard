import React from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useEnterprise, useAssets, useCompliance } from '../../api/hooks'
import { formatINR, complianceStatus } from '../../lib/format'

interface EvidenceItem {
  number: string
  icon: string
  title: string
  description: string
  metrics: { label: string; value: string; color?: string }[]
  cta?: { label: string; to: string }
  severity: 'critical' | 'high' | 'ok'
}

export default function DecisionCenterPage() {
  const { data: enterprise, isLoading: entLoading } = useEnterprise()
  const { data: assets, isLoading: assetsLoading } = useAssets()
  const { data: compliance, isLoading: compLoading } = useCompliance()

  const isLoading = entLoading || assetsLoading || compLoading

  if (isLoading) return <DecisionLoadingSkeleton />

  const criticalAssets = assets?.filter(a => a.tier === 'Critical') ?? []
  const kevCount = assets?.reduce((s, a) => s + a.vulnerabilities.filter(v => v.cisa_kev && !v.is_patched).length, 0) ?? 0
  const unpatchedCritical = assets?.reduce((s, a) => s + a.vulnerabilities.filter(v => v.cvss_score >= 9 && !v.is_patched).length, 0) ?? 0
  const overallCompliance = compliance?.overall_compliance_index_percent ?? 0
  const penaltyExposure = compliance?.estimated_regulatory_penalty_exposure_inr ?? 0
  const gapCount = compliance?.gaps?.length ?? 0

  const compStatus = complianceStatus(overallCompliance)

  // Primary recommendation: based on worst metric
  const primaryAction = (() => {
    if (kevCount > 0) return {
      title: `Remediate ${kevCount} CISA KEV Vulnerabilities`,
      desc: `Active Known Exploited Vulnerabilities represent the highest-likelihood attack vectors. Immediate patching is mandated by CISA and aligns with RBI CSF Active Threat Intelligence requirements.`,
      urgency: 'critical' as const,
    }
    if (unpatchedCritical > 0) return {
      title: `Address ${unpatchedCritical} Critical-Severity CVEs`,
      desc: `CVSS ≥ 9.0 vulnerabilities across critical-tier assets represent high-probability pathways to significant financial loss. Prioritise patch deployment within 30 days.`,
      urgency: 'high' as const,
    }
    if (overallCompliance < 60) return {
      title: 'Strengthen Regulatory Compliance Posture',
      desc: `Overall compliance at ${overallCompliance.toFixed(1)}% creates ${formatINR(penaltyExposure)} in regulatory penalty exposure. Gap closure reduces both financial and reputational risk.`,
      urgency: 'high' as const,
    }
    return {
      title: 'Maintain Security Investment Cadence',
      desc: 'Current posture is strong. Sustain continuous monitoring, scheduled patching, and annual Monte Carlo reassessment to maintain risk within tolerance.',
      urgency: 'ok' as const,
    }
  })()

  const urgencyColor: Record<string, string> = { critical: 'var(--risk-critical)', high: 'var(--risk-high)', ok: 'var(--risk-low)' }

  const evidence: EvidenceItem[] = [
    {
      number: '01',
      icon: '◈',
      title: 'Financial Exposure',
      description: enterprise
        ? `The enterprise carries ${formatINR(enterprise.total_eal_inr)} in expected annual loss, with a 1-in-20 year tail event reaching ${formatINR(enterprise.var_95_inr)}. This exposure is driven by ${criticalAssets.length} critical-tier assets carrying disproportionate EAL concentration.`
        : 'Enterprise risk data unavailable.',
      metrics: enterprise ? [
        { label: 'Expected Annual Loss', value: formatINR(enterprise.total_eal_inr), color: 'var(--accent-bright)' },
        { label: 'P95 Value at Risk', value: formatINR(enterprise.var_95_inr), color: 'var(--risk-high)' },
        { label: 'P99 Value at Risk', value: formatINR(enterprise.var_99_inr), color: 'var(--risk-critical)' },
      ] : [],
      cta: { label: 'View Exposure →', to: '/exposure' },
      severity: 'critical',
    },
    {
      number: '02',
      icon: '◎',
      title: 'Asset Concentration Risk',
      description: `${criticalAssets.length} critical-tier assets represent the primary risk concentration. ${kevCount > 0 ? `${kevCount} CISA Known Exploited Vulnerabilities remain unpatched, creating imminent breach pathways.` : 'No CISA KEV exposure detected across the estate.'} ${unpatchedCritical} critical-severity CVEs (CVSS ≥ 9.0) require expedited remediation.`,
      metrics: [
        { label: 'Critical Assets', value: criticalAssets.length.toString(), color: 'var(--risk-critical)' },
        { label: 'CISA KEV Active', value: kevCount.toString(), color: kevCount > 0 ? 'var(--risk-critical)' : 'var(--risk-low)' },
        { label: 'Critical CVEs', value: unpatchedCritical.toString(), color: unpatchedCritical > 0 ? 'var(--risk-high)' : 'var(--risk-low)' },
      ],
      cta: { label: 'View Assets →', to: '/assets' },
      severity: kevCount > 0 ? 'critical' : unpatchedCritical > 0 ? 'high' : 'ok',
    },
    {
      number: '03',
      icon: '◉',
      title: 'Regulatory Compliance',
      description: `Overall compliance posture stands at ${overallCompliance.toFixed(1)}% (${compStatus.label}) across RBI CSF, SEBI CSCRF, and NIST CSF 2.0. ${gapCount > 0 ? `${gapCount} compliance gap${gapCount > 1 ? 's' : ''} have been identified, creating ${formatINR(penaltyExposure)} in estimated regulatory penalty exposure.` : 'No active compliance gaps detected.'}`,
      metrics: [
        { label: 'Overall Compliance', value: `${overallCompliance.toFixed(1)}%`, color: compStatus.color },
        { label: 'Active Gaps', value: gapCount.toString(), color: gapCount > 0 ? 'var(--risk-high)' : 'var(--risk-low)' },
        { label: 'Penalty Exposure', value: formatINR(penaltyExposure), color: penaltyExposure > 0 ? 'var(--accent)' : 'var(--risk-low)' },
      ],
      cta: { label: 'View Compliance →', to: '/compliance' },
      severity: overallCompliance < 60 ? 'critical' : overallCompliance < 85 ? 'high' : 'ok',
    },
    {
      number: '04',
      icon: '⬡',
      title: 'Investment Optimisation',
      description: 'The MILP security investment optimizer identifies the control portfolio that maximises risk reduction under budget constraints. Optimal allocation typically achieves 1.2–3.5× ROSI depending on the control ecosystem and current EAL distribution.',
      metrics: enterprise ? [
        { label: 'Baseline EAL', value: formatINR(enterprise.total_eal_inr), color: 'var(--text-secondary)' },
        { label: 'Simulation Basis', value: `${enterprise.simulation_iterations.toLocaleString('en-IN')} MC runs`, color: 'var(--text-tertiary)' },
      ] : [],
      cta: { label: 'Open Investment Lab →', to: '/investment' },
      severity: 'ok',
    },
  ]

  return (
    <div className="page-container--wide" style={{ paddingBottom: 80 }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ paddingTop: 40, marginBottom: 48 }}
      >
        <div className="section-number" style={{ marginBottom: 12 }}>06</div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.1 }}>
          Decision Center
        </h1>
        <p className="body-md" style={{ maxWidth: 540 }}>
          Evidence-based risk intelligence structured as an executive decision brief. Each finding is derived from live telemetry.
        </p>
      </motion.div>

      {/* Primary recommendation */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        style={{
          background: 'var(--surface-panel)',
          border: `1px solid ${urgencyColor[primaryAction.urgency]}`,
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-8)',
          marginBottom: 56,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Accent glow */}
        <div style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: urgencyColor[primaryAction.urgency],
          opacity: 0.04,
          pointerEvents: 'none',
        }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, position: 'relative' }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: urgencyColor[primaryAction.urgency], marginBottom: 8 }}>
              Primary Recommendation
            </div>
            <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)', marginBottom: 12, lineHeight: 1.3 }}>
              {primaryAction.title}
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: 700 }}>
              {primaryAction.desc}
            </p>
          </div>
          <span className={`badge ${primaryAction.urgency === 'ok' ? 'badge-low' : primaryAction.urgency === 'high' ? 'badge-high' : 'badge-critical'}`}
            style={{ flexShrink: 0 }}>
            {primaryAction.urgency === 'ok' ? 'Maintain' : primaryAction.urgency}
          </span>
        </div>
      </motion.div>

      {/* Evidence chain */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
          Intelligence
        </div>
        <h2 style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)', marginBottom: 40 }}>
          Risk Evidence Chain
        </h2>

        <div className="evidence-chain">
          {evidence.map((item, i) => (
            <motion.div
              key={item.number}
              className="evidence-item"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="evidence-index-col">
                <span className="evidence-number">{item.number}</span>
                <div className="evidence-icon-circle" style={{ borderColor: urgencyColor[item.severity] + '40' }}>
                  <span style={{ fontSize: 14 }}>{item.icon}</span>
                </div>
              </div>
              <div className="evidence-body">
                <h3 className="evidence-title">{item.title}</h3>
                <p className="evidence-description">{item.description}</p>
                {item.metrics.length > 0 && (
                  <div className="evidence-metrics">
                    {item.metrics.map(m => (
                      <div key={m.label} className="evidence-metric">
                        <span className="evidence-metric-label">{m.label}</span>
                        <span className="evidence-metric-value" style={{ color: m.color ?? 'var(--text-primary)' }}>
                          {m.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {item.cta && (
                  <Link
                    to={item.cta.to}
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 20, display: 'inline-flex', fontSize: 11, letterSpacing: '0.06em' }}
                    aria-label={item.cta.label}
                  >
                    {item.cta.label}
                  </Link>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* AI Architecture note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 32,
          display: 'flex',
          gap: 20,
          alignItems: 'flex-start',
        }}
      >
        <div style={{ fontSize: 18, opacity: 0.2, flexShrink: 0, marginTop: 2 }}>◌</div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 6 }}>
            AI Analysis — Ready
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6, maxWidth: 600 }}>
            This platform is architecturally prepared for LLM-augmented decision briefing. Integration with Gemini or other
            foundation models would enable natural-language synthesis of the above evidence chain into board-ready risk narratives.
            The data pipeline, risk signals, and structured context are in place.
          </p>
        </div>
      </motion.div>
    </div>
  )
}

function DecisionLoadingSkeleton() {
  return (
    <div className="page-container--wide" style={{ paddingTop: 40 }}>
      <div className="skeleton" style={{ width: 48, height: 10, marginBottom: 12 }} />
      <div className="skeleton" style={{ width: 240, height: 36, marginBottom: 12 }} />
      <div className="skeleton" style={{ width: 440, height: 16, marginBottom: 48 }} />
      <div className="skeleton" style={{ height: 120, marginBottom: 56, borderRadius: 8 }} />
      {[...Array(4)].map((_, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 24, marginBottom: 40 }}>
          <div className="skeleton" style={{ height: 36, borderRadius: '50%' }} />
          <div>
            <div className="skeleton" style={{ height: 18, width: 200, marginBottom: 12 }} />
            <div className="skeleton" style={{ height: 60, marginBottom: 16 }} />
            <div style={{ display: 'flex', gap: 16 }}>
              {[...Array(3)].map((_, j) => <div key={j} className="skeleton" style={{ height: 48, flex: 1 }} />)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}


