import { useRef, useEffect, useMemo } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { HYDERABAD_SECTORS, STORY_CHAPTERS } from '../../data/sectors'
import { InteractionMode } from '../../types'

interface CameraRigProps {
  interactionMode: InteractionMode
  scrollProgressRef: React.MutableRefObject<number>
  xrayRef: React.MutableRefObject<number>
  activeSectorId: string | null
  focusTrigger: number
  rainfall: number
  isHoldingCloudburst: boolean
}

export function CameraRig({
  interactionMode,
  scrollProgressRef,
  xrayRef,
  activeSectorId,
  focusTrigger,
  rainfall,
  isHoldingCloudburst,
}: CameraRigProps) {
  const { camera, pointer } = useThree()
  const controlsRef = useRef<OrbitControlsImpl>(null)

  const orbitTransitionRef = useRef(false)
  const orbitTargetPos = useRef(new THREE.Vector3(-1.5, 8.8, 15.6))
  const orbitTargetLook = useRef(new THREE.Vector3(0, 0.2, 0.4))

  // Smooth CatmullRom curves through all 5 chapters for continuous cinema-grade motion
  const { posCurve, lookCurve } = useMemo(() => {
    const posPoints = STORY_CHAPTERS.map((c) => new THREE.Vector3(...c.cameraPosition))
    const lookPoints = STORY_CHAPTERS.map((c) => new THREE.Vector3(...c.cameraTarget))
    return {
      posCurve: new THREE.CatmullRomCurve3(posPoints, false, 'centripetal', 0.45),
      lookCurve: new THREE.CatmullRomCurve3(lookPoints, false, 'centripetal', 0.45),
    }
  }, [])

  const desiredPos = useMemo(() => new THREE.Vector3(), [])
  const desiredLook = useMemo(() => new THREE.Vector3(), [])
  const currentLook = useRef(new THREE.Vector3(...STORY_CHAPTERS[0].cameraTarget))

  // Trigger smooth camera fly-to when user clicks a sector in Orbit Mode
  useEffect(() => {
    if (interactionMode !== 'orbit' || focusTrigger === 0 || !activeSectorId) return
    const sector = HYDERABAD_SECTORS.find((s) => s.id === activeSectorId)
    if (sector) {
      orbitTargetPos.current.set(...sector.cameraPosition)
      orbitTargetLook.current.set(...sector.cameraTarget)
      orbitTransitionRef.current = true
    }
  }, [activeSectorId, focusTrigger, interactionMode])

  // Sync OrbitControls target when entering orbit mode
  useEffect(() => {
    if (interactionMode === 'orbit' && controlsRef.current) {
      controlsRef.current.target.copy(currentLook.current)
      controlsRef.current.update()
      orbitTransitionRef.current = false
    }
  }, [interactionMode])

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05)

    // Smoothly compute X-ray factor based on scroll progress (peaks at Chapter 4: 0.75)
    if (interactionMode === 'story') {
      const p = THREE.MathUtils.clamp(scrollProgressRef.current, 0, 1)
      // Chapter 4 sits at progress ~0.75 (index 3 of 0..4)
      const distFromCh4 = Math.abs(p - 0.75)
      const targetXray = THREE.MathUtils.clamp(1.0 - distFromCh4 / 0.22, 0, 1)
      xrayRef.current = THREE.MathUtils.lerp(xrayRef.current, targetXray, dt * 4.5)

      posCurve.getPointAt(p, desiredPos)
      lookCurve.getPointAt(p, desiredLook)

      // Subtle architectural mouse parallax in story mode
      desiredPos.x += pointer.x * 0.42
      desiredPos.y += pointer.y * 0.22

      // Tactile micro-shake during active cloudburst hold or extreme surge
      if (isHoldingCloudburst || rainfall > 85) {
        const shakeAmp = isHoldingCloudburst ? 0.055 : ((rainfall - 85) / 35) * 0.03
        const t = state.clock.elapsedTime
        desiredPos.x += Math.sin(t * 37.0) * shakeAmp
        desiredPos.y += Math.cos(t * 43.0) * shakeAmp
      }

      const damp = 1 - Math.exp(-dt * 4.2)
      camera.position.lerp(desiredPos, damp)
      currentLook.current.lerp(desiredLook, damp)
      camera.lookAt(currentLook.current)
    } else {
      // Free Orbit mode: fade out X-ray so full terrain is crisp
      xrayRef.current = THREE.MathUtils.lerp(xrayRef.current, 0, dt * 4.0)

      if (orbitTransitionRef.current && controlsRef.current) {
        const damp = 1 - Math.exp(-dt * 4.5)
        camera.position.lerp(orbitTargetPos.current, damp)
        controlsRef.current.target.lerp(orbitTargetLook.current, damp)
        currentLook.current.copy(controlsRef.current.target)

        if (camera.position.distanceTo(orbitTargetPos.current) < 0.08) {
          orbitTransitionRef.current = false
        }
      }

      if (controlsRef.current) {
        if (isHoldingCloudburst) {
          const t = state.clock.elapsedTime
          camera.position.x += Math.sin(t * 38.0) * 0.015
          camera.position.y += Math.cos(t * 44.0) * 0.015
        }
        controlsRef.current.update()
        currentLook.current.copy(controlsRef.current.target)
      }
    }
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enabled={interactionMode === 'orbit'}
      enableDamping
      dampingFactor={0.06}
      maxPolarAngle={Math.PI / 2.08}
      minDistance={3.2}
      maxDistance={26.0}
      onStart={() => {
        orbitTransitionRef.current = false
      }}
    />
  )
}
