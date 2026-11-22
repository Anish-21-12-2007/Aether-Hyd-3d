import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { soundEngine } from '../../utils/audio'

interface StormAtmosphereProps {
  rainfall: number
  lightningRef: React.MutableRefObject<number>
}

// Procedural volumetric drifting monsoon mist / storm cloud shader
const CloudVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const CloudFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uRainfall;
  uniform float uLightning;
  uniform float uLayerOffset;

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float storm = clamp(uRainfall / 120.0, 0.0, 1.0);
    vec2 drift = vec2(uTime * (0.015 + storm * 0.03), uTime * 0.008);
    float n = fbm(vUv * 4.5 + drift + uLayerOffset);

    // Radial vignette so cloud deck blends seamlessly into dark sky
    float dist = length(vUv - 0.5) * 2.0;
    float radial = 1.0 - smoothstep(0.35, 1.0, dist);

    float density = smoothstep(0.42 - storm * 0.16, 0.85, n) * radial;
    vec3 mistCol = mix(vec3(0.08, 0.12, 0.16), vec3(0.05, 0.07, 0.10), storm);
    // Volumetric internal illumination during lightning flash
    mistCol += vec3(0.55, 0.68, 0.85) * uLightning * smoothstep(0.35, 0.85, n);

    float alpha = density * (0.14 + storm * 0.34);
    gl_FragColor = vec4(mistCol, alpha);
  }
`

export function StormAtmosphere({ rainfall, lightningRef }: StormAtmosphereProps) {
  const rainLinesRef = useRef<THREE.LineSegments>(null)
  const lightningLightRef = useRef<THREE.DirectionalLight>(null)
  const cloudMat1Ref = useRef<THREE.ShaderMaterial>(null)
  const cloudMat2Ref = useRef<THREE.ShaderMaterial>(null)
  const nextStrikeTimeRef = useRef(2.5)

  const MAX_RAIN = 3600

  const [rainGeo, speeds] = useMemo(() => {
    const pos = new Float32Array(MAX_RAIN * 6)
    const spd = new Float32Array(MAX_RAIN)

    for (let i = 0; i < MAX_RAIN; i++) {
      const x = (Math.random() - 0.5) * 26
      const y = Math.random() * 11 + 0.5
      const z = (Math.random() - 0.5) * 26
      const len = 0.28 + Math.random() * 0.32
      const i6 = i * 6
      pos[i6] = x
      pos[i6 + 1] = y
      pos[i6 + 2] = z
      pos[i6 + 3] = x + 0.12
      pos[i6 + 4] = y - len
      pos[i6 + 5] = z + 0.05
      spd[i] = 9.0 + Math.random() * 7.0
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setDrawRange(0, 0)
    return [geo, spd]
  }, [])

  const cloudUniforms1 = useMemo(
    () => ({
      uTime: { value: 0 },
      uRainfall: { value: 0 },
      uLightning: { value: 0 },
      uLayerOffset: { value: 0.0 },
    }),
    []
  )

  const cloudUniforms2 = useMemo(
    () => ({
      uTime: { value: 0 },
      uRainfall: { value: 0 },
      uLightning: { value: 0 },
      uLayerOffset: { value: 13.7 },
    }),
    []
  )

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const storm = Math.min(Math.max(rainfall / 120, 0), 1)

    // Real-time lightning strike logic when rainfall > 70 mm/hr
    if (rainfall > 70) {
      if (t >= nextStrikeTimeRef.current) {
        lightningRef.current = 1.0
        nextStrikeTimeRef.current = t + 2.4 + Math.random() * (4.8 - storm * 2.2)
        soundEngine.playThunder(0.5 + storm * 0.5)
      }
    }

    // Exponential lightning decay with double-flicker feel
    if (lightningRef.current > 0.001) {
      lightningRef.current = Math.max(0, lightningRef.current - delta * 4.8)
    } else {
      lightningRef.current = 0
    }

    if (lightningLightRef.current) {
      lightningLightRef.current.intensity = lightningRef.current * 4.5
    }

    // Update volumetric cloud layers
    for (const mat of [cloudMat1Ref.current, cloudMat2Ref.current]) {
      if (!mat) continue
      mat.uniforms.uTime.value = t
      mat.uniforms.uRainfall.value = rainfall
      mat.uniforms.uLightning.value = lightningRef.current
    }

    // Update wind-angled rain streaks
    if (rainLinesRef.current) {
      const activeCount = rainfall <= 1 ? 0 : Math.floor(storm * MAX_RAIN)
      rainLinesRef.current.geometry.setDrawRange(0, activeCount * 2)

      if (activeCount > 0) {
        const attr = rainLinesRef.current.geometry.attributes.position as THREE.BufferAttribute
        const arr = attr.array as Float32Array
        const mult = 0.8 + storm * 1.6
        const windSlant = 0.08 + storm * 0.16

        for (let i = 0; i < activeCount; i++) {
          const i6 = i * 6
          const dy = speeds[i] * mult * delta
          arr[i6 + 1] -= dy
          arr[i6 + 4] -= dy
          arr[i6] += windSlant * dy * 0.12
          arr[i6 + 3] += windSlant * dy * 0.12

          if (arr[i6 + 4] < -0.5) {
            const x = (Math.random() - 0.5) * 26
            const y = 9.5 + Math.random() * 2.5
            const z = (Math.random() - 0.5) * 26
            const len = 0.3 + storm * 0.45
            arr[i6] = x
            arr[i6 + 1] = y
            arr[i6 + 2] = z
            arr[i6 + 3] = x + windSlant
            arr[i6 + 4] = y - len
            arr[i6 + 5] = z + windSlant * 0.4
          }
        }
        attr.needsUpdate = true
      }
    }
  })

  const rainOpacity = Math.min(0.55, 0.12 + (rainfall / 120) * 0.42)

  return (
    <group>
      {/* Dynamic lightning illumination burst */}
      <directionalLight
        ref={lightningLightRef}
        position={[-8, 18, -6]}
        intensity={0}
        color="#dbeafe"
      />

      {/* Overhead drifting volumetric monsoon mist / cloud deck */}
      <mesh position={[0, 6.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[42, 42]} />
        <shaderMaterial
          ref={cloudMat1Ref}
          vertexShader={CloudVertexShader}
          fragmentShader={CloudFragmentShader}
          uniforms={cloudUniforms1}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 7.6, 0]} rotation={[-Math.PI / 2, 0, 0.4]}>
        <planeGeometry args={[48, 48]} />
        <shaderMaterial
          ref={cloudMat2Ref}
          vertexShader={CloudVertexShader}
          fragmentShader={CloudFragmentShader}
          uniforms={cloudUniforms2}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Wind-angled GPU rain streaks */}
      <lineSegments ref={rainLinesRef} geometry={rainGeo} frustumCulled={false}>
        <lineBasicMaterial
          color="#cbd5e1"
          transparent
          opacity={rainOpacity}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  )
}
