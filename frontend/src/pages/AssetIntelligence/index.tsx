import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAssets } from '../../api/hooks'
import { formatINR, cvssColor } from '../../lib/format'
import type { AssetRead, VulnerabilityRead } from '../../api/types'

const TIER_ORDER = ['Critical', 'Medium', 'Low'] as const

function tierDotColor(tier: string) {
  if (tier === 'Critical') return 'var(--risk-critical)'
  if (tier === 'Medium') return 'var(--risk-high)'
  return 'var(--risk-low)'
}

function tierBadge(tier: string) {
  if (tier === 'Critical') return 'badge badge-critical'
  if (tier === 'Medium') return 'badge badge-high'
  return 'badge badge-low'
}

export default function AssetIntelligencePage() {
  const { data: assets, isLoading, isError } = useAssets()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [tierFilter, setTierFilter] = useState<string>('All')

  const filtered = useMemo(() => {
    if (!assets) return []
    return assets
      .filter(a => tierFilter === 'All' || a.tier === tierFilter)
      .filter(a => !search || a.hostname.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const to = TIER_ORDER.indexOf(a.tier as any) - TIER_ORDER.indexOf(b.tier as any)
        if (to !== 0) return to
        return (b.estimated_eal_inr ?? 0) - (a.estimated_eal_inr ?? 0)
      })
  }, [assets, tierFilter, search])

  // Select first when filter changes
  const selected = assets?.find(a => a.id === selectedId) ?? filtered[0] ?? null

  if (isLoading) return <AssetLoadingSkeleton />
  if (isError || !assets) return (
    <div className="page-container" style={{ paddingTop: 40 }}>
      <div className="banner banner-error">
        <span>⚠</span>
        <span>Failed to load asset data. Ensure the backend is running and the database is seeded.</span>
      </div>
    </div>
  )

  return (
    <div className="asset-shell" role="main">
      {/* Left — asset list panel */}
      <div className="asset-list-panel">
        {/* Header */}
        <div className="asset-list-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 4 }}>03 · INVENTORY & TPRM</div>
              <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--text-primary)', lineHeight: 1.2 }}>
                Asset Intelligence
              </h1>
            </div>
            {/* Search */}
            <input
              className="search-input"
              style={{ width: '100%' }}
              placeholder="Search hostname…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              aria-label="Search assets by hostname"
            />
            {/* Tier filter */}
            <div className="tier-tabs" role="tablist" aria-label="Filter by tier">
              {['All', 'Critical', 'Medium', 'Low'].map(t => (
                <button
                  key={t}
                  className={`tier-tab ${tierFilter === t ? 'active' : ''}`}
                  onClick={() => setTierFilter(t)}
                  role="tab"
                  aria-selected={tierFilter === t}
                  aria-label={`Filter: ${t}`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.04em' }}>
              {filtered.length} asset{filtered.length !== 1 ? 's' : ''} monitored
            </div>
          </div>
        </div>

        {/* Asset list */}
        <div className="asset-list-scroll" role="list" aria-label="Asset list">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-glyph">◎</div>
              <div>No assets match your filters</div>
            </div>
          ) : (
            filtered.map((asset, i) => (
              <motion.div
                key={asset.id}
                className={`asset-list-row ${selected?.id === asset.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(asset.id)}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.025, duration: 0.3 }}
                role="listitem"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setSelectedId(asset.id)}
                aria-label={`Asset: ${asset.hostname}, Tier: ${asset.tier}`}
                aria-current={selected?.id === asset.id}
              >
                <span
                  className="asset-tier-dot"
                  style={{ background: tierDotColor(asset.tier) }}
                  aria-hidden="true"
                />
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
                  <span className="asset-hostname" title={asset.hostname}>{asset.hostname}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{asset.classification_type || asset.asset_type}</span>
                </div>
                <span className="asset-eal-small">{formatINR(asset.estimated_eal_inr)}</span>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Right — dossier panel */}
      <div className="asset-dossier-panel">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.id}
              className="dossier-content"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <AssetDossier asset={selected} />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="empty-state"
              style={{ height: '100%' }}
            >
              <div className="empty-state-glyph">◎</div>
              <div>Select an asset to view intelligence</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function AssetDossier({ asset }: { asset: AssetRead }) {
  const unpatchedVulns = asset.vulnerabilities.filter(v => !v.is_patched)
  const patchedVulns = asset.vulnerabilities.filter(v => v.is_patched)
  const kevCount = unpatchedVulns.filter(v => v.cisa_kev).length
  const criticalCount = unpatchedVulns.filter(v => v.cvss_score >= 9).length

  return (
    <>
      {/* Header */}
      <div className="dossier-header">
        <div className="dossier-overline">Asset Intelligence & Provenance Dossier</div>
        <h2 className="dossier-hostname">{asset.hostname}</h2>

        {/* Badges row */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
          <span className={tierBadge(asset.tier)}>{asset.tier}</span>
          {asset.classification_type && (
            <span className="badge badge-low">{asset.classification_type}</span>
          )}
          {asset.is_third_party && (
            <span className="badge badge-high">TPRM: {asset.vendor_name || 'Vendor'} ({asset.vendor_risk_tier || 'Standard'})</span>
          )}
          {asset.is_rbi_localization_compliant === false && (
            <span className="badge badge-critical">⚠ Non-Localized</span>
          )}
          {kevCount > 0 && (
            <span className="badge badge-critical">{kevCount} CISA KEV</span>
          )}
          {criticalCount > 0 && (
            <span className="badge badge-critical">{criticalCount} Critical CVE</span>
          )}
          {unpatchedVulns.length === 0 && (
            <span className="badge badge-low">✓ Clean</span>
          )}
        </div>

        {/* EAL display */}
        <div className="dossier-eal">
          <div className="dossier-eal-label">Estimated Expected Annual Loss (EAL)</div>
          <div className="dossier-eal-value">{formatINR(asset.estimated_eal_inr)}</div>
        </div>

        {/* Asset metadata grid with live backend TPRM & Residency data */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {[
            { label: 'Business Domain', value: asset.business_unit },
            { label: 'Asset Taxonomy', value: asset.classification_type || asset.asset_type },
            { label: 'Downtime Impact', value: `${formatINR(asset.revenue_per_minute)} / min` },
            { label: 'Perimeter Hops', value: `${asset.network_hops_from_internet} Hops from Internet` },
            { label: 'PII Records Count', value: `${asset.pii_records_count.toLocaleString('en-IN')} Records` },
            { label: 'Financial Records', value: `${asset.financial_records_count.toLocaleString('en-IN')} Records` },
            { label: 'Data Residency', value: `${asset.data_residency_country || 'IN'} (${asset.is_rbi_localization_compliant ? '✓ RBI Localized' : '⚠ Non-Compliant'})` },
            { label: 'Third-Party Vendor', value: asset.is_third_party ? `${asset.vendor_name} [${asset.vendor_risk_tier}]` : 'Internal Enterprise IT' },
            { label: 'SOC 2 Attestation', value: asset.soc2_attestation ? '✓ SOC 2 Attested' : 'None On File' },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 4 }}>
                {f.label}
              </div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                {f.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vulnerability intelligence */}
      {asset.vulnerabilities.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>
              Vulnerability Intelligence ({asset.vulnerabilities.length} Total)
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              {patchedVulns.length} patched, {unpatchedVulns.length} active
            </div>
          </div>

          <table className="vuln-table" aria-label="Vulnerability table">
            <thead>
              <tr>
                <th>CVE ID</th>
                <th>CVSS</th>
                <th>EPSS</th>
                <th>Status</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {/* Show unpatched first, then patched */}
              {[...unpatchedVulns, ...patchedVulns].map(v => (
                <tr key={v.id}>
                  <td>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {v.cve_id}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: cvssColor(v.cvss_score), fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                      {v.cvss_score.toFixed(1)}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                      {(v.epss_score * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${v.is_patched ? 'badge-low' : 'badge-high'}`}>
                      {v.is_patched ? 'Patched' : 'Active'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {v.cisa_kev && <span className="badge badge-critical" style={{ fontSize: 9 }}>KEV</span>}
                      {v.cvss_score >= 9.0 && <span className="badge badge-critical" style={{ fontSize: 9 }}>CVSS 9+</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function AssetLoadingSkeleton() {
  return (
    <div className="asset-shell">
      <div className="asset-list-panel" style={{ padding: 24 }}>
        <div className="skeleton" style={{ width: 60, height: 12, marginBottom: 12 }} />
        <div className="skeleton" style={{ width: 140, height: 24, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 36, marginBottom: 16 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(8)].map((_, i) => <div key={i} className="skeleton" style={{ height: 48 }} />)}
        </div>
      </div>
      <div className="asset-dossier-panel" style={{ padding: 32 }}>
        <div className="skeleton" style={{ width: 120, height: 12, marginBottom: 12 }} />
        <div className="skeleton" style={{ width: 280, height: 32, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 140, marginBottom: 32 }} />
        <div className="skeleton" style={{ height: 280 }} />
      </div>
    </div>
  )
}
