// ============================================================
// API Types — derived directly from backend schemas.py
// DO NOT modify these types without checking the backend contract
// ============================================================

export interface VulnerabilityRead {
  id: number
  asset_id: number
  cve_id: string
  cvss_score: number
  epss_score: number
  cisa_kev: boolean
  patch_available: boolean
  is_patched: boolean
}

export interface AssetRead {
  id: number
  hostname: string
  asset_type: string
  tier: 'Critical' | 'Medium' | 'Low'
  business_unit: string
  revenue_per_minute: number
  pii_records_count: number
  financial_records_count: number
  is_rbi_regulated: boolean
  is_sebi_regulated: boolean
  network_hops_from_internet: number
  classification_type?: string
  is_iso27001_regulated?: boolean
  is_iso42001_regulated?: boolean
  is_third_party?: boolean
  vendor_name?: string | null
  vendor_risk_tier?: string | null
  soc2_attestation?: boolean
  data_residency_country?: string
  cross_border_transfer_enabled?: boolean
  destination_countries?: string | null
  transfer_legal_mechanism?: string | null
  is_rbi_localization_compliant?: boolean
  vulnerabilities: VulnerabilityRead[]
  estimated_eal_inr: number | null
}

export interface DataLineageFlowRead {
  id: number
  origin_hostname: string
  intermediary_hostname: string | null
  destination_hostname: string
  is_authorized: boolean
  has_user_consent: boolean
  records_exposed_pii: number
  records_exposed_financial: number
  detection_status: string
  leak_root_cause_identified: boolean
}

export interface NetworkEdgeRead {
  id: number
  source_node: string
  target_node: string
  weight: number
  protocol: string
  is_segmented: boolean
  is_authorized_flow: boolean
  consent_recorded: boolean
  flow_type: string
  data_tags: string | null
}

export interface AssetRiskContribution {
  asset_id: number
  hostname: string
  tier: string
  asset_type: string
  eal_inr: number
  annual_event_frequency: number
}

export interface LossExceedancePoint {
  return_period_years: number
  loss_inr: number
}

export interface EnterpriseRiskSummary {
  total_eal_inr: number
  var_95_inr: number
  var_99_inr: number
  top_5_riskiest_assets: AssetRiskContribution[]
  total_regulatory_fine_exposure_inr: number
  loss_exceedance_curve: LossExceedancePoint[]
  simulation_iterations: number
  generated_at: string
  unauthorized_subprocessor_count?: number
  shadow_leakage_exposure_inr?: number
  identified_leak_vectors?: DataLineageFlowRead[]
}

export interface ControlRecommendation {
  code: string
  name: string
  cost_inr: number
  likelihood_reduction: number
  target_tier: string
  marginal_eal_reduction_inr: number
}

export interface OptimizationResponse {
  budget_inr: number
  selected_controls: ControlRecommendation[]
  total_spent_inr: number
  remaining_budget_inr: number
  baseline_eal_inr: number
  projected_eal_inr: number
  net_risk_reduction_inr: number
  rosi_percent: number
}

export interface BudgetOptimizationRequest {
  budget_inr: number
}

export interface ComplianceGap {
  framework: string
  category: string
  description: string
  recommended_control_codes: string[]
}

export interface FrameworkComplianceReport {
  rbi_compliance_index_percent: number
  sebi_compliance_index_percent: number
  nist_csf_compliance_index_percent: number
  iso27001_compliance_index_percent: number
  iso42001_compliance_index_percent: number
  cross_border_compliance_index_percent: number
  rbi_localization_status: string
  overall_compliance_index_percent: number
  gaps: ComplianceGap[]
  estimated_regulatory_penalty_exposure_inr: number
}

export interface SimulationRunRead {
  id: number
  timestamp: string
  total_eal_inr: number
  var_95_inr: number
  var_99_inr: number
  allocated_budget_inr: number | null
  selected_controls_json: string | null
}

export interface HealthResponse {
  service: string
  docs: string
  status: string
}

export interface SeedResponse {
  status: string
  inserted: {
    assets: number
    vulnerabilities: number
    controls: number
  }
}
