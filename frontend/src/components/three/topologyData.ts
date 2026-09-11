import * as THREE from 'three'
import type { AssetRead } from '../../api/types'

export interface CyberRiskNode {
  id: number
  hostname: string
  tier: 'Critical' | 'Medium' | 'Low'
  assetType: string
  businessUnit: string
  hops: number
  ealInr: number
  vulnCount: number
  kevCount: number
  cluster: 'core' | 'enterprise' | 'perimeter'
  position: THREE.Vector3
  color: THREE.Color
  glowColor: THREE.Color
  size: number
  pulseSpeed: number
  pulsePhase: number
}

export interface CyberRiskEdge {
  fromIndex: number
  toIndex: number
  type: 'exposure' | 'peer' | 'bridge'
  color: THREE.Color
}

export interface CyberTopology {
  nodes: CyberRiskNode[]
  edges: CyberRiskEdge[]
  clusterCenters: Record<'core' | 'enterprise' | 'perimeter', THREE.Vector3>
}

// Deterministic seeded random helper
function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1.618) * 10000
  return x - Math.floor(x)
}

// Fallback seed assets matching the actual backend assets if data is still loading
const FALLBACK_SEED_ASSETS: AssetRead[] = [
  { id: 1, hostname: 'core-bank-switch-01', asset_type: 'Core Banking Switch', tier: 'Critical', business_unit: 'Retail Banking', revenue_per_minute: 50000, pii_records_count: 500000, financial_records_count: 2000000, is_rbi_regulated: true, is_sebi_regulated: false, network_hops_from_internet: 4, vulnerabilities: [{ id: 1, asset_id: 1, cve_id: 'CVE-2024-1234', cvss_score: 9.8, epss_score: 0.85, cisa_kev: true, patch_available: true, is_patched: false }, { id: 2, asset_id: 1, cve_id: 'CVE-2023-5678', cvss_score: 7.5, epss_score: 0.3, cisa_kev: false, patch_available: true, is_patched: false }], estimated_eal_inr: 178158493 },
  { id: 2, hostname: 'core-bank-switch-02', asset_type: 'Core Banking Switch', tier: 'Critical', business_unit: 'Retail Banking', revenue_per_minute: 50000, pii_records_count: 500000, financial_records_count: 2000000, is_rbi_regulated: true, is_sebi_regulated: false, network_hops_from_internet: 4, vulnerabilities: [{ id: 3, asset_id: 2, cve_id: 'CVE-2024-1234', cvss_score: 9.8, epss_score: 0.85, cisa_kev: true, patch_available: true, is_patched: false }], estimated_eal_inr: 198326856 },
  { id: 3, hostname: 'upi-gateway-prod-01', asset_type: 'UPI Gateway', tier: 'Critical', business_unit: 'Digital Payments', revenue_per_minute: 120000, pii_records_count: 2000000, financial_records_count: 5000000, is_rbi_regulated: true, is_sebi_regulated: false, network_hops_from_internet: 2, vulnerabilities: [{ id: 4, asset_id: 3, cve_id: 'CVE-2024-2222', cvss_score: 9.9, epss_score: 0.92, cisa_kev: true, patch_available: true, is_patched: false }], estimated_eal_inr: 519697878 },
  { id: 4, hostname: 'upi-gateway-prod-02', asset_type: 'UPI Gateway', tier: 'Critical', business_unit: 'Digital Payments', revenue_per_minute: 120000, pii_records_count: 2000000, financial_records_count: 5000000, is_rbi_regulated: true, is_sebi_regulated: false, network_hops_from_internet: 2, vulnerabilities: [{ id: 5, asset_id: 4, cve_id: 'CVE-2024-2222', cvss_score: 9.9, epss_score: 0.92, cisa_kev: true, patch_available: true, is_patched: false }], estimated_eal_inr: 520759351 },
  { id: 5, hostname: 'cust-db-primary', asset_type: 'Customer DB', tier: 'Critical', business_unit: 'Retail Banking', revenue_per_minute: 40000, pii_records_count: 8000000, financial_records_count: 4000000, is_rbi_regulated: true, is_sebi_regulated: false, network_hops_from_internet: 3, vulnerabilities: [{ id: 6, asset_id: 5, cve_id: 'CVE-2024-3333', cvss_score: 8.8, epss_score: 0.65, cisa_kev: false, patch_available: true, is_patched: false }], estimated_eal_inr: 224803425 },
  { id: 6, hostname: 'cust-db-replica', asset_type: 'Customer DB', tier: 'Critical', business_unit: 'Retail Banking', revenue_per_minute: 35000, pii_records_count: 8000000, financial_records_count: 4000000, is_rbi_regulated: true, is_sebi_regulated: false, network_hops_from_internet: 3, vulnerabilities: [{ id: 7, asset_id: 6, cve_id: 'CVE-2024-3333', cvss_score: 8.8, epss_score: 0.65, cisa_kev: false, patch_available: true, is_patched: false }], estimated_eal_inr: 201976765 },
  { id: 7, hostname: 'trading-platform-01', asset_type: 'Trading System', tier: 'Critical', business_unit: 'Capital Markets', revenue_per_minute: 80000, pii_records_count: 300000, financial_records_count: 3000000, is_rbi_regulated: false, is_sebi_regulated: true, network_hops_from_internet: 3, vulnerabilities: [{ id: 8, asset_id: 7, cve_id: 'CVE-2024-4444', cvss_score: 8.2, epss_score: 0.5, cisa_kev: false, patch_available: true, is_patched: false }], estimated_eal_inr: 145338319 },
  { id: 16, hostname: 'mobile-banking-gw-01', asset_type: 'UPI Gateway', tier: 'Critical', business_unit: 'Digital Payments', revenue_per_minute: 100000, pii_records_count: 3000000, financial_records_count: 4000000, is_rbi_regulated: true, is_sebi_regulated: false, network_hops_from_internet: 2, vulnerabilities: [{ id: 9, asset_id: 16, cve_id: 'CVE-2024-2222', cvss_score: 9.9, epss_score: 0.92, cisa_kev: true, patch_available: true, is_patched: false }], estimated_eal_inr: 433280644 },
  { id: 8, hostname: 'erp-finance-01', asset_type: 'Internal ERP', tier: 'Medium', business_unit: 'Finance & Accounts', revenue_per_minute: 10000, pii_records_count: 50000, financial_records_count: 200000, is_rbi_regulated: false, is_sebi_regulated: false, network_hops_from_internet: 4, vulnerabilities: [], estimated_eal_inr: 6054082 },
  { id: 9, hostname: 'erp-hr-01', asset_type: 'Internal ERP', tier: 'Medium', business_unit: 'Human Resources', revenue_per_minute: 5000, pii_records_count: 100000, financial_records_count: 10000, is_rbi_regulated: false, is_sebi_regulated: false, network_hops_from_internet: 4, vulnerabilities: [], estimated_eal_inr: 2997009 },
  { id: 10, hostname: 'staff-portal-01', asset_type: 'Staff Portal', tier: 'Medium', business_unit: 'Corporate IT', revenue_per_minute: 2000, pii_records_count: 80000, financial_records_count: 0, is_rbi_regulated: false, is_sebi_regulated: false, network_hops_from_internet: 2, vulnerabilities: [], estimated_eal_inr: 4444947 },
  { id: 11, hostname: 'staff-portal-02', asset_type: 'Staff Portal', tier: 'Medium', business_unit: 'Corporate IT', revenue_per_minute: 2000, pii_records_count: 80000, financial_records_count: 0, is_rbi_regulated: false, is_sebi_regulated: false, network_hops_from_internet: 2, vulnerabilities: [], estimated_eal_inr: 3031135 },
  { id: 15, hostname: 'call-center-crm-01', asset_type: 'Internal ERP', tier: 'Medium', business_unit: 'Customer Support', revenue_per_minute: 8000, pii_records_count: 500000, financial_records_count: 50000, is_rbi_regulated: false, is_sebi_regulated: false, network_hops_from_internet: 3, vulnerabilities: [], estimated_eal_inr: 6181302 },
  { id: 17, hostname: 'dr-site-core-switch', asset_type: 'Core Banking Switch', tier: 'Medium', business_unit: 'Retail Banking', revenue_per_minute: 15000, pii_records_count: 100000, financial_records_count: 500000, is_rbi_regulated: true, is_sebi_regulated: false, network_hops_from_internet: 5, vulnerabilities: [], estimated_eal_inr: 5399202 },
  { id: 12, hostname: 'branch-pos-north-12', asset_type: 'Office POS', tier: 'Low', business_unit: 'Branch Operations', revenue_per_minute: 1000, pii_records_count: 5000, financial_records_count: 10000, is_rbi_regulated: false, is_sebi_regulated: false, network_hops_from_internet: 5, vulnerabilities: [], estimated_eal_inr: 658310 },
  { id: 13, hostname: 'branch-pos-south-07', asset_type: 'Office POS', tier: 'Low', business_unit: 'Branch Operations', revenue_per_minute: 800, pii_records_count: 4000, financial_records_count: 8000, is_rbi_regulated: false, is_sebi_regulated: false, network_hops_from_internet: 5, vulnerabilities: [], estimated_eal_inr: 338145 },
  { id: 14, hostname: 'branch-pos-west-03', asset_type: 'Office POS', tier: 'Low', business_unit: 'Branch Operations', revenue_per_minute: 900, pii_records_count: 4500, financial_records_count: 9000, is_rbi_regulated: false, is_sebi_regulated: false, network_hops_from_internet: 5, vulnerabilities: [], estimated_eal_inr: 381325 },
  { id: 18, hostname: 'office-wifi-controller', asset_type: 'Office POS', tier: 'Low', business_unit: 'Corporate IT', revenue_per_minute: 200, pii_records_count: 1000, financial_records_count: 0, is_rbi_regulated: false, is_sebi_regulated: false, network_hops_from_internet: 6, vulnerabilities: [], estimated_eal_inr: 152051 },
]

export function buildCyberTopology(rawAssets?: AssetRead[]): CyberTopology {
  const assets = (rawAssets && rawAssets.length >= 4) ? rawAssets : FALLBACK_SEED_ASSETS

  // Palette: Cyber Risk Semantic Colors
  const palette = {
    Critical: { node: new THREE.Color('#FF3B30'), glow: new THREE.Color('#FF6B6B') },
    Medium: { node: new THREE.Color('#FF9500'), glow: new THREE.Color('#FFB84D') },
    Low: { node: new THREE.Color('#00E676'), glow: new THREE.Color('#38E1A0') },
  }

  // 3 Distinct Functional Risk Clusters:
  // Core Banking & Payments (Right-center, prominent, framing left hero typography)
  // Corporate Enterprise Services (Far right & deeper Z)
  // Perimeter & Branch Operations (Upper right / perimeter)
  const clusterCenters = {
    core: new THREE.Vector3(4.4, 0.1, 0.0),
    enterprise: new THREE.Vector3(8.0, -0.6, -1.8),
    perimeter: new THREE.Vector3(1.8, 2.0, -2.4),
  }

  const maxEal = Math.max(...assets.map(a => a.estimated_eal_inr ?? 0), 1)

  const nodes: CyberRiskNode[] = []

  assets.forEach((asset, idx) => {
    // Cluster assignment by tier / business unit / hops
    let cluster: 'core' | 'enterprise' | 'perimeter' = 'enterprise'
    if (asset.tier === 'Critical' || asset.business_unit === 'Digital Payments' || asset.business_unit === 'Retail Banking') {
      cluster = 'core'
    } else if (asset.tier === 'Low' || asset.network_hops_from_internet >= 5) {
      cluster = 'perimeter'
    } else {
      cluster = 'enterprise'
    }

    const center = clusterCenters[cluster]
    const eal = asset.estimated_eal_inr ?? 0
    const ealRatio = Math.min(Math.max(eal / maxEal, 0), 1)
    const hops = asset.network_hops_from_internet || 3
    const vulnCount = asset.vulnerabilities?.filter(v => !v.is_patched).length ?? 0
    const kevCount = asset.vulnerabilities?.filter(v => v.cisa_kev && !v.is_patched).length ?? 0

    // Spatial layout within cluster: deterministic radial positioning with good separation
    const angle = seededRandom(idx * 7 + 11) * Math.PI * 2
    const radiusScale = cluster === 'core' ? 2.6 : cluster === 'enterprise' ? 2.8 : 3.2
    const radius = 1.0 + seededRandom(idx * 13 + 19) * radiusScale
    const elevation = (seededRandom(idx * 17 + 23) - 0.5) * (cluster === 'core' ? 2.6 : 3.0)
    const depthOffset = (hops - 3.5) * 0.5 + (seededRandom(idx * 29 + 31) - 0.5) * 1.0

    const position = new THREE.Vector3(
      center.x + Math.cos(angle) * radius,
      center.y + elevation,
      center.z + Math.sin(angle) * radius * 0.6 + depthOffset
    )

    const colors = palette[asset.tier] ?? palette.Medium

    // Architectural node sizing (0.08 to 0.24 units) — crisp, distinct cyber constellation nodes
    const baseSize = asset.tier === 'Critical' ? 0.16 : asset.tier === 'Medium' ? 0.11 : 0.08
    const size = baseSize + ealRatio * 0.08

    nodes.push({
      id: asset.id,
      hostname: asset.hostname,
      tier: asset.tier,
      assetType: asset.asset_type,
      businessUnit: asset.business_unit,
      hops,
      ealInr: eal,
      vulnCount,
      kevCount,
      cluster,
      position,
      color: colors.node,
      glowColor: colors.glow,
      size,
      pulseSpeed: asset.tier === 'Critical' ? 1.4 + seededRandom(idx * 3) * 0.8 : 0.7 + seededRandom(idx * 5) * 0.4,
      pulsePhase: seededRandom(idx * 11) * Math.PI * 2,
    })
  })

  // Build architectural exposure relationships
  const edges: CyberRiskEdge[] = []

  // Connect nodes along logical architectural pathways:
  // 1. Gateways (hops 2) connect to Application & DB layers (hops 3-4)
  // 2. Intra-cluster proximity (nodes within same tier & cluster)
  // 3. Perimeter branches connect to Core DR / Switches
  nodes.forEach((a, i) => {
    nodes.forEach((b, j) => {
      if (j <= i) return
      const dist = a.position.distanceTo(b.position)

      // Connection rules:
      const sameCluster = a.cluster === b.cluster
      const isUpstreamHops = Math.abs(a.hops - b.hops) === 1 || Math.abs(a.hops - b.hops) === 2
      const isCoreHighRisk = a.tier === 'Critical' && b.tier === 'Critical'

      let shouldConnect = false
      let type: 'exposure' | 'peer' | 'bridge' = 'peer'

      if (isCoreHighRisk && dist < 4.8) {
        shouldConnect = true
        type = 'exposure'
      } else if (sameCluster && dist < 3.8) {
        shouldConnect = true
        type = 'peer'
      } else if (!sameCluster && isUpstreamHops && dist < 5.4) {
        // Cross-cluster bridge (e.g. perimeter to core switch)
        shouldConnect = true
        type = 'bridge'
      }

      if (shouldConnect) {
        const edgeColor = new THREE.Color().copy(a.color).lerp(b.color, 0.5)
        edges.push({
          fromIndex: i,
          toIndex: j,
          type,
          color: edgeColor,
        })
      }
    })
  })

  return { nodes, edges, clusterCenters }
}
