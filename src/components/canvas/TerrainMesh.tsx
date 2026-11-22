import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import {
  TERRAIN_DISPLACEMENT_BIAS,
  TERRAIN_DISPLACEMENT_SCALE,
  TERRAIN_SIZE,
} from '../../data/sectors'

interface TerrainMeshProps {
  rainfall: number
  xrayRef: React.MutableRefObject<number>
}

export function TerrainMesh({ rainfall, xrayRef }: TerrainMeshProps) {
  const solidMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const wireMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const rainRef = useRef(rainfall)
  rainRef.current = rainfall

  const [heightTexture, albedoTexture] = useTexture([
    '/textures/hyd-heightmap.png',
    '/textures/cyber-grid-albedo.png',
  ])

  useMemo(() => {
    heightTexture.wrapS = heightTexture.wrapT = THREE.ClampToEdgeWrapping
    heightTexture.minFilter = THREE.LinearFilter
    heightTexture.magFilter = THREE.LinearFilter

    albedoTexture.wrapS = albedoTexture.wrapT = THREE.ClampToEdgeWrapping
    albedoTexture.minFilter = THREE.LinearMipmapLinearFilter
    albedoTexture.magFilter = THREE.LinearFilter
    albedoTexture.colorSpace = THREE.SRGBColorSpace
  }, [heightTexture, albedoTexture])

  const emissiveTarget = useMemo(() => new THREE.Color(), [])
  const wireTarget = useMemo(() => new THREE.Color(), [])

  // Subtle architectural perimeter ticks (no chunky glowing table boxes)
  const perimeterTicks = useMemo(() => {
    const pts: number[] = []
    const half = TERRAIN_SIZE / 2
    const step = 2.4
    for (let v = -half; v <= half + 0.01; v += step) {
      // North & South ticks
      pts.push(v, -0.42, -half, v, -0.42, -half - 0.35)
      pts.push(v, -0.42, half, v, -0.42, half + 0.35)
      // East & West ticks
      pts.push(-half, -0.42, v, -half - 0.35, -0.42, v)
      pts.push(half, -0.42, v, half + 0.35, -0.42, v)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    return geo
  }, [])

  useFrame((_, delta) => {
    const xray = xrayRef.current
    const rainRatio = Math.min(Math.max(rainRef.current / 120, 0), 1)

    if (solidMatRef.current) {
      // Smoothly cross-section terrain during Chapter 4 X-ray
      const targetOpacity = THREE.MathUtils.lerp(1.0, 0.16, xray)
      solidMatRef.current.opacity = THREE.MathUtils.lerp(
        solidMatRef.current.opacity,
        targetOpacity,
        Math.min(1, delta * 5)
      )
      solidMatRef.current.transparent = solidMatRef.current.opacity < 0.99
      solidMatRef.current.depthWrite = solidMatRef.current.opacity > 0.65

      // Subtle hydrological emissive tint (obsidian slate -> amber -> crimson)
      if (rainRatio > 0.68) {
        emissiveTarget.set('#4c1118')
      } else if (rainRatio > 0.35) {
        emissiveTarget.set('#3d2608')
      } else {
        emissiveTarget.set('#0a1b24')
      }
      solidMatRef.current.emissive.lerp(emissiveTarget, Math.min(1, delta * 4))
      solidMatRef.current.emissiveIntensity = 0.22 + rainRatio * 0.25
    }

    if (wireMatRef.current) {
      // Wireframe contour sharpens in X-ray mode
      const targetWireOpacity = THREE.MathUtils.lerp(0.045, 0.24, xray)
      wireMatRef.current.opacity = THREE.MathUtils.lerp(
        wireMatRef.current.opacity,
        targetWireOpacity,
        Math.min(1, delta * 5)
      )
      wireTarget.set(xray > 0.4 ? '#38bdf8' : '#64748b')
      wireMatRef.current.color.lerp(wireTarget, Math.min(1, delta * 4))
    }
  })

  return (
    <group>
      {/* Vast obsidian horizon floor so the terrain melts seamlessly into fog */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.52, 0]} receiveShadow>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color="#040608" roughness={0.92} metalness={0.15} />
      </mesh>

      {/* Primary Displaced Hyderabad Topographic Mesh */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow castShadow>
        <planeGeometry args={[TERRAIN_SIZE, TERRAIN_SIZE, 224, 224]} />
        <meshStandardMaterial
          ref={solidMatRef}
          color="#5b6672"
          map={albedoTexture}
          displacementMap={heightTexture}
          displacementScale={TERRAIN_DISPLACEMENT_SCALE}
          displacementBias={TERRAIN_DISPLACEMENT_BIAS}
          roughness={0.76}
          metalness={0.32}
          emissive="#0a1b24"
          emissiveMap={albedoTexture}
          emissiveIntensity={0.22}
          transparent={false}
          opacity={1}
        />
      </mesh>

      {/* Architectural Topographic Wireframe Contour (amplifies in Chapter 4 X-Ray) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <planeGeometry args={[TERRAIN_SIZE, TERRAIN_SIZE, 96, 96]} />
        <meshBasicMaterial
          ref={wireMatRef}
          wireframe
          color="#64748b"
          transparent
          opacity={0.045}
          depthWrite={false}
        />
      </mesh>

      {/* Hairline perimeter datum ticks */}
      <lineSegments geometry={perimeterTicks}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.12} />
      </lineSegments>
    </group>
  )
}
