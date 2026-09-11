import React, { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { useCompliance } from '../../api/hooks'
import { formatINR, complianceStatus } from '../../lib/format'
import type { ComplianceGap } from '../../api/types'

const FRAMEWORKS = [
  { key: 'rbi_compliance_index_percent', label: 'RBI CSF', color: '#5B7FA8', full: 'Reserve Bank of India Cyber Security Framework' },
  { key: 'sebi_compliance_index_percent', label: 'SEBI CSCRF', color: '#C9A96E', full: 'SEBI Cyber Security & Cyber Resilience Framework' },
  { key: 'nist_csf_compliance_index_percent', label: 'NIST CSF 2.0', color: '#25B87A', full: 'NIST Cybersecurity Framework 2.0' },
  { key: 'iso27001_compliance_index_percent', label: 'ISO 27001:2022', color: '#38B8E0', full: 'ISO/IEC 27001 Information Security & TPRM Governance' },
  { key: 'iso42001_compliance_index_percent', label: 'ISO 42001:2023', color: '#A855F7', full: 'ISO/IEC 42001 Artificial Intelligence Management' },
] as const

export default function CompliancePage() {
  const { data, isLoading, isError } = useCompliance()

  if (isLoading) return <ComplianceLoadingSkeleton />
  if (isError || !data) return (
    <div className="page-container" style={{ paddingTop: 40 }}>
      <div className="banner banner-error">
        <span>⚠</span>
        <span>Failed to load compliance data. Ensure the backend is running and the database is seeded.</span>
      </div>
    </div>
  )

  const overallStatus = complianceStatus(data.overall_compliance_index_percent)
  const isRbiCompliant = data.rbi_localization_status === 'Compliant'

  const radarData = [
    { axis: 'RBI CSF', value: data.rbi_compliance_index_percent },
    { axis: 'SEBI CSCRF', value: data.sebi_compliance_index_percent },
    { axis: 'NIST CSF 2.0', value: data.nist_csf_compliance_index_percent },
    { axis: 'ISO 27001', value: data.iso27001_compliance_index_percent },
    { axis: 'ISO 42001', value: data.iso42001_compliance_index_percent },
    { axis: 'Overall', value: data.overall_compliance_index_percent },
  ]

  return (
    <div className="page-container--wide" style={{ paddingBottom: 80 }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{ paddingTop: 40, marginBottom: 40 }}
      >
        <div className="section-number" style={{ marginBottom: 12 }}>07 · STATUTORY & REGULATORY AUDIT</div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', marginBottom: 8, lineHeight: 1.1 }}>
          Compliance & Governance
        </h1>
        <p className="body-md" style={{ maxWidth: 640 }}>
          Continuous statutory benchmarking across RBI CSF, SEBI CSCRF, NIST CSF 2.0, ISO 27001:2022, ISO 42001:2023,
          and DPDPA 2023 data localization directives based on active technical controls.
        </p>
      </motion.div>

      {/* Primary & Framework score grid */}
      <motion.div
        className="compliance-scores-grid"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        role="list"
        aria-label="Compliance framework scores"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}
      >
        {/* Overall Posture */}
        <div className="compliance-score-cell" role="listitem" aria-label={`Overall: ${data.overall_compliance_index_percent.toFixed(1)}%`}>
          <div className="compliance-score-framework" style={{ color: overallStatus.color }}>Overall Posture</div>
          <div className="compliance-score-value" style={{ color: overallStatus.color }}>
            {data.overall_compliance_index_percent.toFixed(1)}%
          </div>
          <div className="compliance-score-bar-track">
            <AnimatedBar pct={data.overall_compliance_index_percent} color={overallStatus.color} delay={0.2} />
          </div>
          <div style={{ fontSize: 11, color: overallStatus.color, fontWeight: 600, letterSpacing: '0.04em' }}>
            {overallStatus.label}
          </div>
        </div>

        {/* 5 Specific Frameworks */}
        {FRAMEWORKS.map((fw, i) => {
          const pct = (data as any)[fw.key] as number
          return (
            <div key={fw.key} className="compliance-score-cell" role="listitem" aria-label={`${fw.label}: ${pct.toFixed(1)}%`}>
              <div className="compliance-score-framework" style={{ color: fw.color }}>{fw.label}</div>
              <div className="compliance-score-value" style={{ color: fw.color }}>{pct.toFixed(1)}%</div>
              <div className="compliance-score-bar-track">
                <AnimatedBar pct={pct} color={fw.color} delay={0.25 + i * 0.05} />
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={fw.full}>
                {fw.full}
              </div>
            </div>
          )
        })}
      </motion.div>

      {/* Statutory Dual Banners: Penalty Exposure & Cross-Border Residency */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24, marginBottom: 48 }}>
        {/* Penalty Exposure */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
            padding: '24px 28px',
            background: 'var(--surface-panel)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 8 }}>
              Estimated Statutory Penalty Exposure
            </div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--risk-high)', lineHeight: 1 }}>
              {formatINR(data.estimated_regulatory_penalty_exposure_inr)}
            </div>
          </div>
          <div style={{ maxWidth: 280, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            Projected regulatory liability under RBI CSF, SEBI CSCRF, and DPDPA 2023 provisions based on current control gaps.
          </div>
        </motion.div>

        {/* Cross-Border Transfer & RBI Localization Status */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 24,
            padding: '24px 28px',
            background: 'var(--surface-panel)',
            border: `1px solid ${isRbiCompliant ? 'var(--border-subtle)' : 'rgba(255, 59, 48, 0.3)'}`,
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 8 }}>
              Cross-Border & RBI Localization Posture
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, color: isRbiCompliant ? 'var(--risk-low)' : 'var(--risk-critical)' }}>
                {data.cross_border_compliance_index_percent.toFixed(1)}%
              </span>
              <span className={`badge ${isRbiCompliant ? 'badge-low' : 'badge-critical'}`} style={{ fontSize: 10, padding: '4px 8px' }}>
                RBI: {data.rbi_localization_status}
              </span>
            </div>
          </div>
          <div style={{ maxWidth: 260, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            Automated verification of data residency borders, sub-processor consent mechanisms, and statutory onshore localization.
          </div>
        </motion.div>
      </div>

      {/* Radar + Gap list */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 48, alignItems: 'start' }}>
        {/* Radar chart */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
        >
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 20 }}>
            Framework Readiness Radar
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData} margin={{ top: 10, right: 25, bottom: 10, left: 25 }}>
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis
                dataKey="axis"
                tick={{ fill: 'var(--text-secondary)', fontSize: 10, fontFamily: 'Inter, sans-serif', fontWeight: 500 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={{ fill: 'var(--text-tertiary)', fontSize: 9 }}
                stroke="transparent"
              />
              <Tooltip
                formatter={(v: any) => [`${Number(v ?? 0).toFixed(1)}%`, 'Readiness']}
                contentStyle={{ background: 'var(--surface-overlay)', border: '1px solid var(--border-emphasis)', borderRadius: 4, fontSize: 11, color: 'var(--text-primary)' }}
              />
              {/* Target 100% */}
              <Radar name="Target" dataKey={() => 100} stroke="rgba(255,255,255,0.08)" strokeWidth={1} strokeDasharray="4 4" fill="transparent" />
              {/* Current */}
              <Radar name="Readiness" dataKey="value" stroke="#5B7FA8" strokeWidth={2} fill="#5B7FA8" fillOpacity={0.12} dot={{ r: 4, fill: '#5B7FA8', stroke: 'var(--surface-void)', strokeWidth: 2 }} />
            </RadarChart>
          </ResponsiveContainer>

          {/* Framework detail breakdown cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
            {FRAMEWORKS.map(fw => {
              const pct = (data as any)[fw.key] as number
              const fwGaps = data.gaps.filter(g => g.framework.startsWith(fw.label.split(':')[0]))
              return (
                <div key={fw.key} style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: fw.color }}>{fw.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {fwGaps.length === 0 ? '✓ Fully covered' : `${fwGaps.length} gap${fwGaps.length > 1 ? 's' : ''} identified`}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: fw.color }}>
                    {pct.toFixed(1)}%
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>

        {/* Compliance gaps */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
              Compliance Gaps & Statutory Remediation
            </div>
            {data.gaps.length > 0 && (
              <span className="badge badge-high">{data.gaps.length} gap{data.gaps.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {data.gaps.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-glyph">✓</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, color: 'var(--risk-low)', marginBottom: 4 }}>Zero Active Gaps</div>
              <div>All framework categories are fully covered by active security controls.</div>
            </div>
          ) : (
            <div role="list" aria-label="Compliance gaps" style={{ maxHeight: 680, overflowY: 'auto' }}>
              {data.gaps.map((gap, i) => (
                <GapRow key={i} gap={gap} index={i} />
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}

function AnimatedBar({ pct, color, delay }: { pct: number; color: string; delay: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })
  return (
    <motion.div
      ref={ref}
      className="compliance-score-bar-fill"
      initial={{ width: 0 }}
      animate={inView ? { width: `${pct}%` } : {}}
      transition={{ duration: 1, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{ background: color }}
    />
  )
}

function GapRow({ gap, index }: { gap: ComplianceGap; index: number }) {
  const fwColor =
    gap.framework.includes('RBI') ? '#5B7FA8' :
    gap.framework.includes('SEBI') ? '#C9A96E' :
    gap.framework.includes('NIST') ? '#25B87A' :
    gap.framework.includes('ISO 27001') ? '#38B8E0' :
    gap.framework.includes('ISO 42001') ? '#A855F7' :
    gap.framework.includes('DPDPA') ? '#E11D48' :
    '#94A3B8'

  return (
    <motion.div
      className="gap-row"
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4 + index * 0.05 }}
      role="listitem"
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          className="gap-framework-badge"
          style={{ background: `${fwColor}18`, color: fwColor, border: `1px solid ${fwColor}30` }}
        >
          {gap.framework}
        </span>
      </div>
      <div className="gap-category">{gap.category}</div>
      <div className="gap-description">{gap.description}</div>
      {gap.recommended_control_codes.length > 0 && (
        <div className="gap-controls" aria-label="Recommended controls">
          {gap.recommended_control_codes.map(code => (
            <span key={code} className="gap-control-code">{code}</span>
          ))}
        </div>
      )}
    </motion.div>
  )
}

function ComplianceLoadingSkeleton() {
  return (
    <div className="page-container--wide" style={{ paddingTop: 40 }}>
      <div className="skeleton" style={{ width: 48, height: 10, marginBottom: 12 }} />
      <div className="skeleton" style={{ width: 200, height: 36, marginBottom: 12 }} />
      <div className="skeleton" style={{ width: 440, height: 16, marginBottom: 48 }} />
      <div className="compliance-scores-grid" style={{ marginBottom: 32 }}>
        {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: 110 }} />)}
      </div>
      <div className="skeleton" style={{ height: 80, marginBottom: 48 }} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 48 }}>
        <div className="skeleton" style={{ height: 500 }} />
        <div className="skeleton" style={{ height: 500 }} />
      </div>
    </div>
  )
}
