import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import {
  TERRAIN_DISPLACEMENT_BIAS,
  TERRAIN_DISPLACEMENT_SCALE,
  TERRAIN_SIZE,
} from '../../data/sectors'

interface FloodWaterShaderProps {
  waterLevel: number
  rainfall: number
  lightningRef: React.MutableRefObject<number>
  xrayRef: React.MutableRefObject<number>
}

const WaterShader = {
  uniforms: {
    uTime: { value: 0 },
    uRainfall: { value: 0 },
    uLightning: { value: 0 },
    uXray: { value: 0 },
    uDispScale: { value: TERRAIN_DISPLACEMENT_SCALE },
    uDispBias: { value: TERRAIN_DISPLACEMENT_BIAS },
    uDeepWater: { value: new THREE.Color('#041017') },
    uMidWater: { value: new THREE.Color('#0c3547') },
    uSkyReflect: { value: new THREE.Color('#3b556b') },
    uWarnAmber: { value: new THREE.Color('#f59e0b') },
    uCritCrimson: { value: new THREE.Color('#ef4444') },
    uFoamColor: { value: new THREE.Color('#d8e6ee') },
    uTerrainHeight: { value: null as THREE.Texture | null },
  },
  vertexShader: /* glsl */ `
    uniform float uTime;
    uniform float uRainfall;

    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vWaveNormal;

    // Multi-octave Gerstner-inspired directional wave height
    float waveHeight(vec2 p, float t, float storm) {
      float amp = 0.012 + storm * 0.042;
      float speed = 1.4 + storm * 2.2;
      float w1 = sin(dot(p, vec2(1.45, 0.85)) + t * speed) * 0.50;
      float w2 = sin(dot(p, vec2(-1.10, 1.65)) + t * speed * 1.25) * 0.30;
      float w3 = sin(dot(p, vec2(2.60, -2.10)) - t * speed * 1.65) * 0.14;
      float w4 = cos(dot(p, vec2(-3.80, -2.40)) + t * speed * 2.10) * 0.06;
      return (w1 + w2 + w3 + w4) * amp;
    }

    void main() {
      vUv = uv;
      float storm = clamp(uRainfall / 120.0, 0.0, 1.0);
      vec3 pos = position;

      float h = waveHeight(pos.xy, uTime, storm);
      float eps = 0.08;
      float hx = waveHeight(pos.xy + vec2(eps, 0.0), uTime, storm);
      float hy = waveHeight(pos.xy + vec2(0.0, eps), uTime, storm);

      pos.z += h;

      // Analytical tangent-space normal rotated to world space (plane is rotated -PI/2 on X)
      vec3 localNormal = normalize(vec3((h - hx) / eps, (h - hy) / eps, 1.0));
      vWaveNormal = normalize(mat3(modelMatrix) * localNormal);

      vec4 worldPos = modelMatrix * vec4(pos, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform float uRainfall;
    uniform float uLightning;
    uniform float uXray;
    uniform float uDispScale;
    uniform float uDispBias;
    uniform vec3 uDeepWater;
    uniform vec3 uMidWater;
    uniform vec3 uSkyReflect;
    uniform vec3 uWarnAmber;
    uniform vec3 uCritCrimson;
    uniform vec3 uFoamColor;
    uniform sampler2D uTerrainHeight;

    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vWaveNormal;

    // Lightweight procedural hash & FBM for organic foam & caustics
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 3; i++) {
        v += a * noise(p);
        p *= 2.04;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      float storm = clamp(uRainfall / 120.0, 0.0, 1.0);

      // Compute exact local depth relative to terrain heightmap
      float terrainH = texture2D(uTerrainHeight, vUv).r * uDispScale + uDispBias;
      float depth = vWorldPosition.y - terrainH;

      // Discard pixels cleanly where terrain rises above the water surface
      if (depth < -0.02) discard;

      vec3 N = normalize(vWaveNormal);
      vec3 V = normalize(cameraPosition - vWorldPosition);
      vec3 L = normalize(vec3(0.45, 0.82, 0.35));
      vec3 H = normalize(L + V);

      // View-dependent Schlick Fresnel reflection
      float ndotv = max(dot(N, V), 0.0);
      float fresnel = 0.04 + 0.96 * pow(1.0 - ndotv, 4.0);

      // Depth-based absorption: dark reflective monsoon water
      float depthFactor = clamp(depth * 2.2, 0.0, 1.0);
      vec3 baseWater = mix(uMidWater, uDeepWater, depthFactor);

      // Subtle caustic network beneath shallow-to-mid water
      vec2 cUv = vUv * 26.0 + vec2(uTime * 0.25, -uTime * 0.18);
      float c1 = fbm(cUv);
      float c2 = fbm(cUv * 1.4 - vec2(uTime * 0.32, uTime * 0.22));
      float caustic = smoothstep(0.58, 0.88, 1.0 - abs(c1 - c2) * 3.0);
      baseWater += vec3(0.06, 0.18, 0.24) * caustic * (1.0 - depthFactor * 0.55);

      // Specular glint from moonlight / storm sky + lightning flash
      float spec = pow(max(dot(N, H), 0.0), 96.0);
      vec3 skyCol = uSkyReflect * (0.45 + 0.35 * (1.0 - storm) + uLightning * 1.4);
      vec3 color = mix(baseWater, skyCol, clamp(fresnel * 0.72, 0.0, 0.85));
      color += vec3(0.75, 0.88, 0.96) * spec * (0.35 + uLightning * 0.9);

      // Hydrological hazard tint ONLY where inundation depth exceeds safe threshold during surge
      float surgeExcess = smoothstep(0.18, 0.65, depth) * smoothstep(0.28, 0.85, storm);
      float criticalExcess = smoothstep(0.32, 0.78, depth) * smoothstep(0.62, 0.95, storm);
      color = mix(color, mix(color, uWarnAmber, 0.28), surgeExcess);
      color = mix(color, mix(color, uCritCrimson, 0.36), criticalExcess);
      color += vec3(0.75, 0.88, 0.96) * spec * 0.28;

      // Dynamic shoreline foam where water meets terrain elevation
      float shoreBand = 1.0 - smoothstep(0.0, 0.095, abs(depth));
      float foamNoise = fbm(vUv * 64.0 + vec2(uTime * 0.45, uTime * 0.3));
      float foamMask = shoreBand * smoothstep(0.28, 0.72, foamNoise + 0.25);
      color = mix(color, uFoamColor, foamMask * 0.78);

      // Softly fade water plane at edges and in Chapter 4 X-ray mode
      float edgeFade = smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x) *
                       smoothstep(0.0, 0.04, vUv.y) * smoothstep(1.0, 0.96, vUv.y);
      float xrayFade = mix(1.0, 0.32, uXray);
      float alpha = clamp((0.76 + fresnel * 0.18 + foamMask * 0.2) * smoothstep(-0.02, 0.03, depth), 0.0, 0.94) * edgeFade * xrayFade;

      gl_FragColor = vec4(color, alpha);
    }
  `,
}

export function FloodWaterShader({
  waterLevel,
  rainfall,
  lightningRef,
  xrayRef,
}: FloodWaterShaderProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const currentYRef = useRef(waterLevel)
  const terrainHeightTexture = useTexture('/textures/hyd-heightmap.png')

  const uniforms = useMemo(() => {
    const cloned = THREE.UniformsUtils.clone(WaterShader.uniforms)
    cloned.uTerrainHeight.value = terrainHeightTexture
    return cloned
  }, [terrainHeightTexture])

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta
      materialRef.current.uniforms.uRainfall.value = THREE.MathUtils.lerp(
        materialRef.current.uniforms.uRainfall.value,
        rainfall,
        Math.min(1, delta * 5)
      )
      materialRef.current.uniforms.uLightning.value = lightningRef.current
      materialRef.current.uniforms.uXray.value = xrayRef.current
    }

    if (meshRef.current) {
      currentYRef.current = THREE.MathUtils.lerp(
        currentYRef.current,
        waterLevel,
        Math.min(1, delta * 4.5)
      )
      meshRef.current.position.y = currentYRef.current
    }
  })

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, waterLevel, 0]}>
      <planeGeometry args={[TERRAIN_SIZE, TERRAIN_SIZE, 144, 144]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={WaterShader.vertexShader}
        fragmentShader={WaterShader.fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}
