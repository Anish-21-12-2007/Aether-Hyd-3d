import { Suspense, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { TerrainMesh } from './TerrainMesh'
import { FloodWaterShader } from './FloodWaterShader'
import { HyderabadLandmarks } from './HyderabadLandmarks'
import { SubterraneanDrainage } from './SubterraneanDrainage'
import { StormAtmosphere } from './StormAtmosphere'
import { CameraRig } from './CameraRig'
import { HoveredEntity, InteractionMode } from '../../types'

interface SceneCanvasProps {
  rainfall: number
  waterLevel: number
  activeSectorId: string | null
  onSelectSector: (id: string) => void
  onHoverEntity: (entity: HoveredEntity | null) => void
  hoveredEntity: HoveredEntity | null
  interactionMode: InteractionMode
  scrollProgressRef: React.MutableRefObject<number>
  focusTrigger: number
  isHoldingCloudburst: boolean
}

export function SceneCanvas({
  rainfall,
  waterLevel,
  activeSectorId,
  onSelectSector,
  onHoverEntity,
  hoveredEntity,
  interactionMode,
  scrollProgressRef,
  focusTrigger,
  isHoldingCloudburst,
}: SceneCanvasProps) {
  const xrayRef = useRef(0)
  const lightningRef = useRef(0)

  return (
    <div className="fixed inset-0 w-screen h-screen z-0 select-none bg-[#040608]">
      <Canvas
        dpr={[1, 2]}
        shadows
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
        }}
        camera={{
          position: [-1.5, 8.8, 15.6],
          fov: 40,
          near: 0.1,
          far: 120,
        }}
        className="w-full h-full"
      >
        <color attach="background" args={['#040608']} />
        <fog attach="fog" args={['#040608', 15, 42]} />

        {/* Architectural Moody Overcast Lighting (no neon cyan wash) */}
        <ambientLight intensity={0.38} color="#94a3b8" />

        {/* Cool Moonlit Key Light */}
        <directionalLight
          position={[14, 18, 10]}
          intensity={1.35}
          color="#e2e8f0"
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-near={1}
          shadow-camera-far={45}
          shadow-camera-left={-14}
          shadow-camera-right={14}
          shadow-camera-top={14}
          shadow-camera-bottom={-14}
          shadow-bias={-0.0002}
        />

        {/* Subtle Rim Light from West Plateau */}
        <directionalLight
          position={[-14, 8, -10]}
          intensity={0.48}
          color="#7dd3fc"
        />

        {/* Subtle Warm City Bounce from Old City / South */}
        <hemisphereLight args={['#334155', '#090d12', 0.45]} />

        <Suspense fallback={null}>
          <TerrainMesh rainfall={rainfall} xrayRef={xrayRef} />
          <FloodWaterShader
            waterLevel={waterLevel}
            rainfall={rainfall}
            lightningRef={lightningRef}
            xrayRef={xrayRef}
          />
          <HyderabadLandmarks
            activeSectorId={activeSectorId}
            onSelectSector={onSelectSector}
            onHoverEntity={onHoverEntity}
            hoveredEntity={hoveredEntity}
            rainfall={rainfall}
            waterLevel={waterLevel}
            xrayRef={xrayRef}
          />
          <SubterraneanDrainage rainfall={rainfall} xrayRef={xrayRef} />
          <StormAtmosphere rainfall={rainfall} lightningRef={lightningRef} />
          <CameraRig
            interactionMode={interactionMode}
            scrollProgressRef={scrollProgressRef}
            xrayRef={xrayRef}
            activeSectorId={activeSectorId}
            focusTrigger={focusTrigger}
            rainfall={rainfall}
            isHoldingCloudburst={isHoldingCloudburst}
          />

          {/* Subtle Editorial Post-Processing */}
          <EffectComposer multisampling={0}>
            <Bloom
              luminanceThreshold={0.82}
              luminanceSmoothing={0.6}
              intensity={0.45}
              mipmapBlur
            />
            <Vignette eskil={false} offset={0.22} darkness={0.78} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  )
}
