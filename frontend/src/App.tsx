import React, { Suspense, lazy } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Navigation from './components/layout/Navigation'

// Lazy-load all pages for code splitting
const CommandPage = lazy(() => import('./pages/Command'))
const ExposurePage = lazy(() => import('./pages/Exposure'))
const AssetIntelligencePage = lazy(() => import('./pages/AssetIntelligence'))
const InvestmentLabPage = lazy(() => import('./pages/InvestmentLab'))
const ScenarioStudioPage = lazy(() => import('./pages/ScenarioStudio'))
const DecisionCenterPage = lazy(() => import('./pages/DecisionCenter'))
const CompliancePage = lazy(() => import('./pages/Compliance'))
const ManualPage = lazy(() => import('./pages/Manual'))

function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      style={{ minHeight: '100vh' }}
    >
      {children}
    </motion.div>
  )
}

function PageLoading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 20, color: 'var(--text-tertiary)' }}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" style={{ opacity: 0.3 }}>
        <circle cx="14" cy="14" r="12" stroke="#C9A96E" strokeWidth="0.5" />
        <circle cx="14" cy="14" r="6" stroke="#C9A96E" strokeWidth="0.5" />
        <circle cx="14" cy="14" r="2" fill="#C9A96E" />
      </svg>
      <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.14em', textTransform: 'uppercase', opacity: 0.4 }}>Loading</div>
    </div>
  )
}

export default function App() {
  const location = useLocation()
  const isCommand = location.pathname === '/'

  return (
    <div className="app-shell">
      <Navigation />
      <main className={`app-content ${isCommand ? 'app-content--immersive' : ''}`} role="main">
        <Suspense fallback={<PageLoading />}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<PageWrapper><CommandPage /></PageWrapper>} />
              <Route path="/exposure" element={<PageWrapper><ExposurePage /></PageWrapper>} />
              <Route path="/assets" element={<PageWrapper><AssetIntelligencePage /></PageWrapper>} />
              <Route path="/investment" element={<PageWrapper><InvestmentLabPage /></PageWrapper>} />
              <Route path="/scenarios" element={<PageWrapper><ScenarioStudioPage /></PageWrapper>} />
              <Route path="/decisions" element={<PageWrapper><DecisionCenterPage /></PageWrapper>} />
              <Route path="/compliance" element={<PageWrapper><CompliancePage /></PageWrapper>} />
              <Route path="/manual" element={<PageWrapper><ManualPage /></PageWrapper>} />
              <Route path="*" element={
                <PageWrapper>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 24 }}>
                    <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 80, fontWeight: 800, letterSpacing: '-0.04em', opacity: 0.08, color: 'var(--text-primary)' }}>404</div>
                    <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>This page does not exist.</div>
                    <a href="/" className="btn btn-secondary">← Return to Overview</a>
                  </div>
                </PageWrapper>
              } />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </main>
    </div>
  )
}
