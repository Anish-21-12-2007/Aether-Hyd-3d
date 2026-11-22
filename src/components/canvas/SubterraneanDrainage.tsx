import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface SubterraneanDrainageProps {
  rainfall: number
  xrayRef: React.MutableRefObject<number>
}

// Custom animated subterranean stormwater flow shader
const TunnelVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const TunnelFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uRainfall;
  uniform float uXray;
  uniform vec3 uBaseColor;
  uniform vec3 uWarnColor;

  varying vec2 vUv;

  void main() {
    float storm = clamp(uRainfall / 120.0, 0.0, 1.0);
    float flowSpeed = 0.8 + storm * 2.4;

    // Directional flow pulses traveling downstream along tunnel UV.x
    float wave = sin(vUv.x * 28.0 - uTime * flowSpeed * 4.0) * 0.5 + 0.5;
    float streak = smoothstep(0.55, 0.98, wave);

    vec3 col = mix(uBaseColor, uWarnColor, smoothstep(0.32, 0.82, storm));
    col += col * streak * 0.9;

    // Brightest in Chapter 4 X-ray mode, subtly visible underneath otherwise
    float visibility = mix(0.22, 0.95, uXray);
    float alpha = visibility * (0.42 + streak * 0.58);

    gl_FragColor = vec4(col, alpha);
  }
`

interface TrafficVehicle {
  corridorIndex: number
  t: number
  speed: number
  laneOffset: number
  isEmergency: boolean
  isLowLying: boolean
}

export function SubterraneanDrainage({ rainfall, xrayRef }: SubterraneanDrainageProps) {
  const tunnelMatsRef = useRef<Array<THREE.ShaderMaterial | null>>([])
  const chokeRingsRef = useRef<Array<THREE.Mesh | null>>([])
  const trafficMeshRef = useRef<THREE.InstancedMesh>(null)

  // Subterranean stormwater tunnels running beneath the terrain
  const tunnels = useMemo(() => {
    const defs = [
      // 1. Musi River Deep Subterranean Collector Conduit
      {
        pts: [
          new THREE.Vector3(-9.5, -0.35, 5.2),
          new THREE.Vector3(-4.5, -0.42, 4.4),
          new THREE.Vector3(-0.2, -0.45, 3.6),
          new THREE.Vector3(2.8, -0.48, 3.0),
          new THREE.Vector3(6.8, -0.5, 2.0),
          new THREE.Vector3(10.5, -0.52, 0.9),
        ],
        radius: 0.085,
        base: '#14B8A6',
        warn: '#EF4444',
      },
      // 2. Kukatpally Nala Underground Interceptor -> Hussain Sagar
      {
        pts: [
          new THREE.Vector3(-6.2, -0.15, -4.4),
          new THREE.Vector3(-3.4, -0.25, -2.0),
          new THREE.Vector3(-1.0, -0.35, -0.5),
          new THREE.Vector3(0.45, -0.4, 0.6),
          new THREE.Vector3(1.9, -0.44, 1.9),
          new THREE.Vector3(2.8, -0.48, 3.0),
        ],
        radius: 0.065,
        base: '#0EA5E9',
        warn: '#F59E0B',
      },
      // 3. Durgam Cheruvu / Balkapur Nala Spillway Conduit
      {
        pts: [
          new THREE.Vector3(-4.2, -0.08, -2.7),
          new THREE.Vector3(-2.1, -0.38, 0.3),
          new THREE.Vector3(-0.6, -0.42, 1.8),
          new THREE.Vector3(1.5, -0.45, 2.7),
        ],
        radius: 0.055,
        base: '#0EA5E9',
        warn: '#F59E0B',
      },
    ]

    return defs.map((d) => {
      const curve = new THREE.CatmullRomCurve3(d.pts)
      return {
        geo: new THREE.TubeGeometry(curve, 72, d.radius, 10, false),
        uniforms: {
          uTime: { value: 0 },
          uRainfall: { value: 0 },
          uXray: { value: 0 },
          uBaseColor: { value: new THREE.Color(d.base) },
          uWarnColor: { value: new THREE.Color(d.warn) },
        },
      }
    })
  }, [])

  // Bottleneck choke points along underground conduits
  const chokepoints = useMemo(
    () => [
      { pos: [-1.0, -0.28, -0.5] as [number, number, number], label: 'BEGUMPET NALA' },
      { pos: [1.9, -0.36, 1.9] as [number, number, number], label: 'HUSSAIN SURPLUS' },
      { pos: [3.2, -0.38, 2.95] as [number, number, number], label: 'CHADERGHAT CHOKE' },
    ],
    []
  )

  // Elevated road corridors vs low-lying corridors for live traffic & flood rerouting
  const roadCurves = useMemo(() => {
    return [
      // 0: Elevated High-Ground ORR / Jubilee Ridge Flyover (always clear; receives rerouted traffic)
      {
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(-8.8, 0.95, -5.8),
          new THREE.Vector3(-4.6, 0.92, -3.4),
          new THREE.Vector3(-2.1, 0.48, 0.3), // Over Durgam Cable Bridge
          new THREE.Vector3(1.4, 0.65, -2.4),
          new THREE.Vector3(6.2, 0.62, -1.6),
          new THREE.Vector3(9.4, 0.55, 0.2),
        ]),
        isLowLying: false,
      },
      // 1: Elevated PVNR Expressway / High-Ground Evac Corridor
      {
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(-8.2, 0.58, 3.6),
          new THREE.Vector3(-3.8, 0.55, 2.6),
          new THREE.Vector3(0.4, 0.52, 1.8),
          new THREE.Vector3(4.5, 0.55, 1.2),
          new THREE.Vector3(8.8, 0.52, 2.8),
        ]),
        isLowLying: false,
      },
      // 2: Low-Lying Necklace Road / Musi Causeway (slows down & diverts when rainfall > 55)
      {
        curve: new THREE.CatmullRomCurve3([
          new THREE.Vector3(-3.5, 0.16, 1.6),
          new THREE.Vector3(-0.4, 0.12, 0.8),
          new THREE.Vector3(1.5, 0.1, 1.8),
          new THREE.Vector3(3.4, 0.1, 3.5),
          new THREE.Vector3(6.8, 0.1, 4.4),
        ]),
        isLowLying: true,
      },
    ]
  }, [])

  const VEHICLE_COUNT = 120
  const vehicles = useMemo<TrafficVehicle[]>(() => {
    const arr: TrafficVehicle[] = []
    for (let i = 0; i < VEHICLE_COUNT; i++) {
      const corridorIndex = i % 3
      arr.push({
        corridorIndex,
        t: (i / VEHICLE_COUNT + (i % 7) * 0.03) % 1,
        speed: 0.045 + ((i * 19) % 10) * 0.0055,
        laneOffset: (i % 2 === 0 ? 1 : -1) * 0.05,
        isEmergency: i % 9 === 0,
        isLowLying: corridorIndex === 2,
      })
    }
    return arr
  }, [])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const tempPos = useMemo(() => new THREE.Vector3(), [])
  const tempTangent = useMemo(() => new THREE.Vector3(), [])
  const tempUp = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const tempSide = useMemo(() => new THREE.Vector3(), [])
  const tempColor = useMemo(() => new THREE.Color(), [])

  // Subtle architectural elevated road spline lines (paired segments for lineSegments)
  const roadLineGeos = useMemo(() => {
    return roadCurves.map((r) => {
      const pts = r.curve.getPoints(80)
      const segPts: THREE.Vector3[] = []
      for (let i = 0; i < pts.length - 1; i++) {
        segPts.push(pts[i], pts[i + 1])
      }
      return new THREE.BufferGeometry().setFromPoints(segPts)
    })
  }, [roadCurves])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const storm = Math.min(Math.max(rainfall / 120, 0), 1)
    const xray = xrayRef.current

    // Update subterranean tunnel shaders
    tunnelMatsRef.current.forEach((mat) => {
      if (!mat) return
      mat.uniforms.uTime.value = t
      mat.uniforms.uRainfall.value = rainfall
      mat.uniforms.uXray.value = xray
    })

    // Pulse bottleneck choke rings
    chokeRingsRef.current.forEach((ring, idx) => {
      if (!ring) return
      const s = 0.8 + ((t * (1.2 + storm * 1.4) + idx * 0.35) % 1) * 1.3
      ring.scale.set(s, s, 1)
      const mat = ring.material as THREE.MeshBasicMaterial
      mat.opacity = (1 - (s - 0.8) / 1.3) * (0.25 + xray * 0.65 + storm * 0.3)
    })

    // Animate living traffic & emergency vehicle light-trails
    const mesh = trafficMeshRef.current
    if (mesh) {
      const flooded = storm > 0.45
      for (let i = 0; i < vehicles.length; i++) {
        const v = vehicles[i]
        // Reroute low-lying corridor vehicles onto elevated flyover when flooded
        const activeCurveIdx = flooded && v.isLowLying ? (i % 2) : v.corridorIndex
        const curve = roadCurves[activeCurveIdx].curve
        const speedFactor = flooded && v.isLowLying && !v.isEmergency ? 0.55 : v.isEmergency ? 1.45 : 1.0

        v.t = (v.t + delta * v.speed * speedFactor) % 1
        curve.getPointAt(v.t, tempPos)
        curve.getTangentAt(v.t, tempTangent).normalize()

        tempSide.crossVectors(tempTangent, tempUp).normalize()
        tempPos.addScaledVector(tempSide, v.laneOffset)

        dummy.position.copy(tempPos)
        dummy.lookAt(tempPos.clone().add(tempTangent))
        // Elongate streaks for crisp light-trail aesthetic
        dummy.scale.set(0.022, 0.016, v.isEmergency ? 0.24 : 0.16)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)

        if (v.isEmergency) {
          tempColor.set(Math.sin(t * 14 + i) > 0 ? '#F59E0B' : '#38BDF8')
        } else if (v.laneOffset > 0) {
          tempColor.set('#F2F4F7') // Headlights (bone-white)
        } else {
          tempColor.set('#EF4444') // Taillights (crimson)
        }
        mesh.setColorAt(i, tempColor)
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  })

  return (
    <group>
      {/* Subterranean Stormwater Tunnels */}
      {tunnels.map((tunnel, idx) => (
        <mesh key={idx} geometry={tunnel.geo}>
          <shaderMaterial
            ref={(el) => {
              tunnelMatsRef.current[idx] = el
            }}
            vertexShader={TunnelVertexShader}
            fragmentShader={TunnelFragmentShader}
            uniforms={tunnel.uniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}

      {/* Choke Point Volumetric Rings */}
      {chokepoints.map((cp, idx) => (
        <mesh
          key={cp.label}
          ref={(el) => {
            chokeRingsRef.current[idx] = el
          }}
          position={cp.pos}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.18, 0.23, 32]} />
          <meshBasicMaterial
            color={rainfall > 65 ? '#EF4444' : '#F59E0B'}
            transparent
            opacity={0.4}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Subtle Hairline Flyover & Arterial Road Guides */}
      {roadLineGeos.map((geo, idx) => (
        <lineSegments key={idx} geometry={geo}>
          <lineBasicMaterial
            color={idx === 2 && rainfall > 55 ? '#EF4444' : '#ffffff'}
            transparent
            opacity={idx === 2 && rainfall > 55 ? 0.35 : 0.1}
          />
        </lineSegments>
      ))}

      {/* GPU-Instanced Living Traffic & Emergency Rescue Light Trails */}
      <instancedMesh ref={trafficMeshRef} args={[undefined, undefined, VEHICLE_COUNT]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
