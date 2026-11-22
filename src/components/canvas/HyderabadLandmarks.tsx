import { useRef, useMemo, useLayoutEffect, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { HYDERABAD_SECTORS } from '../../data/sectors'
import { HoveredEntity } from '../../types'
import { soundEngine } from '../../utils/audio'

interface HyderabadLandmarksProps {
  activeSectorId: string | null
  onSelectSector: (id: string) => void
  onHoverEntity: (entity: HoveredEntity | null) => void
  hoveredEntity: HoveredEntity | null
  rainfall: number
  waterLevel: number
  xrayRef: React.MutableRefObject<number>
}

interface TowerInstance {
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
  seed: number
  tier: number // 0 = low old city, 1 = mid urban, 2 = glass skyscraper
}

// Custom procedural architectural window-lit building shader (zero flat colored cubes)
const SkylineVertexShader = /* glsl */ `
  attribute float aSeed;
  attribute float aTier;
  varying vec3 vLocalPos;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vSeed;
  varying float vTier;

  void main() {
    vLocalPos = position + vec3(0.5); // 0..1 across unit box
    vSeed = aSeed;
    vTier = aTier;

    mat4 instMat = instanceMatrix;
    vec4 worldPosition = modelMatrix * instMat * vec4(position, 1.0);
    vWorldPos = worldPosition.xyz;
    vNormal = normalize(mat3(modelMatrix) * mat3(instMat) * normal);

    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const SkylineFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uRainfall;
  uniform float uXray;

  varying vec3 vLocalPos;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vSeed;
  varying float vTier;

  float hash21(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  void main() {
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 L = normalize(vec3(0.5, 0.85, 0.4));

    float ndotl = max(dot(N, L), 0.0);
    float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);

    // Architectural obsidian glass & dark concrete base
    vec3 darkConcrete = mix(vec3(0.045, 0.055, 0.072), vec3(0.06, 0.085, 0.115), vTier * 0.5);
    vec3 baseCol = darkConcrete * (0.42 + ndotl * 0.48);
    if (abs(N.y) > 0.85) baseCol *= 0.62;

    // Subtle roof rim / glass reflection
    baseCol += vec3(0.12, 0.18, 0.24) * fresnel * (0.35 + vTier * 0.35);

    // Procedural architectural window grid on vertical facades only
    float isSide = 1.0 - step(0.85, abs(N.y));
    if (isSide > 0.5) {
      float u = abs(N.x) > 0.5 ? vLocalPos.z : vLocalPos.x;
      float v = vLocalPos.y;

      float cols = mix(4.0, 8.0, vTier * 0.5);
      float floors = mix(6.0, 22.0, vTier * 0.5);

      vec2 cell = vec2(floor(u * cols), floor(v * floors));
      vec2 f = fract(vec2(u * cols, v * floors));

      // Window frame mullion mask
      float winMask = step(0.18, f.x) * step(f.x, 0.82) * step(0.26, f.y) * step(f.y, 0.78);
      // Exclude ground lobby & top mechanical penthouse
      float bandMask = step(0.08, v) * step(v, 0.94);

      float rnd = hash21(cell + vec2(vSeed * 71.3, vSeed * 19.7));
      float litChance = mix(0.28, 0.46, vTier * 0.5);
      float isLit = step(1.0 - litChance, rnd);

      // Subtle slow occupancy flicker
      float pulse = 0.88 + 0.12 * sin(uTime * 0.4 + rnd * 25.0);

      // Warm bone-white office glow & cool slate-white glass
      vec3 warmLight = vec3(0.95, 0.87, 0.72);
      vec3 coolLight = vec3(0.76, 0.88, 0.96);
      vec3 winColor = mix(warmLight, coolLight, step(0.55, fract(rnd * 13.7)));

      // Dim some lights slightly during extreme storm
      float stormDim = 1.0 - clamp(uRainfall / 120.0, 0.0, 1.0) * 0.18;
      baseCol += winColor * winMask * bandMask * isLit * pulse * stormDim * 0.72;
    }

    // Subtle elevation top hairline accent
    float roofEdge = smoothstep(0.95, 1.0, vLocalPos.y);
    baseCol += vec3(0.22, 0.28, 0.34) * roofEdge * 0.35;

    float alpha = mix(0.96, 0.28, uXray);
    gl_FragColor = vec4(baseCol, alpha);
  }
`

export function HyderabadLandmarks({
  activeSectorId,
  onSelectSector,
  onHoverEntity,
  hoveredEntity,
  rainfall,
  waterLevel,
  xrayRef,
}: HyderabadLandmarksProps) {
  const towers = useMemo<TowerInstance[]>(() => {
    const list: TowerInstance[] = []
    const pseudo = (i: number) => {
      const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453
      return x - Math.floor(x)
    }

    // 1. HITEC City & Financial District High-Rise Cluster (around -4.2, -2.7)
    for (let i = 0; i < 95; i++) {
      const a = pseudo(i * 3 + 1) * Math.PI * 2
      const r = 0.55 + Math.pow(pseudo(i * 3 + 2), 0.75) * 2.5
      const x = -4.2 + Math.cos(a) * r
      const z = -2.7 + Math.sin(a) * r
      // Keep immediate footprint around Cyber Towers clear
      if (Math.hypot(x + 4.2, z + 2.7) < 0.65) continue
      const h = 0.45 + Math.pow(pseudo(i * 3 + 3), 1.4) * 1.45
      const w = 0.16 + pseudo(i * 5 + 1) * 0.16
      const d = 0.16 + pseudo(i * 5 + 2) * 0.16
      list.push({ x, y: 0.52, z, w, h, d, seed: pseudo(i + 11), tier: 2 })
    }

    // 2. Madhapur & Jubilee Ridge Mid-High Urban Cluster (around -2.6, 0.9)
    for (let i = 0; i < 70; i++) {
      const a = pseudo(i * 7 + 1) * Math.PI * 2
      const r = 0.75 + pseudo(i * 7 + 2) * 2.2
      const x = -2.6 + Math.cos(a) * r
      const z = 0.9 + Math.sin(a) * r
      // Keep Durgam Cheruvu bridge span clear
      if (Math.hypot(x + 2.1, z - 0.3) < 0.95) continue
      const h = 0.3 + pseudo(i * 7 + 3) * 0.85
      const w = 0.15 + pseudo(i * 11 + 1) * 0.14
      const d = 0.15 + pseudo(i * 11 + 2) * 0.14
      list.push({ x, y: 0.22, z, w, h, d, seed: pseudo(i + 131), tier: 1.4 })
    }

    // 3. Hussain Sagar Perimeter (Necklace Road / Tank Bund / Begumpet)
    for (let i = 0; i < 65; i++) {
      const a = (i / 65) * Math.PI * 2 + pseudo(i * 2) * 0.15
      const r = 1.45 + pseudo(i * 9 + 1) * 1.3
      const x = 0.45 + Math.cos(a) * r
      const z = 0.6 + Math.sin(a) * r
      const h = 0.25 + pseudo(i * 9 + 2) * 0.68
      const w = 0.14 + pseudo(i * 9 + 3) * 0.12
      const d = 0.14 + pseudo(i * 9 + 4) * 0.12
      list.push({ x, y: 0.1, z, w, h, d, seed: pseudo(i + 251), tier: 1.0 })
    }

    // 4. Old City & Musi Riverbanks (dense low-rise historic fabric around Charminar)
    for (let i = 0; i < 100; i++) {
      const a = pseudo(i * 13 + 1) * Math.PI * 2
      const r = 0.6 + pseudo(i * 13 + 2) * 2.4
      const x = 2.7 + Math.cos(a) * r
      const z = 3.15 + Math.sin(a) * r
      if (Math.hypot(x - 2.7, z - 3.15) < 0.62) continue
      const h = 0.14 + pseudo(i * 13 + 3) * 0.32
      const w = 0.12 + pseudo(i * 13 + 4) * 0.12
      const d = 0.12 + pseudo(i * 13 + 5) * 0.12
      list.push({ x, y: 0.04, z, w, h, d, seed: pseudo(i + 409), tier: 0.2 })
    }

    return list
  }, [])

  const calcDepthCm = (groundY: number) => {
    const diff = waterLevel - groundY
    return diff > 0 ? Math.round(diff * 240) : 0
  }

  return (
    <group>
      {/* Procedural Shader-Lit Architectural Skyline */}
      <ArchitecturalSkyline towers={towers} rainfall={rainfall} xrayRef={xrayRef} />

      {/* LANDMARK 1: CYBER TOWERS (HITEC City) */}
      <CyberTowersLandmark
        position={[-4.2, 0.56, -2.7]}
        onHover={(hovering) =>
          onHoverEntity(
            hovering
              ? {
                  id: 'cyber-towers',
                  name: 'CYBER TOWERS // HITEC HUB',
                  category: 'LANDMARK',
                  elevation: 562,
                  waterDepthCm: calcDepthCm(0.56),
                  status: rainfall > 85 ? 'SHEETFLOW SURGE' : 'ELEVATED SAFE',
                  worldPosition: [-4.2, 1.9, -2.7],
                }
              : null
          )
        }
        onClick={() => {
          soundEngine.playClick(1100)
          onSelectSector('hitec-city')
        }}
      />

      {/* LANDMARK 2: DURGAM CHERUVU CABLE-STAYED BRIDGE */}
      <DurgamCheruvuBridge
        position={[-2.1, -0.04, 0.3]}
        onHover={(hovering) =>
          onHoverEntity(
            hovering
              ? {
                  id: 'durgam-bridge',
                  name: 'DURGAM CHERUVU CABLE BRIDGE',
                  category: 'LANDMARK',
                  elevation: 544,
                  waterDepthCm: calcDepthCm(-0.22),
                  status: rainfall > 65 ? 'WEIR SPILL ACTIVE' : 'CLEAR SPAN',
                  worldPosition: [-2.1, 1.15, 0.3],
                }
              : null
          )
        }
        onClick={() => {
          soundEngine.playClick(1100)
          onSelectSector('madhapur')
        }}
      />

      {/* LANDMARK 3: HUSSAIN SAGAR CENTRAL MONOLITH */}
      <HussainSagarMonolith
        position={[0.45, -0.06, 0.6]}
        rainfall={rainfall}
        onHover={(hovering) =>
          onHoverEntity(
            hovering
              ? {
                  id: 'hussain-monolith',
                  name: 'HUSSAIN SAGAR MONOLITH',
                  category: 'LANDMARK',
                  elevation: 512,
                  waterDepthCm: calcDepthCm(-0.18),
                  status: rainfall > 70 ? 'FTL 98% CRITICAL' : 'SLUICE NOMINAL',
                  worldPosition: [0.45, 1.1, 0.6],
                }
              : null
          )
        }
        onClick={() => {
          soundEngine.playClick(1100)
          onSelectSector('hussain-sagar')
        }}
      />

      {/* LANDMARK 4: CHARMINAR MONUMENT (Old City / Musi) */}
      <CharminarMonument
        position={[2.7, 0.06, 3.15]}
        onHover={(hovering) =>
          onHoverEntity(
            hovering
              ? {
                  id: 'charminar',
                  name: 'CHARMINAR // OLD CITY CORE',
                  category: 'LANDMARK',
                  elevation: 488,
                  waterDepthCm: calcDepthCm(0.06),
                  status: rainfall > 50 ? 'MUSI BACKFLOW RISK' : 'MONITORING',
                  worldPosition: [2.7, 1.35, 3.15],
                }
              : null
          )
        }
        onClick={() => {
          soundEngine.playClick(1100)
          onSelectSector('musi-riverbed')
        }}
      />

      {/* INTERACTIVE 3D SECTOR SENSOR BEACONS */}
      {HYDERABAD_SECTORS.map((sector) => (
        <SectorSensorBeacon
          key={sector.id}
          sector={sector}
          isActive={sector.id === activeSectorId}
          rainfall={rainfall}
          waterDepthCm={calcDepthCm(sector.groundY)}
          onSelect={() => {
            soundEngine.playSectorSwitch()
            onSelectSector(sector.id)
          }}
          onHover={(hovering) =>
            onHoverEntity(
              hovering
                ? {
                    id: sector.id,
                    name: sector.name.toUpperCase(),
                    category: 'SECTOR',
                    elevation: sector.elevation,
                    waterDepthCm: calcDepthCm(sector.groundY),
                    status: sector.pumpStatus,
                    worldPosition: [
                      sector.beaconPosition[0],
                      sector.beaconPosition[1] + 1.4,
                      sector.beaconPosition[2],
                    ],
                  }
                : null
            )
          }
        />
      ))}

      {/* ARCHITECTURAL 3D RAYCAST CALLOUT TOOLTIP */}
      {hoveredEntity && (
        <Html
          position={hoveredEntity.worldPosition}
          center
          distanceFactor={14}
          zIndexRange={[40, 0]}
          style={{ pointerEvents: 'none' }}
        >
          <div className="pointer-events-none select-none flex flex-col items-start">
            <div className="bg-[#040608]/92 border border-white/15 px-3 py-2 backdrop-blur-md min-w-[200px]">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-1 mb-1.5">
                <span className="font-mono text-[8px] tracking-[0.2em] text-[#6E7781]">
                  {hoveredEntity.category}
                </span>
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor:
                      hoveredEntity.waterDepthCm > 80
                        ? '#EF4444'
                        : hoveredEntity.waterDepthCm > 30
                        ? '#F59E0B'
                        : '#14B8A6',
                  }}
                />
              </div>
              <div className="font-mono text-[10px] font-medium text-[#F2F4F7] tracking-wider whitespace-nowrap">
                {hoveredEntity.name}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 pt-1.5 border-t border-white/10 font-mono text-[8px]">
                <div>
                  <span className="block text-[#6E7781]">ELEV</span>
                  <span className="text-[#F2F4F7]">{hoveredEntity.elevation}M</span>
                </div>
                <div>
                  <span className="block text-[#6E7781]">DEPTH</span>
                  <span
                    className={
                      hoveredEntity.waterDepthCm > 80
                        ? 'text-[#EF4444]'
                        : hoveredEntity.waterDepthCm > 30
                        ? 'text-[#F59E0B]'
                        : 'text-[#F2F4F7]'
                    }
                  >
                    {hoveredEntity.waterDepthCm} CM
                  </span>
                </div>
                <div>
                  <span className="block text-[#6E7781]">STATUS</span>
                  <span className="text-[#F2F4F7] truncate block">{hoveredEntity.status}</span>
                </div>
              </div>
            </div>
            {/* Razor-sharp vertical architectural callout stem */}
            <div className="w-px h-7 bg-white/35 ml-4" />
          </div>
        </Html>
      )}
    </group>
  )
}

function ArchitecturalSkyline({
  towers,
  rainfall,
  xrayRef,
}: {
  towers: TowerInstance[]
  rainfall: number
  xrayRef: React.MutableRefObject<number>
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const matRef = useRef<THREE.ShaderMaterial>(null)

  const geometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const seeds = new Float32Array(towers.length)
    const tiers = new Float32Array(towers.length)
    towers.forEach((t, i) => {
      seeds[i] = t.seed
      tiers[i] = t.tier
    })
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))
    geo.setAttribute('aTier', new THREE.InstancedBufferAttribute(tiers, 1))
    return geo
  }, [towers])

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uRainfall: { value: 0 },
      uXray: { value: 0 },
    }),
    []
  )

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const mat = new THREE.Matrix4()
    const pos = new THREE.Vector3()
    const quat = new THREE.Quaternion()
    const scale = new THREE.Vector3()

    towers.forEach((t, i) => {
      pos.set(t.x, t.y + t.h * 0.5, t.z)
      scale.set(t.w, t.h, t.d)
      mat.compose(pos, quat, scale)
      mesh.setMatrixAt(i, mat)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [towers])

  useFrame((_, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta
      matRef.current.uniforms.uRainfall.value = rainfall
      matRef.current.uniforms.uXray.value = xrayRef.current
    }
  })

  return (
    <instancedMesh ref={meshRef} args={[geometry, undefined, towers.length]} castShadow receiveShadow>
      <shaderMaterial
        ref={matRef}
        vertexShader={SkylineVertexShader}
        fragmentShader={SkylineFragmentShader}
        uniforms={uniforms}
        transparent
      />
    </instancedMesh>
  )
}

/**
 * Iconic Cyber Towers: 4-quadrant cylindrical glass tower with central atrium & glowing floor bands
 */
function CyberTowersLandmark({
  position,
  onHover,
  onClick,
}: {
  position: [number, number, number]
  onHover: (v: boolean) => void
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const quadrants = [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]

  return (
    <group
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        onHover(true)
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        setHovered(false)
        onHover(false)
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {/* Circular podium base */}
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.56, 0.6, 0.12, 32]} />
        <meshStandardMaterial color="#18202a" roughness={0.6} metalness={0.4} />
      </mesh>

      {/* Four iconic quadrant curved wings */}
      {quadrants.map((angle, idx) => (
        <mesh
          key={idx}
          position={[0, 0.62, 0]}
          rotation={[0, angle + 0.1, 0]}
          castShadow
        >
          <cylinderGeometry args={[0.46, 0.48, 1.02, 16, 1, false, 0, Math.PI / 2 - 0.2]} />
          <meshStandardMaterial
            color={hovered ? '#2d4659' : '#162433'}
            roughness={0.18}
            metalness={0.85}
            emissive="#1e3a4c"
            emissiveIntensity={hovered ? 0.8 : 0.35}
          />
        </mesh>
      ))}

      {/* Central structural core */}
      <mesh position={[0, 0.68, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 1.18, 16]} />
        <meshStandardMaterial color="#0f151d" roughness={0.4} metalness={0.7} />
      </mesh>

      {/* Illuminated architectural floor rings */}
      {[0.28, 0.48, 0.68, 0.88, 1.06].map((y, idx) => (
        <mesh key={idx} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.475, 0.008, 8, 40]} />
          <meshBasicMaterial color={hovered ? '#F2F4F7' : '#94a3b8'} transparent opacity={hovered ? 0.85 : 0.42} />
        </mesh>
      ))}

      {/* Crown spire */}
      <mesh position={[0, 1.36, 0]}>
        <cylinderGeometry args={[0.008, 0.015, 0.24, 8]} />
        <meshBasicMaterial color="#F2F4F7" />
      </mesh>
    </group>
  )
}

/**
 * Iconic Durgam Cheruvu Cable-Stayed Bridge: Twin A-frame pylons + tension cables spanning water
 */
function DurgamCheruvuBridge({
  position,
  onHover,
  onClick,
}: {
  position: [number, number, number]
  onHover: (v: boolean) => void
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  const cableGeo = useMemo(() => {
    const pts: number[] = []
    const pylonXs = [-0.72, 0.72]
    const anchorOffsets = [0.22, 0.42, 0.62, 0.82, 1.02]

    pylonXs.forEach((px) => {
      anchorOffsets.forEach((off, idx) => {
        const topY = 0.86 - idx * 0.045
        // Left & right spans on both deck edges
        for (const zEdge of [-0.08, 0.08]) {
          pts.push(px, topY, 0, px - off, 0.24, zEdge)
          pts.push(px, topY, 0, px + off, 0.24, zEdge)
        }
      })
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return geo
  }, [])

  return (
    <group
      position={position}
      rotation={[0, -0.45, 0]}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        onHover(true)
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        setHovered(false)
        onHover(false)
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {/* Sleek elevated bridge deck */}
      <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.4, 0.055, 0.22]} />
        <meshStandardMaterial color="#1f2937" roughness={0.5} metalness={0.6} />
      </mesh>

      {/* Subtle architectural edge lighting strips along bridge deck */}
      <mesh position={[0, 0.275, 0.105]}>
        <boxGeometry args={[3.36, 0.012, 0.012]} />
        <meshBasicMaterial color={hovered ? '#F59E0B' : '#cbd5e1'} />
      </mesh>
      <mesh position={[0, 0.275, -0.105]}>
        <boxGeometry args={[3.36, 0.012, 0.012]} />
        <meshBasicMaterial color={hovered ? '#F59E0B' : '#cbd5e1'} />
      </mesh>

      {/* Twin A-Frame Pylons */}
      {[-0.72, 0.72].map((px, idx) => (
        <group key={idx} position={[px, 0, 0]}>
          {/* Pier base submerged into lake */}
          <mesh position={[0, 0.06, 0]}>
            <boxGeometry args={[0.14, 0.42, 0.28]} />
            <meshStandardMaterial color="#111827" roughness={0.7} />
          </mesh>
          {/* Left slanted A-frame leg */}
          <mesh position={[0, 0.56, -0.09]} rotation={[0.16, 0, 0]} castShadow>
            <boxGeometry args={[0.055, 0.76, 0.055]} />
            <meshStandardMaterial color="#d1d5db" roughness={0.35} metalness={0.3} />
          </mesh>
          {/* Right slanted A-frame leg */}
          <mesh position={[0, 0.56, 0.09]} rotation={[-0.16, 0, 0]} castShadow>
            <boxGeometry args={[0.055, 0.76, 0.055]} />
            <meshStandardMaterial color="#d1d5db" roughness={0.35} metalness={0.3} />
          </mesh>
          {/* Crossbar */}
          <mesh position={[0, 0.74, 0]}>
            <boxGeometry args={[0.05, 0.04, 0.14]} />
            <meshStandardMaterial color="#e5e7eb" roughness={0.35} />
          </mesh>
        </group>
      ))}

      {/* Glowing suspension tension cables */}
      <lineSegments geometry={cableGeo}>
        <lineBasicMaterial
          color={hovered ? '#F2F4F7' : '#94a3b8'}
          transparent
          opacity={hovered ? 0.92 : 0.58}
        />
      </lineSegments>
    </group>
  )
}

/**
 * Iconic Charminar Monument: 4 slender corner minarets, arched plinth, warm limestone uplighting
 */
function CharminarMonument({
  position,
  onHover,
  onClick,
}: {
  position: [number, number, number]
  onHover: (v: boolean) => void
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const minaretOffsets: [number, number][] = [
    [-0.22, -0.22],
    [0.22, -0.22],
    [-0.22, 0.22],
    [0.22, 0.22],
  ]

  return (
    <group
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        onHover(true)
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        setHovered(false)
        onHover(false)
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {/* Raised plinth */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[0.62, 0.1, 0.62]} />
        <meshStandardMaterial color="#2c2824" roughness={0.8} />
      </mesh>

      {/* Upper grand gallery & arched pavilion */}
      <mesh position={[0, 0.36, 0]} castShadow>
        <boxGeometry args={[0.42, 0.26, 0.42]} />
        <meshStandardMaterial
          color={hovered ? '#d6c6b2' : '#9c8c78'}
          roughness={0.7}
          emissive="#4a351c"
          emissiveIntensity={hovered ? 0.55 : 0.25}
        />
      </mesh>

      {/* Four corner piers creating the iconic four-way arch opening */}
      {minaretOffsets.map(([mx, mz], idx) => (
        <group key={idx} position={[mx, 0, mz]}>
          {/* Main slender minaret shaft */}
          <mesh position={[0, 0.52, 0]} castShadow>
            <cylinderGeometry args={[0.042, 0.052, 0.92, 12]} />
            <meshStandardMaterial
              color={hovered ? '#e6d8c5' : '#b2a28e'}
              roughness={0.65}
              emissive="#453018"
              emissiveIntensity={0.22}
            />
          </mesh>
          {/* Mid-minaret carved balcony ring */}
          <mesh position={[0, 0.58, 0]}>
            <cylinderGeometry args={[0.064, 0.056, 0.04, 12]} />
            <meshStandardMaterial color="#c9baa6" roughness={0.6} />
          </mesh>
          {/* Upper lotus dome */}
          <mesh position={[0, 1.0, 0]}>
            <sphereGeometry args={[0.052, 12, 12]} />
            <meshStandardMaterial color="#dfd3c3" roughness={0.5} />
          </mesh>
          {/* Finial spire */}
          <mesh position={[0, 1.09, 0]}>
            <coneGeometry args={[0.015, 0.1, 8]} />
            <meshBasicMaterial color="#F59E0B" />
          </mesh>
        </group>
      ))}

      {/* Subtle warm heritage uplight */}
      <pointLight position={[0, 0.22, 0]} color="#f5c278" intensity={hovered ? 1.4 : 0.65} distance={2.6} />
    </group>
  )
}

/**
 * Hussain Sagar Central Monolith on Gibraltar Rock Island
 */
function HussainSagarMonolith({
  position,
  rainfall,
  onHover,
  onClick,
}: {
  position: [number, number, number]
  rainfall: number
  onHover: (v: boolean) => void
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const ringRef = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.35
    }
  })

  return (
    <group
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        onHover(true)
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        setHovered(false)
        onHover(false)
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {/* Stepped basalt island platform */}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <cylinderGeometry args={[0.28, 0.38, 0.18, 16]} />
        <meshStandardMaterial color="#1c2229" roughness={0.8} />
      </mesh>
      {/* Lotus pedestal */}
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.14, 0.2, 0.12, 16]} />
        <meshStandardMaterial color="#8f9aa6" roughness={0.55} />
      </mesh>
      {/* Sculpted towering monolith silhouette */}
      <mesh position={[0, 0.56, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.095, 0.58, 12]} />
        <meshStandardMaterial
          color={hovered ? '#F2F4F7' : '#cbd5e1'}
          roughness={0.42}
          metalness={0.2}
          emissive="#1e293b"
          emissiveIntensity={0.35}
        />
      </mesh>
      {/* Crown halo */}
      <mesh position={[0, 0.88, 0]}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.4} />
      </mesh>

      {/* Hydrological FTL gauge ring around island */}
      <mesh ref={ringRef} position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.42, 0.44, 48]} />
        <meshBasicMaterial
          color={rainfall > 75 ? '#EF4444' : rainfall > 40 ? '#F59E0B' : '#14B8A6'}
          transparent
          opacity={0.75}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

/**
 * Minimal architectural 3D sensor beacon for each Hyderabad watershed sector
 */
function SectorSensorBeacon({
  sector,
  isActive,
  rainfall,
  waterDepthCm,
  onSelect,
  onHover,
}: {
  sector: (typeof HYDERABAD_SECTORS)[0]
  isActive: boolean
  rainfall: number
  waterDepthCm: number
  onSelect: () => void
  onHover: (v: boolean) => void
}) {
  const ringRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  const rainRatio = rainfall / 120
  const statusColor = useMemo(() => {
    if (waterDepthCm > 80 || (sector.id === 'musi-riverbed' && rainRatio > 0.45)) return '#EF4444'
    if (waterDepthCm > 30 || rainRatio > 0.45) return '#F59E0B'
    return '#14B8A6'
  }, [sector.id, rainRatio, waterDepthCm])

  useFrame((state, delta) => {
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * (isActive || hovered ? 1.4 : 0.45)
      const s = 1 + Math.sin(state.clock.elapsedTime * 2.5) * 0.08
      ringRef.current.scale.set(s, s, 1)
    }
  })

  const [x, y, z] = sector.beaconPosition

  return (
    <group
      position={[x, y, z]}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        onHover(true)
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        setHovered(false)
        onHover(false)
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      {/* Invisible hit sphere for effortless clicking & hovering */}
      <mesh position={[0, 0.55, 0]} visible={false}>
        <sphereGeometry args={[0.52, 12, 12]} />
        <meshBasicMaterial />
      </mesh>

      {/* Ultra-thin vertical telemetry needle */}
      <mesh position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.006, 0.006, 1.44, 6]} />
        <meshBasicMaterial
          color={isActive || hovered ? '#F2F4F7' : statusColor}
          transparent
          opacity={isActive || hovered ? 0.9 : 0.45}
        />
      </mesh>

      {/* Top micro sensor node */}
      <mesh position={[0, 1.44, 0]}>
        <octahedronGeometry args={[isActive || hovered ? 0.065 : 0.045, 0]} />
        <meshBasicMaterial color={statusColor} />
      </mesh>

      {/* Ground concentric datum ring */}
      <mesh ref={ringRef} position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.24, 0.265, 36]} />
        <meshBasicMaterial
          color={statusColor}
          transparent
          opacity={isActive || hovered ? 0.95 : 0.45}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
