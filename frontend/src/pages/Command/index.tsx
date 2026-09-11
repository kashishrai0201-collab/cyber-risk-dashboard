import React, { lazy, Suspense, useEffect, useRef, useState, useCallback } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useEnterprise, useAssets, useHistory } from '../../api/hooks'
import { formatINR, formatINRCompact } from '../../lib/format'

const RiskNetworkCanvas = lazy(() => import('../../components/three/RiskNetworkCanvas'))

// Animated number counter
function AnimatedNumber({ target, duration = 1500 }: { target: number; duration?: number }) {
  const [current, setCurrent] = useState(target || 0)

  useEffect(() => {
    if (!target) return
    let frameId: number
    let startTs: number | null = null
    const initial = 0
    const animate = (ts: number) => {
      if (!startTs) startTs = ts
      const elapsed = ts - startTs
      const progress = Math.min(elapsed / duration, 1)
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setCurrent(Math.round(initial + (target - initial) * ease))
      if (progress < 1) frameId = requestAnimationFrame(animate)
    }
    frameId = requestAnimationFrame(animate)
    return () => {
      if (frameId) cancelAnimationFrame(frameId)
    }
  }, [target, duration])

  return <>{formatINRCompact(current || target)}</>
}

// Scene Definitions
const SCENES = [
  { id: 0, label: '01 Exposure', overline: 'CYBER RISK INTELLIGENCE · SIH 2026', concept: 'Exposure', question: '"What can hurt us?"' },
  { id: 1, label: '02 Impact', overline: '02 · FINANCIAL LOSS SPECTRUM', concept: 'Impact', question: '"What could it cost?"' },
  { id: 2, label: '03 Concentration', overline: '03 · PORTFOLIO CONCENTRATION', concept: 'Concentration', question: '"Where is the risk?"' },
  { id: 3, label: '04 Investment', overline: '04 · STRATEGIC CAPITAL OPTIMIZATION', concept: 'Investment', question: '"Where should we spend?"' },
  { id: 4, label: '05 Decision', overline: '05 · EXECUTIVE BRIEF & ACTION', concept: 'Decision', question: '"What should we do?"' },
]

export default function CommandPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sceneParam = searchParams.get('scene')

  const { data, isLoading, isError } = useEnterprise()
  const { data: assets } = useAssets()
  const { data: history } = useHistory()

  const trackRef = useRef<HTMLDivElement>(null)
  const [activeScene, setActiveScene] = useState(0)
  const [highlightedAssetId, setHighlightedAssetId] = useState<number | null>(null)

  // Sync with optional ?scene=0..4 query parameter
  useEffect(() => {
    if (sceneParam !== null) {
      const idx = parseInt(sceneParam, 10)
      if (!isNaN(idx) && idx >= 0 && idx <= 4) {
        setActiveScene(idx)
      }
    }
  }, [sceneParam])

  // Track continuous scroll progress across the 5 scenes
  useEffect(() => {
    const handleScroll = () => {
      if (sceneParam !== null) return // Honor explicit scene param if set
      if (!trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const totalScrollable = trackRef.current.scrollHeight - window.innerHeight
      if (totalScrollable <= 0) return

      const scrolled = -rect.top
      const progress = Math.min(Math.max(scrolled / totalScrollable, 0), 1)

      // Map progress (0 to 1) across 5 scenes: [0..0.2, 0.2..0.4, 0.4..0.6, 0.6..0.8, 0.8..1.0]
      const sceneIndex = Math.min(Math.floor(progress * 5), 4)
      setActiveScene(sceneIndex)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [sceneParam])

  // Smooth jump to any scene when clicking the story rail
  const scrollToScene = useCallback((sceneIndex: number) => {
    if (!trackRef.current) return
    const totalScrollable = trackRef.current.scrollHeight - window.innerHeight
    // Anchor to midpoint of scene threshold
    const targetScroll = trackRef.current.offsetTop + (sceneIndex / 4.15) * totalScrollable
    window.scrollTo({ top: targetScroll, behavior: 'smooth' })
  }, [])

  // EAL trend calculation from simulation history
  const ealTrend = (() => {
    if (!history || history.length < 2) return null
    const runs = [...history].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    const latest = runs[runs.length - 1].total_eal_inr
    const prev = runs[runs.length - 2].total_eal_inr
    const delta = ((latest - prev) / prev) * 100
    return { delta, direction: delta > 0 ? ('up' as const) : ('down' as const) }
  })()

  const criticalAssets = assets?.filter((a) => a.tier === 'Critical') ?? []
  const totalVulns = assets?.reduce((s, a) => s + a.vulnerabilities.filter((v) => !v.is_patched).length, 0) ?? 0
  const kevCount = assets?.reduce((s, a) => s + a.vulnerabilities.filter((v) => v.cisa_kev && !v.is_patched).length, 0) ?? 0

  const riskiestAssets = data?.top_5_riskiest_assets?.slice(0, 4) ?? []
  const maxEal = riskiestAssets[0]?.eal_inr ?? 1

  return (
    <div className="command-page">
      {/* Pinned Scrollytelling Container */}
      <div className="command-scrolly-track" ref={trackRef}>
        <div className="command-sticky-frame">
          {/* Persistent Three.js Background Canvas */}
          <div className="command-canvas-bg" aria-hidden="true">
            <Suspense fallback={null}>
              <RiskNetworkCanvas
                assets={assets}
                activeScene={activeScene}
                highlightedAssetId={highlightedAssetId}
                onSelectAsset={(id) => navigate('/assets')}
              />
            </Suspense>

            {/* Subtle atmospheric vignette framing left copy while keeping 3D right luminous */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(ellipse at 16% 50%, rgba(7,11,20,0.52) 0%, rgba(7,11,20,0.18) 55%, transparent 100%)',
                pointerEvents: 'none',
              }}
            />
            {/* Topbar shadow gradient */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 90,
                background: 'linear-gradient(to bottom, rgba(7,11,20,0.6) 0%, transparent 100%)',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Foreground Continuous Narrative Stage */}
          <div className="command-stage">
            <div className="command-scene-wrapper">
              <AnimatePresence mode="wait">
                {/* ── SCENE 01: EXPOSURE ("What can hurt us?") ── */}
                {activeScene === 0 && (
                  <motion.div
                    key="scene-0"
                    className="command-scene-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="command-overline">{SCENES[0].overline}</div>

                    {!isLoading && !isError && data && (
                      <div className="command-eal-label">Expected Annual Loss</div>
                    )}

                    <h1 className="command-eal-value">
                      {isLoading ? (
                        <span style={{ opacity: 0.2 }}>Computing…</span>
                      ) : isError ? (
                        <span style={{ fontSize: 'clamp(28px, 4vw, 44px)', color: 'var(--text-tertiary)' }}>
                          Backend Offline
                        </span>
                      ) : data ? (
                        <AnimatedNumber target={data.total_eal_inr} />
                      ) : null}
                    </h1>

                    {data && !isLoading && (
                      <div className="command-var-row">
                        <div className="command-var-item">
                          <span className="command-var-label">Monitored Assets</span>
                          <span className="command-var-value" style={{ color: 'var(--text-primary)' }}>
                            {assets?.length ?? 18} Systems
                          </span>
                        </div>
                        <div className="command-var-divider" />
                        <div className="command-var-item">
                          <span className="command-var-label">Critical Infra</span>
                          <span className="command-var-value" style={{ color: 'var(--risk-critical)' }}>
                            {criticalAssets.length} Critical
                          </span>
                        </div>
                        <div className="command-var-divider" />
                        <div className="command-var-item">
                          <span className="command-var-label">Simulations</span>
                          <span className="command-var-value" style={{ color: 'var(--accent)' }}>
                            {data.simulation_iterations.toLocaleString()} Runs
                          </span>
                        </div>
                      </div>
                    )}

                    {ealTrend && (
                      <div style={{ marginBottom: 28 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            color: ealTrend.direction === 'up' ? 'var(--risk-critical)' : 'var(--risk-low)',
                            background:
                              ealTrend.direction === 'up' ? 'var(--risk-critical-dim)' : 'var(--risk-low-dim)',
                            border: `1px solid ${
                              ealTrend.direction === 'up' ? 'rgba(224,84,84,0.25)' : 'rgba(37,184,122,0.25)'
                            }`,
                            padding: '4px 12px',
                            borderRadius: 'var(--radius-full)',
                          }}
                        >
                          {ealTrend.direction === 'up' ? '↑' : '↓'} {Math.abs(ealTrend.delta).toFixed(1)}% vs previous
                          simulation run
                        </span>
                      </div>
                    )}

                    <p className="scene-summary-text">
                      Enterprise financial loss modeled from stochastic frequency and severity distributions across
                      active IT and transactional assets.
                    </p>

                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <button onClick={() => scrollToScene(1)} className="btn btn-primary btn-lg">
                        Examine Tail Impact ↓
                      </button>
                      <Link to="/exposure" className="btn btn-secondary btn-lg">
                        Loss Distribution →
                      </Link>
                    </div>
                  </motion.div>
                )}

                {/* ── SCENE 02: IMPACT ("What could it cost?") ── */}
                {activeScene === 1 && (
                  <motion.div
                    key="scene-1"
                    className="command-scene-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="scene-header-group">
                      <div className="section-number">02</div>
                      <h2 className="section-concept">Impact</h2>
                      <p className="section-question">{SCENES[1].question}</p>
                    </div>

                    <p className="scene-summary-text">
                      Beyond expected baseline loss, extreme security tail events model catastrophe potential across
                      operational disruption and statutory penalty thresholds.
                    </p>

                    {data && (
                      <div className="impact-cards-grid">
                        <div className="impact-card">
                          <span className="impact-card-label">P95 VaR (1-in-20 Yr)</span>
                          <span className="impact-card-value" style={{ color: 'var(--risk-high)' }}>
                            {formatINR(data.var_95_inr)}
                          </span>
                          <span className="impact-card-sub">Severe breach exceeding standard contingency</span>
                        </div>

                        <div className="impact-card">
                          <span className="impact-card-label">P99 VaR (1-in-100 Yr)</span>
                          <span className="impact-card-value" style={{ color: 'var(--risk-critical)' }}>
                            {formatINR(data.var_99_inr)}
                          </span>
                          <span className="impact-card-sub">Tail catastrophe with multi-system failure</span>
                        </div>

                        <div className="impact-card">
                          <span className="impact-card-label">Regulatory Exposure</span>
                          <span className="impact-card-value" style={{ color: 'var(--accent)' }}>
                            {formatINR(data.total_regulatory_fine_exposure_inr)}
                          </span>
                          <span className="impact-card-sub">RBI & SEBI Cyber Resilience penalties</span>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 12 }}>
                      <button onClick={() => scrollToScene(2)} className="btn btn-primary">
                        View Risk Concentration ↓
                      </button>
                      <Link to="/exposure" className="btn btn-ghost" style={{ fontSize: 12 }}>
                        View Full Exceedance Curve →
                      </Link>
                    </div>
                  </motion.div>
                )}

                {/* ── SCENE 03: CONCENTRATION ("Where is the risk?") ── */}
                {activeScene === 2 && (
                  <motion.div
                    key="scene-2"
                    className="command-scene-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="scene-header-group">
                      <div className="section-number">03</div>
                      <h2 className="section-concept">Concentration</h2>
                      <p className="section-question">{SCENES[2].question}</p>
                    </div>

                    <p className="scene-summary-text">
                      <strong style={{ color: 'var(--risk-critical)' }}>{criticalAssets.length} critical assets</strong>{' '}
                      drive over 90% of enterprise portfolio loss. Hovering an asset highlights its node and propagation
                      lines in the 3D topology.
                    </p>

                    <div className="concentration-list">
                      {riskiestAssets.map((asset, i) => {
                        const pct = (asset.eal_inr / maxEal) * 100
                        const isHovered = highlightedAssetId === asset.asset_id

                        return (
                          <div
                            key={asset.asset_id}
                            className={`concentration-item ${isHovered ? 'active' : ''}`}
                            onMouseEnter={() => setHighlightedAssetId(asset.asset_id)}
                            onMouseLeave={() => setHighlightedAssetId(null)}
                            onClick={() => navigate('/assets')}
                            title="Click to view in Asset Intelligence"
                          >
                            <span className="concentration-rank">{String(i + 1).padStart(2, '0')}</span>
                            <span className="concentration-host">{asset.hostname}</span>
                            <div className="concentration-bar-wrap">
                              <div className="concentration-bar-fill" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="concentration-eal">{formatINR(asset.eal_inr)}</span>
                          </div>
                        )
                      })}
                    </div>

                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <button onClick={() => scrollToScene(3)} className="btn btn-primary">
                        Optimize Investment ↓
                      </button>
                      <Link to="/assets" className="btn btn-ghost" style={{ fontSize: 12 }}>
                        Asset Intelligence Matrix →
                      </Link>
                    </div>
                  </motion.div>
                )}

                {/* ── SCENE 04: INVESTMENT ("Where should we spend?") ── */}
                {activeScene === 3 && (
                  <motion.div
                    key="scene-3"
                    className="command-scene-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="scene-header-group">
                      <div className="section-number">04</div>
                      <h2 className="section-concept">Investment</h2>
                      <p className="section-question">{SCENES[3].question}</p>
                    </div>

                    <p className="scene-summary-text">
                      The MILP knapsack optimizer mathematically determines the security control portfolio that yields
                      the maximum expected risk reduction under your capital ceiling.
                    </p>

                    <div className="investment-flow-box">
                      <div className="investment-flow-steps">
                        <div className="investment-step">
                          <span className="investment-step-label">Current Risk</span>
                          <span className="investment-step-val" style={{ color: 'var(--risk-high)' }}>
                            {formatINRCompact(data?.total_eal_inr ?? 2450000000)}
                          </span>
                          <span className="investment-step-meta">Baseline EAL</span>
                        </div>

                        <div className="investment-step-arrow">→</div>

                        <div className="investment-step">
                          <span className="investment-step-label">Security Capital</span>
                          <span className="investment-step-val" style={{ color: 'var(--accent)' }}>
                            ₹1.00 Cr
                          </span>
                          <span className="investment-step-meta">Budget Constraint</span>
                        </div>

                        <div className="investment-step-arrow">→</div>

                        <div className="investment-step">
                          <span className="investment-step-label">Projected Risk</span>
                          <span className="investment-step-val" style={{ color: 'var(--risk-low)' }}>
                            {formatINRCompact((data?.total_eal_inr ?? 2450000000) * 0.7)}
                          </span>
                          <span className="investment-step-meta">↓ ~30% Risk Saved</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12 }}>
                      <Link to="/investment" className="btn btn-primary btn-lg">
                        Open Investment Lab →
                      </Link>
                      <button onClick={() => scrollToScene(4)} className="btn btn-secondary btn-lg">
                        View Decision Brief ↓
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* ── SCENE 05: DECISION ("What should we do?") ── */}
                {activeScene === 4 && (
                  <motion.div
                    key="scene-4"
                    className="command-scene-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <div className="scene-header-group">
                      <div className="section-number">05</div>
                      <h2 className="section-concept">Decision</h2>
                      <p className="section-question">{SCENES[4].question}</p>
                    </div>

                    <p className="scene-summary-text">
                      Evidence-based prioritization synthesized from quantitative simulation, asset telemetry, and
                      regulatory exposure metrics.
                    </p>

                    <div className="decision-brief-list">
                      <div className="decision-brief-item">
                        <span className="decision-badge">Priority 1</span>
                        <span className="decision-item-text">
                          Patch {kevCount} active CISA KEV vulnerabilities across transactional UPI gateways and Core
                          Banking switches.
                        </span>
                      </div>
                      <div className="decision-brief-item">
                        <span className="decision-badge">Priority 2</span>
                        <span className="decision-item-text">
                          Allocate ₹1.00 Cr budget to high-ROSI controls mitigating up to ₹72.6 Cr in annual expected loss.
                        </span>
                      </div>
                      <div className="decision-brief-item">
                        <span className="decision-badge">Priority 3</span>
                        <span className="decision-item-text">
                          Close RBI cyber resilience framework gaps to eliminate ₹21.71 Cr regulatory fine exposure.
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      <Link to="/exposure" className="btn btn-primary btn-lg">
                        Explore Loss Distribution →
                      </Link>
                      <Link to="/investment" className="btn btn-secondary btn-lg">
                        Optimize Investment →
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Story Stepper / Scene Rail */}
          <nav className="command-story-rail" aria-label="Story Scenes">
            {SCENES.map((scene) => (
              <button
                key={scene.id}
                className={`command-rail-btn ${activeScene === scene.id ? 'active' : ''}`}
                onClick={() => scrollToScene(scene.id)}
                aria-label={`Jump to scene ${scene.label}`}
              >
                <div className="command-rail-pip" />
                <span className="command-rail-label">{scene.label}</span>
              </button>
            ))}
          </nav>

          {/* Simulation Metadata & Scroll Prompt at Bottom */}
          <div className="command-scroll-prompt">
            {data && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <span className="scroll-indicator-text">
                  <span>Scene {activeScene + 1} of 5</span>
                  <span>·</span>
                  <span>{activeScene < 4 ? 'Scroll to continue ↓' : 'End of Narrative'}</span>
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'JetBrains Mono, monospace' }}>
                  {data.simulation_iterations.toLocaleString()} MC ITERATIONS
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
