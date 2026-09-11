// ============================================================
// Formatting utilities — INR currency, percentages, dates
// All formatting logic mirrors the backend's format_inr helper
// ============================================================

export function formatINR(value: number | null | undefined): string {
  if (value == null) return '₹0.00'
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)

  if (abs >= 10_000_000) {
    return `${sign}₹${(abs / 10_000_000).toFixed(2)} Cr`
  } else if (abs >= 100_000) {
    return `${sign}₹${(abs / 100_000).toFixed(2)} L`
  } else if (abs >= 1_000) {
    return `${sign}₹${abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  return `${sign}₹${abs.toFixed(2)}`
}

export function formatINRCompact(value: number | null | undefined): string {
  if (value == null) return '₹0'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 10_000_000) return `${sign}₹${(abs / 10_000_000).toFixed(1)} Cr`
  if (abs >= 100_000) return `${sign}₹${(abs / 100_000).toFixed(1)} L`
  return formatINR(value)
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`
}

export function formatFrequency(value: number): string {
  if (value < 0.1) return `${(value * 12).toFixed(1)}×/yr (low)`
  if (value < 1) return `${value.toFixed(2)}×/yr`
  return `${value.toFixed(1)}×/yr`
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}

export function cvssColor(score: number): string {
  if (score >= 9.0) return 'var(--risk-critical)'
  if (score >= 7.0) return 'var(--risk-high)'
  if (score >= 4.0) return 'var(--risk-medium)'
  return 'var(--risk-low)'
}

export function tierColor(tier: string): string {
  switch (tier) {
    case 'Critical': return 'var(--risk-critical)'
    case 'Medium': return 'var(--risk-high)'
    case 'Low': return 'var(--risk-low)'
    default: return 'var(--risk-neutral)'
  }
}

export function tierClass(tier: string): string {
  switch (tier) {
    case 'Critical': return 'badge-critical critical-card'
    case 'Medium': return 'badge-high medium-card'
    case 'Low': return 'badge-low low-card'
    default: return ''
  }
}

export function tierBadgeClass(tier: string): string {
  switch (tier) {
    case 'Critical': return 'badge-critical'
    case 'Medium': return 'badge-high'
    case 'Low': return 'badge-low'
    default: return ''
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Describes risk level based on compliance % */
export function complianceStatus(pct: number): { label: string; color: string } {
  if (pct >= 85) return { label: 'Compliant', color: 'var(--risk-low)' }
  if (pct >= 60) return { label: 'Partial', color: 'var(--risk-high)' }
  return { label: 'At Risk', color: 'var(--risk-critical)' }
}
