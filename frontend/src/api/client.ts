// ============================================================
// API Client — thin wrapper around fetch with base URL config
// ============================================================
import type {
  AssetRead,
  DataLineageFlowRead,
  EnterpriseRiskSummary,
  LossExceedancePoint,
  OptimizationResponse,
  BudgetOptimizationRequest,
  FrameworkComplianceReport,
  SimulationRunRead,
  HealthResponse,
  SeedResponse,
} from './types'

const BACKEND_URL_KEY = 'crq_backend_url'
const DEFAULT_BACKEND = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/+$/, '')

export function getBackendUrl(): string {
  const url = localStorage.getItem(BACKEND_URL_KEY) || DEFAULT_BACKEND
  return url.replace(/\/+$/, '')
}

export function setBackendUrl(url: string): void {
  localStorage.setItem(BACKEND_URL_KEY, url.trim().replace(/\/+$/, ''))
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getBackendUrl()
  const res = await fetch(`${base}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const json = await res.json()
      detail = json.detail || detail
    } catch {}
    throw new Error(`API Error ${res.status}: ${detail}`)
  }
  return res.json() as Promise<T>
}

// ----------- Health ----------------------------------------------------------
export const apiHealth = (): Promise<HealthResponse> =>
  apiFetch<HealthResponse>('/')

// ----------- Assets ----------------------------------------------------------
export const apiAssets = (): Promise<AssetRead[]> =>
  apiFetch<AssetRead[]>('/api/assets')

// ----------- Enterprise Quantification ---------------------------------------
export const apiEnterprise = (): Promise<EnterpriseRiskSummary> =>
  apiFetch<EnterpriseRiskSummary>('/api/quantification/enterprise')

export const apiLossExceedance = (): Promise<LossExceedancePoint[]> =>
  apiFetch<LossExceedancePoint[]>('/api/quantification/loss-exceedance')

// ----------- Data Lineage & Provenance ---------------------------------------
export const apiDataLineageFlows = (): Promise<DataLineageFlowRead[]> =>
  apiFetch<DataLineageFlowRead[]>('/api/lineage/flows')

// ----------- Budget Optimization ---------------------------------------------
export const apiOptimizeBudget = (
  req: BudgetOptimizationRequest
): Promise<OptimizationResponse> =>
  apiFetch<OptimizationResponse>('/api/optimize/budget', {
    method: 'POST',
    body: JSON.stringify(req),
  })

// ----------- Compliance ------------------------------------------------------
export const apiCompliance = (): Promise<FrameworkComplianceReport> =>
  apiFetch<FrameworkComplianceReport>('/api/compliance/status')

// ----------- Simulation History ----------------------------------------------
export const apiHistory = (): Promise<SimulationRunRead[]> =>
  apiFetch<SimulationRunRead[]>('/api/simulations/history')

// ----------- Admin -----------------------------------------------------------
export const apiSeed = (): Promise<SeedResponse> =>
  apiFetch<SeedResponse>('/api/seed', { method: 'POST' })
