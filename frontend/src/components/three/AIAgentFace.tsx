import React, { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import type { AssetRead } from '../../api/types'

// ============================================================================
// CRIQ — AI CYBER RISK AGENT CONSCIOUSNESS
// Organic flowing point clouds + curved neural pathways + 3D holographic depth
// Positioned in the right 40-45% column, balanced with the left financial hero
// ============================================================================

export type AIAgentState = 'analyzing' | 'stable' | 'high_risk' | 'optimized'

export interface AIAgentFaceNode {
  id: number
  hostname: string
  tier: 'Critical' | 'Medium' | 'Low'
  assetType: string
  businessUnit: string
  hops: number
  ealInr: number
  vulnCount: number
  kevCount: number
  position: THREE.Vector3
  basePosition: THREE.Vector3
  isAssetNode: boolean
  facialRegion: 'cortex' | 'eye' | 'sagittal' | 'zygomatic' | 'jaw' | 'core'
  color: THREE.Color
  glowColor: THREE.Color
  size: number
  pulseSpeed: number
  pulsePhase: number
}

interface AIAgentFaceProps {
  assets?: AssetRead[]
  agentState?: AIAgentState
  activeScene?: number
  hoveredNodeId?: number | null
  highlightedAssetId?: number | null
  onNodeHover?: (node: AIAgentFaceNode | null, mouseEvent?: { x: number; y: number }) => void
  onNodeClick?: (node: AIAgentFaceNode) => void
}

interface SplineStream {
  curve: THREE.CatmullRomCurve3
  points: THREE.Vector3[]
  color: THREE.Color
  isCritical: boolean
}

// Fallback seed assets matching backend exactly
const FALLBACK_ASSETS: AssetRead[] = [
  { id: 1, hostname: 'core-bank-switch-01', asset_type: 'Core Banking Switch', tier: 'Critical', business_unit: 'Retail Banking', revenue_per_minute: 50000, pii_records_count: 500000, financial_records_count: 2000000, is_rbi_regulated: true, is_sebi_regulated: false, network_hops_from_internet: 4, vulnerabilities: [{ id: 1, asset_id: 1, cve_id: 'CVE-2024-1234', cvss_score: 9.8, epss_score: 0.85, cisa_kev: true, patch_available: true, is_patched: false }], estimated_eal_inr: 178158493 },
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

// ============================================================================
// CONSCIOUSNESS MODEL GENERATION (Procedural Organic Geometry)
// ============================================================================
function buildConsciousnessModel(rawAssets?: AssetRead[]) {
  const assets = rawAssets && rawAssets.length >= 6 ? rawAssets : FALLBACK_ASSETS
  const maxEal = Math.max(...assets.map((a) => a.estimated_eal_inr ?? 0), 1)

  const nodes: AIAgentFaceNode[] = []
  const pointPositions: number[] = []
  const pointColors: number[] = []
  const pointSizes: number[] = []

  const addPoint = (
    pos: [number, number, number],
    region: AIAgentFaceNode['facialRegion'],
    baseColor: THREE.Color,
    size: number
  ) => {
    pointPositions.push(pos[0], pos[1], pos[2])
    pointColors.push(baseColor.r, baseColor.g, baseColor.b)
    pointSizes.push(size)
  }

  // Harmonic Cyber-Consciousness Color Tokens
  const cyanCore = new THREE.Color('#00E5FF')
  const electricAzure = new THREE.Color('#0A84FF')
  const deepIndigo = new THREE.Color('#1D4ED8')
  const darkCosmos = new THREE.Color('#0F172A')
  const softOptic = new THREE.Color('#E0F2FE')

  // 1. CRANIAL NEURO-VAULT (Forehead & Superior Cranium)
  // Sweeping organic curves that define the neural consciousness dome
  for (let ribbon = 0; ribbon < 20; ribbon++) {
    const v = ribbon / 19
    const yBase = 0.95 + v * 1.85
    const crownProfile = Math.cos((v * Math.PI) / 2)
    const numPts = 38

    for (let i = 0; i < numPts; i++) {
      const u = (i / (numPts - 1)) * 2 - 1 // -1 to +1
      const archWidth = (2.1 - v * 0.45) * crownProfile
      const x = u * archWidth
      const archDepth = Math.cos((u * Math.PI) / 2)
      const y = yBase + archDepth * 0.28 + Math.sin(u * 4.5 + ribbon * 0.5) * 0.03
      const z = Math.sqrt(Math.max(0, 1 - u * u)) * (1.65 - v * 0.5) * Math.max(0.25, archDepth)

      const falloff = THREE.MathUtils.clamp(Math.abs(u) * 0.8 + v * 0.2, 0, 1)
      const col = cyanCore.clone().lerp(electricAzure, falloff * 0.7).lerp(deepIndigo, falloff * 0.5)
      addPoint([x, y, z], 'cortex', col, 0.052)
    }
  }

  // 2. DUAL OCULAR SYNTHETIC VISION ARRAYS (Intelligent Optic Cores)
  // Calm, serene, brilliant synthetic iris rings (NOT cartoon eyes, NOT creepy red)
  const eyeFoci: [number, number, number][] = [
    [-0.95, 0.65, 1.58],
    [0.95, 0.65, 1.58],
  ]

  eyeFoci.forEach(([cx, cy, cz]) => {
    // Brilliant synthetic vision center
    for (let p = 0; p < 16; p++) {
      const rad = 0.02 + Math.random() * 0.045
      const ang = Math.random() * Math.PI * 2
      addPoint(
        [cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad, cz + 0.1],
        'eye',
        softOptic,
        0.075
      )
    }

    // 3 Concentric breathing optic telemetry rings
    const rings = [0.14, 0.26, 0.42]
    rings.forEach((r, rIdx) => {
      const ringPts = 20 + rIdx * 8
      for (let k = 0; k < ringPts; k++) {
        const th = (k / ringPts) * Math.PI * 2
        const rx = cx + Math.cos(th) * r * 1.15
        const ry = cy + Math.sin(th) * r * 0.72
        const rz = cz + Math.sin(th * 2) * 0.03
        const ringCol = rIdx === 0 ? cyanCore : electricAzure
        addPoint([rx, ry, rz], 'eye', ringCol, 0.045)
      }
    })

    // Elegant Supraorbital Brow Line
    for (let b = 0; b < 20; b++) {
      const bt = b / 19
      const bx = cx + (bt - 0.5) * 1.25
      const by = cy + 0.38 + Math.sin(bt * Math.PI) * 0.12
      const bz = cz + 0.06
      addPoint([bx, by, bz], 'eye', softOptic, 0.046)
    }
  })

  // 3. SAGITTAL SPINAL AXIS (Frontal Keel & Nasal Bridge)
  for (let i = 0; i < 52; i++) {
    const t = i / 51
    const y = 1.35 - t * 1.75
    const z = 1.7 + Math.sin(t * Math.PI) * 0.72
    const spread = Math.sin(t * Math.PI) * 0.15
    const x = Math.sin(i * 3.5) * spread * 0.6
    const col = cyanCore.clone().lerp(electricAzure, t * 0.5)
    addPoint([x, y, z], 'sagittal', col, 0.05)
  }

  // 4. ZYGOMATIC CHEEKBONE SURFACES (Smooth Organic Contours, No Barcode Lines!)
  // Natural grid surface that catches light softly
  for (let side of [-1, 1]) {
    for (let row = 0; row < 7; row++) {
      const v = row / 6
      for (let colIdx = 0; colIdx < 16; colIdx++) {
        const u = colIdx / 15
        const x = side * (0.45 + u * 1.45)
        const y = 0.35 - u * 0.65 - v * 0.45
        const z = 1.75 - Math.pow(u, 1.3) * 1.25 + Math.sin(u * Math.PI) * 0.12 - v * 0.2
        const edgeFade = u * 0.7 + v * 0.3
        const col = cyanCore.clone().lerp(darkCosmos, edgeFade)
        addPoint([x, y, z], 'zygomatic', col, 0.042)
      }
    }
  }

  // 5. MANDIBULAR JAWLINE & CHIN APEX (Gracefully Tapering Contour)
  for (let side of [-1, 1]) {
    for (let j = 0; j < 36; j++) {
      const t = j / 35
      const x = side * (t * 1.95)
      const y = -2.15 + Math.pow(t, 1.5) * 1.45
      const z = 1.42 - t * 1.35
      const col = cyanCore.clone().lerp(electricAzure, t * 0.6)
      addPoint([x, y, z], 'jaw', col, 0.046)
    }
  }

  // Serene Interface Contours (Intelligent, Neutral Expression)
  for (let m = -0.7; m <= 0.7; m += 0.07) {
    const arch = 1 - (Math.abs(m) / 0.75) * (Math.abs(m) / 0.75)
    addPoint([m, -0.85 + arch * 0.07, 1.68], 'jaw', cyanCore, 0.04)
    addPoint([m, -1.02 - arch * 0.04, 1.6], 'jaw', electricAzure, 0.036)
  }

  // 6. VOLUMETRIC INTERNAL CONSCIOUSNESS VOLUME (3D Depth Core)
  // Holographic 3D interior particles that reveal depth during mouse rotation
  for (let c = 0; c < 480; c++) {
    const r = Math.pow(Math.random(), 0.65) * 1.5
    const phi = Math.random() * Math.PI * 2
    const theta = (Math.random() - 0.5) * Math.PI * 0.85
    const x = Math.cos(phi) * Math.cos(theta) * (r * 1.05)
    const y = 0.65 + Math.sin(theta) * (r * 1.2)
    const z = Math.sin(phi) * Math.cos(theta) * (r * 0.8) - 0.2

    const col = electricAzure.clone().lerp(deepIndigo, r / 1.5)
    addPoint([x, y, z], 'core', col, 0.035 + Math.random() * 0.02)
  }

  // 7. EMBEDDED STRATEGIC 18 ENTERPRISE ASSET NODES
  // Harmoniously distributed across anatomical landmarks:
  // - Critical assets anchor the Frontal Cortex, Temples, and Zygomatic Apexes
  // - Medium assets anchor the Crown Zenith, Glabella, and Maxilla
  // - Low assets anchor the Lower Mandible, Chin, and Cervical stream
  const strategicLandmarks: { [id: number]: [number, number, number] } = {
    // 8 CRITICAL ASSETS (Vivid Crimson Jewels)
    1: [-0.75, 1.55, 1.65],   // core-bank-switch-01 (Left Frontal Cortical Hub)
    2: [0.75, 1.55, 1.65],    // core-bank-switch-02 (Right Frontal Cortical Hub)
    3: [-0.55, 2.15, 1.35],   // upi-gateway-prod-01 (Left Frontal Apex)
    4: [0.55, 2.15, 1.35],    // upi-gateway-prod-02 (Right Frontal Apex)
    5: [-1.45, 0.22, 1.38],   // cust-db-primary (Left Zygomatic Apex)
    6: [1.45, 0.22, 1.38],    // cust-db-replica (Right Zygomatic Apex)
    7: [1.65, 1.05, 1.05],    // trading-platform-01 (Right Temple Sensor)
    16: [-1.65, 1.05, 1.05],  // mobile-banking-gw-01 (Left Temple Sensor)

    // 6 MEDIUM ASSETS (Vivid Amber Gold Jewels)
    17: [0.0, 2.55, 0.95],    // dr-site-core-switch (Crown Zenith)
    15: [0.0, 0.15, 1.88],    // call-center-crm-01 (Glabella / Nasal Keel)
    8: [-0.85, -0.32, 1.52],  // erp-finance-01 (Left Maxilla Hub)
    9: [0.85, -0.32, 1.52],   // erp-hr-01 (Right Maxilla Hub)
    10: [-1.28, -1.05, 1.05], // staff-portal-01 (Left Mandible Angle)
    11: [1.28, -1.05, 1.05],  // staff-portal-02 (Right Mandible Angle)

    // 4 LOW ASSETS (Electric Cyan Jewels)
    12: [-0.85, -1.72, 1.18], // branch-pos-north-12 (Left Lower Mandible)
    13: [0.85, -1.72, 1.18],  // branch-pos-south-07 (Right Lower Mandible)
    14: [0.0, -1.95, 1.38],   // branch-pos-west-03 (Chin Apex Anchor)
    18: [0.0, -2.75, 0.72],   // office-wifi-controller (Cervical Ground Anchor)
  }

  assets.forEach((asset, idx) => {
    const landmark = strategicLandmarks[asset.id] || [
      Math.sin(idx * 1.6) * 1.3,
      0.5 + Math.cos(idx * 1.2) * 1.1,
      1.2 + Math.sin(idx * 2.1) * 0.4,
    ]
    const pos = new THREE.Vector3(...landmark)
    const eal = asset.estimated_eal_inr ?? 0
    const isCritical = asset.tier === 'Critical'
    const isMedium = asset.tier === 'Medium'

    // Distinct, vibrant cyber color hierarchy
    const color = isCritical
      ? new THREE.Color('#FF2A55') // Vivid neon crimson
      : isMedium
      ? new THREE.Color('#FFB020') // Vivid amber gold
      : new THREE.Color('#00E5FF') // Electric cyber cyan

    const glowColor = isCritical
      ? new THREE.Color('#FF4D71')
      : isMedium
      ? new THREE.Color('#FFD166')
      : new THREE.Color('#70F3FF')

    const sizeRatio = Math.sqrt(Math.max(eal, 1) / maxEal)
    // Refined jewel nodes (0.046 to 0.082 radius)
    const size = isCritical
      ? 0.066 + sizeRatio * 0.022
      : isMedium
      ? 0.052 + sizeRatio * 0.014
      : 0.042

    nodes.push({
      id: asset.id,
      hostname: asset.hostname,
      tier: asset.tier,
      assetType: asset.asset_type,
      businessUnit: asset.business_unit,
      hops: asset.network_hops_from_internet,
      ealInr: eal,
      vulnCount: asset.vulnerabilities?.length ?? 0,
      kevCount: asset.vulnerabilities?.filter((v) => v.cisa_kev && !v.is_patched).length ?? 0,
      position: pos.clone(),
      basePosition: pos.clone(),
      isAssetNode: true,
      facialRegion: isCritical ? 'cortex' : isMedium ? 'zygomatic' : 'jaw',
      color,
      glowColor,
      size,
      pulseSpeed: isCritical ? 2.6 : isMedium ? 1.8 : 1.2,
      pulsePhase: idx * 0.65,
    })
  })

  // 8. ORGANIC CURVED SPLINE DATA PATHWAYS
  const splineStreams: SplineStream[] = []

  const streamConnections: [number, number, number[]][] = [
    [17, 3, [-0.25, 2.35, 1.2]],
    [17, 4, [0.25, 2.35, 1.2]],
    [3, 1, [-0.65, 1.85, 1.55]],
    [4, 2, [0.65, 1.85, 1.55]],
    [1, 16, [-1.2, 1.35, 1.35]],
    [2, 7, [1.2, 1.35, 1.35]],
    [16, 5, [-1.55, 0.65, 1.22]],
    [7, 6, [1.55, 0.65, 1.22]],
    [1, 15, [-0.4, 0.85, 1.75]],
    [2, 15, [0.4, 0.85, 1.75]],
    [5, 8, [-1.15, -0.05, 1.45]],
    [6, 9, [1.15, -0.05, 1.45]],
    [15, 8, [-0.45, -0.1, 1.68]],
    [15, 9, [0.45, -0.1, 1.68]],
    [8, 10, [-1.08, -0.7, 1.28]],
    [9, 11, [1.08, -0.7, 1.28]],
    [10, 12, [-1.08, -1.4, 1.12]],
    [11, 13, [1.08, -1.4, 1.12]],
    [12, 14, [-0.45, -1.85, 1.28]],
    [13, 14, [0.45, -1.85, 1.28]],
    [14, 18, [0.0, -2.35, 1.05]],
  ]

  const nodeMap = new Map<number, AIAgentFaceNode>()
  nodes.forEach((n) => nodeMap.set(n.id, n))

  streamConnections.forEach(([fromId, toId, mid]) => {
    const fromNode = nodeMap.get(fromId)
    const toNode = nodeMap.get(toId)
    if (!fromNode || !toNode) return

    const midPt = new THREE.Vector3(...(mid as [number, number, number]))
    const curve = new THREE.CatmullRomCurve3([
      fromNode.basePosition,
      midPt,
      toNode.basePosition,
    ])

    const samplePts = curve.getPoints(24)
    const isCrit = fromNode.tier === 'Critical' || toNode.tier === 'Critical'
    const streamColor = isCrit ? new THREE.Color('#FF2A55') : cyanCore

    splineStreams.push({
      curve,
      points: samplePts,
      color: streamColor,
      isCritical: isCrit,
    })
  })

  return {
    nodes,
    pointPositions: new Float32Array(pointPositions),
    pointColors: new Float32Array(pointColors),
    pointSizes: new Float32Array(pointSizes),
    splineStreams,
  }
}

// ============================================================================
// COMPONENT
// ============================================================================
export default function AIAgentFace({
  assets,
  agentState = 'stable',
  activeScene = 0,
  hoveredNodeId = null,
  highlightedAssetId = null,
  onNodeHover,
  onNodeClick,
}: AIAgentFaceProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const pointsRef = useRef<THREE.Points>(null!)
  const impulsesRef = useRef<THREE.Points>(null!)
  const haloRingRef = useRef<THREE.Mesh>(null!)
  const { pointer, viewport } = useThree()

  // Generate smooth circular glowing particle texture in memory
  const particleTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(0.25, 'rgba(255, 255, 255, 0.85)')
    gradient.addColorStop(0.55, 'rgba(120, 220, 255, 0.4)')
    gradient.addColorStop(1, 'rgba(0, 10, 30, 0)')

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    return texture
  }, [])

  // Generate deterministic consciousness model
  const { nodes, pointPositions, pointColors, pointSizes, splineStreams } = useMemo(
    () => buildConsciousnessModel(assets),
    [assets]
  )

  // Calibrate horizontal placement:
  // Position agent firmly on the right side (~72-75% of viewport width)
  const agentBaseX = useMemo(() => {
    if (viewport.width < 10) return 2.4
    if (viewport.width < 14) return 4.0
    return 5.0
  }, [viewport.width])

  // Spline Lines Buffer Geometry
  const splineLinesGeometry = useMemo(() => {
    const totalSegments = splineStreams.reduce((sum, s) => sum + (s.points.length - 1), 0)
    const positions = new Float32Array(totalSegments * 2 * 3)
    const colors = new Float32Array(totalSegments * 2 * 3)

    let offset = 0
    splineStreams.forEach((stream) => {
      const pts = stream.points
      for (let i = 0; i < pts.length - 1; i++) {
        const p1 = pts[i]
        const p2 = pts[i + 1]

        positions[offset] = p1.x
        positions[offset + 1] = p1.y
        positions[offset + 2] = p1.z

        positions[offset + 3] = p2.x
        positions[offset + 4] = p2.y
        positions[offset + 5] = p2.z

        colors[offset] = stream.color.r
        colors[offset + 1] = stream.color.g
        colors[offset + 2] = stream.color.b

        colors[offset + 3] = stream.color.r
        colors[offset + 4] = stream.color.g
        colors[offset + 5] = stream.color.b

        offset += 6
      }
    })

    const geom = new THREE.BufferGeometry()
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geom
  }, [splineStreams])

  // Real-time flowing data impulses along neural pathways
  const NUM_IMPULSES = 50
  const impulsePositions = useMemo(() => new Float32Array(NUM_IMPULSES * 3), [NUM_IMPULSES])
  const impulseProgress = useRef<Float32Array>(
    new Float32Array(Array.from({ length: NUM_IMPULSES }, () => Math.random()))
  )

  // Subtle look-at mouse target with smooth interpolation
  const targetRotation = useRef(new THREE.Euler(0, 0, 0))
  const targetPos = useRef(new THREE.Vector3(agentBaseX, 0.15, 0))

  useEffect(() => {
    targetPos.current.x = agentBaseX
  }, [agentBaseX])

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime()

    // 1. Interactive Head Parallax & Look-at cursor tracking
    // Restrained, intelligent, natural rotation
    const mouseX = pointer.x
    const mouseY = pointer.y

    const rotY = mouseX * 0.28 - 0.08 // Slight neutral three-quarter turn towards viewer
    const rotX = -mouseY * 0.22 + 0.03
    const rotZ = mouseX * 0.06

    targetRotation.current.set(rotX, rotY, rotZ)

    if (groupRef.current) {
      groupRef.current.rotation.x = THREE.MathUtils.damp(
        groupRef.current.rotation.x,
        targetRotation.current.x,
        3.5,
        delta
      )
      groupRef.current.rotation.y = THREE.MathUtils.damp(
        groupRef.current.rotation.y,
        targetRotation.current.y,
        3.5,
        delta
      )
      groupRef.current.rotation.z = THREE.MathUtils.damp(
        groupRef.current.rotation.z,
        targetRotation.current.z,
        3.5,
        delta
      )

      // Idle vertical hover respiration
      const floatY = Math.sin(time * 0.85) * 0.08
      groupRef.current.position.y = THREE.MathUtils.damp(
        groupRef.current.position.y,
        0.15 + floatY,
        2.5,
        delta
      )
      groupRef.current.position.x = THREE.MathUtils.damp(
        groupRef.current.position.x,
        targetPos.current.x,
        3.0,
        delta
      )
    }

    // 2. Slow subtle rotation of framing horizon halo
    if (haloRingRef.current) {
      haloRingRef.current.rotation.z = time * 0.04
    }

    // 3. Flowing Photonic Impulses Along Spline Streams
    if (impulsesRef.current && splineStreams.length > 0) {
      const speedMultiplier =
        agentState === 'analyzing'
          ? 0.55
          : agentState === 'high_risk'
          ? 0.42
          : agentState === 'optimized'
          ? 0.18
          : 0.26

      const posAttr = impulsesRef.current.geometry.attributes.position as THREE.BufferAttribute
      const posArray = posAttr.array as Float32Array

      for (let i = 0; i < NUM_IMPULSES; i++) {
        const streamIdx = i % splineStreams.length
        const stream = splineStreams[streamIdx]

        impulseProgress.current[i] = (impulseProgress.current[i] + delta * speedMultiplier) % 1.0
        const pt = stream.curve.getPointAt(impulseProgress.current[i])

        posArray[i * 3] = pt.x
        posArray[i * 3 + 1] = pt.y
        posArray[i * 3 + 2] = pt.z
      }
      posAttr.needsUpdate = true
    }
  })

  // Dynamic visual state color
  const stateStreamColor = useMemo(() => {
    if (agentState === 'high_risk') return '#FF2A55'
    if (agentState === 'analyzing') return '#00E5FF'
    if (agentState === 'optimized') return '#00E676'
    return '#38B8E0'
  }, [agentState])

  return (
    <group ref={groupRef} position={[agentBaseX, 0.15, 0]}>
      {/* ── Background Subtle Telemetry Horizon Ring ── */}
      <mesh ref={haloRingRef} position={[0, 0.3, -0.6]} rotation={[0.2, 0, 0]}>
        <ringGeometry args={[2.8, 2.84, 64]} />
        <meshBasicMaterial
          color="#0A84FF"
          transparent
          opacity={0.14}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* ── Flowing Neural Spline Data Streams ── */}
      <lineSegments geometry={splineLinesGeometry}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={
            agentState === 'high_risk'
              ? 0.36
              : agentState === 'optimized'
              ? 0.26
              : 0.2
          }
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* ── Photonic Impulses Traveling along Neural Streams ── */}
      <points ref={impulsesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[impulsePositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          map={particleTexture ?? undefined}
          color={stateStreamColor}
          size={0.11}
          transparent
          opacity={0.95}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* ── The Organic Facial Consciousness Cloud (Soft Quantum Photons) ── */}
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[pointPositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[pointColors, 3]} />
          <bufferAttribute attach="attributes-size" args={[pointSizes, 1]} />
        </bufferGeometry>
        <pointsMaterial
          map={particleTexture ?? undefined}
          vertexColors
          transparent
          opacity={agentState === 'high_risk' ? 0.95 : 0.82}
          size={0.088}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* ── Strategic 18 Enterprise Asset Jewel Nodes ── */}
      {nodes.map((node) => {
        const isHovered = hoveredNodeId === node.id
        const isHighlighted = highlightedAssetId === node.id

        return (
          <group key={node.id} position={node.basePosition}>
            {/* Invisible enlarged hit target for effortless hover & click */}
            <mesh
              onPointerOver={(e) => {
                e.stopPropagation()
                onNodeHover?.(node, { x: e.clientX, y: e.clientY })
              }}
              onPointerOut={(e) => {
                e.stopPropagation()
                onNodeHover?.(null)
              }}
              onClick={(e) => {
                e.stopPropagation()
                onNodeClick?.(node)
              }}
            >
              <sphereGeometry args={[0.38, 10, 8]} />
              <meshBasicMaterial visible={false} />
            </mesh>

            {/* Core Cyber Jewel Spherical Node */}
            <mesh scale={isHovered ? 1.5 : isHighlighted ? 1.3 : 1.0}>
              <sphereGeometry args={[node.size, 20, 16]} />
              <meshStandardMaterial
                color={node.color}
                emissive={node.glowColor}
                emissiveIntensity={
                  isHovered
                    ? 1.6
                    : isHighlighted
                    ? 1.3
                    : node.tier === 'Critical'
                    ? 0.75
                    : 0.45
                }
                roughness={0.2}
                metalness={0.5}
              />
            </mesh>

            {/* Refined Delicate Cyber Ring Orbit */}
            <mesh
              scale={isHovered ? 1.4 : 1.0}
              rotation={[0, 0, node.pulsePhase]}
            >
              <ringGeometry args={[node.size * 1.4, node.size * 1.6, 32]} />
              <meshBasicMaterial
                color={node.glowColor}
                transparent
                opacity={isHovered ? 0.85 : node.tier === 'Critical' ? 0.4 : 0.2}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
