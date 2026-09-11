import React, { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useHealth, useSeedMutation } from '../../api/hooks'
import { getBackendUrl, setBackendUrl } from '../../api/client'

const NAV_ITEMS = [
  { path: '/', label: 'Overview', index: '01', exact: true },
  { path: '/exposure', label: 'Exposure', index: '02', exact: false },
  { path: '/assets', label: 'Assets', index: '03', exact: false },
  { path: '/investment', label: 'Investment', index: '04', exact: false },
  { path: '/scenarios', label: 'Scenarios', index: '05', exact: false },
  { path: '/decisions', label: 'Decisions', index: '06', exact: false },
  { path: '/compliance', label: 'Compliance', index: '07', exact: false },
  { path: '/manual', label: 'Manual', index: '08', exact: false },
]

export default function Navigation() {
  const location = useLocation()
  const { data: health, isError } = useHealth()
  const seedMutation = useSeedMutation()
  const [showAdmin, setShowAdmin] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [backendInput, setBackendInput] = useState(getBackendUrl())
  const [seedStatus, setSeedStatus] = useState<string | null>(null)

  const isOnline = !isError && health?.status === 'running'
  const isCommand = location.pathname === '/'

  // Close mobile menu on route change
  useEffect(() => {
    setShowMobileMenu(false)
  }, [location.pathname])

  function handleSaveUrl() {
    setBackendUrl(backendInput)
    window.location.reload()
  }

  async function handleSeed() {
    setSeedStatus('seeding')
    try {
      const res = await seedMutation.mutateAsync()
      setSeedStatus(`Seeded ${res.inserted.assets} assets, ${res.inserted.vulnerabilities} CVEs, ${res.inserted.controls} controls`)
    } catch (e: any) {
      setSeedStatus(`Error: ${e.message}`)
    }
  }

  function isActive(item: typeof NAV_ITEMS[0]) {
    if (item.exact) return location.pathname === item.path
    return location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  }

  return (
    <>
      {/* Topbar */}
      <nav
        className={`app-topbar ${isCommand ? 'app-topbar--transparent' : 'app-topbar--solid'}`}
        role="navigation"
        aria-label="Main navigation"
      >
        {/* Brand */}
        <NavLink to="/" className="topbar-brand" aria-label="Cyber Risk Intelligence — Home">
          <svg className="topbar-brand-mark" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            {/* Outer ring */}
            <circle cx="14" cy="14" r="12" stroke="rgba(201,169,110,0.3)" strokeWidth="0.5" />
            {/* Inner structure */}
            <circle cx="14" cy="14" r="6" stroke="rgba(201,169,110,0.6)" strokeWidth="0.5" />
            {/* Center */}
            <circle cx="14" cy="14" r="2" fill="#C9A96E" />
            {/* Risk nodes */}
            <circle cx="14" cy="2" r="2" fill="#E05454" />
            <circle cx="25" cy="20.5" r="2" fill="#E89A1A" />
            <circle cx="3" cy="20.5" r="2" fill="#25B87A" />
            {/* Connection lines */}
            <line x1="14" y1="4" x2="14" y2="8" stroke="rgba(201,169,110,0.25)" strokeWidth="0.5" />
            <line x1="23.3" y1="19.5" x2="19.2" y2="17.5" stroke="rgba(201,169,110,0.25)" strokeWidth="0.5" />
            <line x1="4.7" y1="19.5" x2="8.8" y2="17.5" stroke="rgba(201,169,110,0.25)" strokeWidth="0.5" />
          </svg>
          <span className="topbar-brand-name">CRIQ</span>
        </NavLink>

        {/* Desktop nav items */}
        <div className="topbar-nav" role="list">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item)
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`topbar-nav-item ${active ? 'active' : ''}`}
                aria-current={active ? 'page' : undefined}
                role="listitem"
              >
                <span className="topbar-nav-index">{item.index}</span>
                <span className="topbar-nav-label">{item.label}</span>
              </NavLink>
            )
          })}
        </div>

        {/* Actions */}
        <div className="topbar-actions">
          {/* Status indicator */}
          <div className="topbar-status" aria-label={isOnline ? 'Backend online' : 'Backend offline'}>
            <span className={`status-dot ${isOnline ? '' : 'offline'}`} role="img" aria-hidden="true" />
            <span className="status-label" aria-live="polite">
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>

          {/* Admin button */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowAdmin(true)}
            aria-label="Open system settings"
            style={{ padding: '4px 10px', fontSize: 14 }}
          >
            ⚙
          </button>

          {/* Mobile menu toggle */}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            aria-label={showMobileMenu ? 'Close menu' : 'Open menu'}
            aria-expanded={showMobileMenu}
            style={{ padding: '4px 10px', display: 'none' }}
            id="mobile-menu-toggle"
          >
            {showMobileMenu ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile Nav Overlay */}
      <AnimatePresence>
        {showMobileMenu && (
          <motion.div
            className="mobile-nav-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 48 }}>
              <button
                className="btn btn-ghost"
                onClick={() => setShowMobileMenu(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item)
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={`mobile-nav-item ${active ? 'active' : ''}`}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="mobile-nav-index">{item.index}</span>
                  <span className="mobile-nav-label">{item.label}</span>
                </NavLink>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Modal */}
      <AnimatePresence>
        {showAdmin && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAdmin(false)}
            role="dialog"
            aria-modal="true"
            aria-label="System settings"
          >
            <motion.div
              className="admin-modal"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 6 }}>
                    System Settings
                  </div>
                  <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>
                    Backend Configuration
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowAdmin(false)} aria-label="Close settings">✕</button>
              </div>

              {/* Backend URL */}
              <div className="input-group" style={{ marginBottom: 16 }}>
                <label className="input-label" htmlFor="backend-url">FastAPI Backend URL</label>
                <input
                  id="backend-url"
                  className="input"
                  value={backendInput}
                  onChange={(e) => setBackendInput(e.target.value)}
                  placeholder="http://127.0.0.1:8000"
                  aria-label="Backend URL"
                />
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                <button className="btn btn-primary" onClick={handleSaveUrl} style={{ flex: 1 }}>
                  Save & Reload
                </button>
              </div>

              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '0 0 20px' }} />

              {/* Seed */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 12 }}>
                  Database
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={handleSeed}
                  disabled={seedMutation.isPending}
                  style={{ width: '100%' }}
                  aria-label="Seed database with synthetic data"
                >
                  {seedMutation.isPending ? '⟳  Seeding…' : '⊕  Seed Synthetic Telemetry'}
                </button>
                {seedStatus && (
                  <div style={{ marginTop: 10, fontSize: 12, color: seedStatus.startsWith('Error') ? 'var(--risk-critical)' : 'var(--risk-low)', lineHeight: 1.5 }}>
                    {seedStatus}
                  </div>
                )}
              </div>

              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6, borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
                Regulatory standards: RBI CSF · SEBI CSCRF · NIST CSF 2.0 · DPDPA 2023
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline styles for mobile menu toggle visibility */}
      <style>{`
        @media (max-width: 768px) {
          #mobile-menu-toggle { display: flex !important; }
        }
      `}</style>
    </>
  )
}
