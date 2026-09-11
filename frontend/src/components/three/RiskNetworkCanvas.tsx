import React, { useRef, useState, useEffect, Suspense, useMemo, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { AssetRead } from '../../api/types'
import { formatINR } from '../../lib/format'
import { buildCyberTopology, CyberRiskNode, CyberTopology } from './topologyData'
import AIAgentFace, { AIAgentFaceNode, AIAgentState } from './AIAgentFace'

// ============================================================
// CYBER RISK INTELLIGENCE — 3D AI AGENT CANVAS
// Interactive AI Cyber Risk Agent Face + Risk Constellation
// ============================================================

interface RiskNetworkCanvasProps {
  assets?: AssetRead[]
  activeScene?: number // 0: Exposure, 1: Impact, 2: Concentration, 3: Investment, 4: Decision
  highlightedAssetId?: number | null
  agentState?: AIAgentState
  onSelectAsset?: (assetId: number) => void
}

// ── Node Component with Interactive Hover, Pulse & Auras ────────────────────
interface NodeMeshProps {
  node: CyberRiskNode
  index: number
  isHovered: boolean
  isHighlighted: boolean
  isNeighbor: boolean
  hasAnyHovered: boolean
  activeScene: number
  onPointerOver: (e: any, node: CyberRiskNode, index: number) => void
  onPointerOut: (e: any) => void
  onClick: (e: any, node: CyberRiskNode) => void
}

function NodeMesh({
  node,
  index,
  isHovered,
  isHighlighted,
  isNeighbor,
  hasAnyHovered,
  activeScene,
  onPointerOver,
  onPointerOut,
  onClick,
}: NodeMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const glowRef = useRef<THREE.Mesh>(null!)
  const timeRef = useRef(node.pulsePhase)

  useFrame((_, delta) => {
    timeRef.current += delta * node.pulseSpeed
    const t = timeRef.current

    if (meshRef.current) {
      // Scene-based scale & emphasis
      let sceneScale = 1.0
      if (activeScene === 2) {
        // Concentration scene: critical nodes expand, peripheral nodes recede
        sceneScale = node.tier === 'Critical' ? 1.35 : 0.65
      } else if (activeScene === 1) {
        // Impact scene: high EAL nodes pulsate stronger
        sceneScale = node.ealInr > 100_000_000 ? 1.25 : 0.85
      } else if (activeScene === 3) {
        // Investment scene: balanced defensive coverage
        sceneScale = 1.05
      }

      // Base breathing pulsation
      const pulseAmplitude = node.tier === 'Critical' ? 0.16 : 0.08
      const pulse = 1 + Math.sin(t) * pulseAmplitude

      // Hover / Highlight magnification
      const hoverBoost = isHovered ? 1.45 : isHighlighted ? 1.35 : isNeighbor ? 1.15 : 1.0
      const dimFactor = hasAnyHovered && !isHovered && !isNeighbor && !isHighlighted ? 0.45 : 1.0

      const targetScale = (node.size * pulse * hoverBoost * sceneScale * dimFactor) / node.size
      meshRef.current.scale.setScalar(targetScale)

      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      if (mat) {
        const baseEmissive = node.tier === 'Critical' ? 0.35 : node.tier === 'Medium' ? 0.20 : 0.12
        const hoverEmissive = isHovered ? 0.95 : isHighlighted ? 0.80 : isNeighbor ? 0.50 : baseEmissive
        mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, hoverEmissive * (dimFactor > 0.5 ? 1 : 0.3), delta * 8)
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, isHovered || isHighlighted ? 1.0 : dimFactor, delta * 8)
      }

      if (glowRef.current) {
        glowRef.current.scale.setScalar(targetScale * (isHovered ? 1.25 : 1.1))
        const glowMat = glowRef.current.material as THREE.MeshBasicMaterial
        if (glowMat) {
          const baseGlow = node.tier === 'Critical' ? 0.12 : 0.06
          const hoverGlow = isHovered ? 0.28 : isHighlighted ? 0.22 : isNeighbor ? 0.16 : baseGlow
          glowMat.opacity = THREE.MathUtils.lerp(glowMat.opacity, hoverGlow * (dimFactor > 0.5 ? 1 : 0.2), delta * 8)
        }
      }
    }
  })

  return (
    <group position={node.position}>
      {/* Invisible enlarged hit target for effortless hover & clicking */}
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation()
          onPointerOver(e, node, index)
        }}
        onPointerOut={(e) => {
          e.stopPropagation()
          onPointerOut(e)
        }}
        onClick={(e) => {
          e.stopPropagation()
          onClick(e, node)
        }}
      >
        <sphereGeometry args={[Math.max(node.size * 1.6, 0.35), 12, 10]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Core solid cyber-asset node */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[node.size, 24, 18]} />
        <meshStandardMaterial
          color={node.color}
          emissive={node.glowColor}
          emissiveIntensity={node.tier === 'Critical' ? 0.35 : 0.18}
          roughness={0.45}
          metalness={0.25}
          transparent
          opacity={0.95}
        />
      </mesh>

      {/* Tight, refined luminous aura (restrained, no balloon bloat!) */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[node.size * 1.26, 16, 12]} />
        <meshBasicMaterial
          color={node.glowColor}
          transparent
          opacity={node.tier === 'Critical' ? 0.12 : 0.06}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Critical CISA KEV breach warning ring */}
      {node.kevCount > 0 && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[node.size * 1.35, node.size * 1.45, 32]} />
          <meshBasicMaterial
            color="#FF3B30"
            transparent
            opacity={isHovered ? 0.85 : 0.4}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  )
}

// ── Connection Pathways Component ───────────────────────────────────────────
interface ConnectionsProps {
  topology: CyberTopology
  hoveredIndex: number | null
  highlightedAssetId?: number | null
  activeScene: number
}

function RiskConnections({
  topology,
  hoveredIndex,
  highlightedAssetId,
  activeScene,
}: ConnectionsProps) {
  const lineSegmentsRef = useRef<THREE.LineSegments>(null!)

  const { geometry, neighborIndices } = useMemo(() => {
    const positions: number[] = []
    const colors: number[] = []
    const neighbors = new Set<number>()

    topology.edges.forEach((edge) => {
      const a = topology.nodes[edge.fromIndex]
      const b = topology.nodes[edge.toIndex]
      if (!a || !b) return

      const isConnectedToHovered =
        hoveredIndex !== null && (edge.fromIndex === hoveredIndex || edge.toIndex === hoveredIndex)
      const isConnectedToHighlight =
        highlightedAssetId != null && (a.id === highlightedAssetId || b.id === highlightedAssetId)

      if (isConnectedToHovered) {
        neighbors.add(edge.fromIndex)
        neighbors.add(edge.toIndex)
      }

      positions.push(a.position.x, a.position.y, a.position.z)
      positions.push(b.position.x, b.position.y, b.position.z)

      // Base color
      let edgeColor = edge.color.clone()

      if (activeScene === 3) {
        // Investment scene: golden defense pathways
        edgeColor.lerp(new THREE.Color('#C9A96E'), 0.4)
      } else if (activeScene === 2 && (a.tier === 'Critical' || b.tier === 'Critical')) {
        // Concentration scene: critical cluster lines flare red/amber
        edgeColor.lerp(new THREE.Color('#FF3B30'), 0.5)
      }

      // Brightness multiplier
      let brightness = 0.55
      if (hoveredIndex !== null || highlightedAssetId != null) {
        if (isConnectedToHovered || isConnectedToHighlight) {
          brightness = 1.6
          edgeColor = edgeColor.clone().multiplyScalar(1.5)
        } else {
          brightness = 0.12 // Dims unrelated lines
        }
      }

      colors.push(edgeColor.r * brightness, edgeColor.g * brightness, edgeColor.b * brightness)
      colors.push(edgeColor.r * brightness, edgeColor.g * brightness, edgeColor.b * brightness)
    })

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return { geometry: geo, neighborIndices: neighbors }
  }, [topology, hoveredIndex, highlightedAssetId, activeScene])

  return (
    <lineSegments ref={lineSegmentsRef} geometry={geometry}>
      <lineBasicMaterial
        vertexColors
        transparent
        opacity={hoveredIndex !== null ? 0.65 : 0.35}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </lineSegments>
  )
}

// ── Subtle Perspective Ground Plane ─────────────────────────────────────────
function PerspectiveGrid() {
  const ref = useRef<THREE.GridHelper>(null!)

  useEffect(() => {
    if (ref.current) {
      ref.current.position.y = -4.6
      ref.current.material.opacity = 0.16
      ;(ref.current.material as THREE.Material).transparent = true
      ;(ref.current.material as THREE.Material).depthWrite = false
      ;(ref.current.material as THREE.Material).blending = THREE.AdditiveBlending
    }
  }, [])

  return <gridHelper ref={ref} args={[50, 40, '#38B8E0', '#182740']} />
}

// ── Orbital Depth Rings ─────────────────────────────────────────────────────
function OrbitalDepthRings({ activeScene }: { activeScene: number }) {
  const groupRef = useRef<THREE.Group>(null!)

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.z = clock.getElapsedTime() * 0.004
      groupRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.005) * 0.05
    }
  })

  const rings = useMemo(
    () => [
      { radius: 5.2, opacity: 0.22, color: '#C9A96E' },
      { radius: 9.4, opacity: 0.14, color: '#38B8E0' },
      { radius: 14.0, opacity: 0.08, color: '#5B7FA8' },
    ],
    []
  )

  return (
    <group ref={groupRef} position={[4.6, 0.1, -2.0]}>
      {rings.map((ring, i) => (
        <mesh key={i} rotation={[Math.PI / 2 + i * 0.08, 0, 0]}>
          <ringGeometry args={[ring.radius - 0.03, ring.radius + 0.03, 128]} />
          <meshBasicMaterial
            color={activeScene === 3 ? '#C9A96E' : ring.color}
            transparent
            opacity={activeScene === 2 && i === 0 ? 0.35 : ring.opacity}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  )
}

// ── Minimal, Restrained Ambient Atmospheric Specks (NO wallpaper!) ──────────
function RestrainedAtmosphere() {
  const count = 36 // Extremely subtle spatial whisper

  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const sizes = new Float32Array(count)

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.sin(i * 17) * 0.5) * 36
      positions[i * 3 + 1] = (Math.cos(i * 23) * 0.5) * 22
      positions[i * 3 + 2] = (Math.sin(i * 31) * 0.5) * 20 - 4

      colors[i * 3] = 0.22
      colors[i * 3 + 1] = 0.45
      colors[i * 3 + 2] = 0.65
      sizes[i] = 0.08
    }
    return { positions, colors, sizes }
  }, [])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        transparent
        opacity={0.18}
        size={0.10}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

// ── Camera & Parallax Controller ────────────────────────────────────────────
function CameraController({
  activeScene,
  hoveredNode,
}: {
  activeScene: number
  hoveredNode: CyberRiskNode | null
}) {
  const { camera, pointer } = useThree()
  const targetPos = useRef(new THREE.Vector3(0.2, 0.5, 14.5))
  const targetLookAt = useRef(new THREE.Vector3(1.0, 0.1, 0))

  useFrame((_, delta) => {
    // Determine scene camera focal positions framing AI Agent in right 40-45%:
    switch (activeScene) {
      case 0:
        // Wide two-column composition: Camera centered around X = 0.8
        // Agent at X = 4.6 sits on the right (~75% screen width)
        // Left text at X = -3.5 to 0.0 sits unobstructed on the left (~25-55% screen width)
        targetPos.current.set(0.2, 0.4, 14.5)
        targetLookAt.current.set(1.0, 0.1, 0)
        break
      case 1:
        // Impact scene: gentle shift toward the agent's risk sensory nodes
        targetPos.current.set(1.2, 0.4, 13.8)
        targetLookAt.current.set(2.4, 0.1, 0)
        break
      case 2:
        // Concentration scene: zooms into the critical asset nodes inside the consciousness
        targetPos.current.set(2.8, 0.2, 11.8)
        targetLookAt.current.set(4.6, 0.1, 0)
        break
      case 3:
        // Investment scene: balanced vantage showing golden defense pathways
        targetPos.current.set(1.2, 0.4, 14.0)
        targetLookAt.current.set(2.2, 0.1, 0)
        break
      case 4:
        // Decision scene: calm, executive vantage
        targetPos.current.set(0.6, 0.6, 15.2)
        targetLookAt.current.set(1.6, 0.2, 0)
        break
      default:
        targetPos.current.set(0.2, 0.4, 14.5)
        targetLookAt.current.set(1.0, 0.1, 0)
    }

    // Subtle gentle mouse parallax (soft displacement, NO wild swings)
    const parallaxX = pointer.x * 0.35
    const parallaxY = pointer.y * 0.22

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetPos.current.x + parallaxX, delta * 2.8)
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetPos.current.y + parallaxY, delta * 2.8)
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetPos.current.z, delta * 2.8)

    camera.lookAt(targetLookAt.current)
  })

  return null
}

// ── Scene Lighting ──────────────────────────────────────────────────────────
function SceneLighting({ activeScene }: { activeScene: number }) {
  return (
    <>
      <ambientLight intensity={0.4} color="#3b5278" />
      <directionalLight position={[10, 10, 8]} intensity={0.65} color="#dbeafe" />

      {/* Critical risk accent light — flares in concentration scene */}
      <pointLight
        position={[3.5, 1.0, 2]}
        intensity={activeScene === 2 ? 2.2 : 1.2}
        color="#FF4D4D"
        distance={24}
        decay={2}
      />

      {/* Analytical steel light */}
      <pointLight position={[-4, 3, 2]} intensity={1.1} color="#38B8E0" distance={22} decay={2} />

      {/* Financial gold light — flares in investment scene */}
      <pointLight
        position={[6, -2, 1]}
        intensity={activeScene === 3 ? 2.2 : 1.2}
        color="#C9A96E"
        distance={22}
        decay={2}
      />
    </>
  )
}

// ============================================================
// MAIN EXPORTED CANVAS COMPONENT
// ============================================================

export default function RiskNetworkCanvas({
  assets,
  activeScene = 0,
  highlightedAssetId = null,
  agentState,
  onSelectAsset,
}: RiskNetworkCanvasProps) {
  const [hoveredNode, setHoveredNode] = useState<any | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [selectedNode, setSelectedNode] = useState<any | null>(null)

  // Determine state of the AI Agent Face based on scene or explicit state
  const effectiveAgentState: AIAgentState =
    agentState ||
    (activeScene === 3
      ? 'optimized'
      : activeScene === 1 || activeScene === 2
      ? 'high_risk'
      : activeScene === 0
      ? 'stable'
      : 'stable')

  const topology = useMemo(() => buildCyberTopology(assets), [assets])

  const handlePointerOver = useCallback((e: any, node: CyberRiskNode, index: number) => {
    setHoveredNode(node)
    setHoveredIndex(index)
    if (e.clientX && e.clientY) {
      setCursorPos({ x: e.clientX, y: e.clientY })
    }
  }, [])

  const handlePointerOut = useCallback(() => {
    setHoveredNode(null)
    setHoveredIndex(null)
  }, [])

  const handleClick = useCallback(
    (e: any, node: CyberRiskNode) => {
      setSelectedNode(node)
      if (onSelectAsset) {
        onSelectAsset(node.id)
      }
    },
    [onSelectAsset]
  )

  // Face Node Handlers
  const handleFaceNodeHover = useCallback((node: AIAgentFaceNode | null, mouseEvent?: { x: number; y: number }) => {
    setHoveredNode(node)
    if (mouseEvent) {
      setCursorPos({ x: mouseEvent.x, y: mouseEvent.y })
    }
  }, [])

  const handleFaceNodeClick = useCallback((node: AIAgentFaceNode) => {
    setSelectedNode(node)
    if (onSelectAsset) {
      onSelectAsset(node.id)
    }
  }, [onSelectAsset])

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onPointerMove={(e) => {
        if (hoveredNode) {
          setCursorPos({ x: e.clientX, y: e.clientY })
        }
      }}
    >
      <Suspense fallback={null}>
        <Canvas
          camera={{ position: [0, 0.8, 15], fov: 48, near: 0.1, far: 100 }}
          style={{ width: '100%', height: '100%' }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          dpr={[1, 1.75]}
          frameloop="always"
        >
          <CameraController activeScene={activeScene} hoveredNode={hoveredNode} />
          <SceneLighting activeScene={activeScene} />

          {/* Reference Structures */}
          <PerspectiveGrid />
          <OrbitalDepthRings activeScene={activeScene} />

          {/* Minimal atmospheric dust (48 points, strictly background) */}
          <RestrainedAtmosphere />

          {/* Primary Interactive AI Cyber Risk Agent Face */}
          <AIAgentFace
            assets={assets}
            agentState={effectiveAgentState}
            activeScene={activeScene}
            hoveredNodeId={hoveredNode?.id}
            highlightedAssetId={highlightedAssetId}
            onNodeHover={handleFaceNodeHover}
            onNodeClick={handleFaceNodeClick}
          />
        </Canvas>
      </Suspense>

      {/* Floating Cyber HUD Tooltip on Hover */}
      {hoveredNode && (
        <div
          className="cyber-hud-tooltip"
          style={{
            position: 'fixed',
            left: Math.min(cursorPos.x + 18, window.innerWidth - 280),
            top: Math.max(cursorPos.y - 40, 20),
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          <div className="hud-header">
            <span className="hud-hostname">{hoveredNode.hostname}</span>
            <span className={`hud-tier-tag hud-tier-${hoveredNode.tier.toLowerCase()}`}>
              {hoveredNode.tier}
            </span>
          </div>

          <div className="hud-metric">
            <span className="hud-label">Expected Annual Loss</span>
            <span className="hud-value">{formatINR(hoveredNode.ealInr)}</span>
          </div>

          <div className="hud-meta-row">
            <span className="hud-meta-item">{hoveredNode.assetType}</span>
            <span className="hud-meta-sep">·</span>
            <span className="hud-meta-item">{hoveredNode.businessUnit}</span>
            {hoveredNode.kevCount > 0 && (
              <>
                <span className="hud-meta-sep">·</span>
                <span className="hud-kev-alert">⚠ ACTIVE KEV</span>
              </>
            )}
          </div>
          <div className="hud-hint">Click node for intelligence dossier</div>
        </div>
      )}

      {/* Compact Asset Intelligence Drawer / Modal on Node Click */}
      {selectedNode && (
        <div className="cyber-node-drawer" role="dialog" aria-label="Asset Intelligence Overview">
          <div className="drawer-card">
            <div className="drawer-topbar">
              <div className="drawer-title-group">
                <span className="drawer-overline">{selectedNode.assetType} · HOPS: {selectedNode.hops}</span>
                <h3 className="drawer-hostname">{selectedNode.hostname}</h3>
              </div>
              <button
                className="drawer-close-btn"
                onClick={() => setSelectedNode(null)}
                aria-label="Close dossier"
              >
                ✕
              </button>
            </div>

            <div className="drawer-metrics-grid">
              <div className="drawer-metric">
                <div className="drawer-metric-label">Estimated EAL</div>
                <div className="drawer-metric-value" style={{ color: selectedNode.tier === 'Critical' ? 'var(--risk-critical)' : 'var(--accent)' }}>
                  {formatINR(selectedNode.ealInr)}
                </div>
              </div>
              <div className="drawer-metric">
                <div className="drawer-metric-label">Risk Classification</div>
                <div className={`drawer-tier-badge drawer-tier-${selectedNode.tier.toLowerCase()}`}>
                  {selectedNode.tier} Priority
                </div>
              </div>
              <div className="drawer-metric">
                <div className="drawer-metric-label">Vulnerabilities</div>
                <div className="drawer-metric-sub">
                  {selectedNode.vulnCount > 0 ? `${selectedNode.vulnCount} unpatched CVEs` : 'Zero active CVEs'}
                  {selectedNode.kevCount > 0 && <span className="drawer-kev-flag"> · {selectedNode.kevCount} KEV</span>}
                </div>
              </div>
              <div className="drawer-metric">
                <div className="drawer-metric-label">Business Domain</div>
                <div className="drawer-metric-sub">{selectedNode.businessUnit}</div>
              </div>
            </div>

            <div className="drawer-actions">
              <a
                href={`/assets`}
                className="btn btn-primary"
                style={{ fontSize: 12, padding: '8px 16px' }}
              >
                View in Asset Intelligence →
              </a>
              <button
                className="btn btn-secondary"
                style={{ fontSize: 12, padding: '8px 14px' }}
                onClick={() => setSelectedNode(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
