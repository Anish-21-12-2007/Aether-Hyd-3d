import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { ReactLenis } from 'lenis/react'
import type { LenisRef } from 'lenis/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SceneCanvas } from './components/canvas/SceneCanvas'
import { HudOverlay } from './components/hud/HudOverlay'
import { AiTriageDrawer } from './components/hud/AiTriageDrawer'
import { BootPreloader } from './components/hud/BootPreloader'
import { MagneticCursor } from './components/hud/MagneticCursor'
import { StoryChapters } from './components/content/StoryChapters'
import { HYDERABAD_SECTORS, STORY_CHAPTERS } from './data/sectors'
import { HoveredEntity, InteractionMode } from './types'
import { computeHydrologicalState } from './utils/triageEngine'

gsap.registerPlugin(ScrollTrigger)

export function App() {
  const [bootCompleted, setBootCompleted] = useState(false)
  const [rainfall, setRainfall] = useState(14)
  const [activeSectorId, setActiveSectorId] = useState<string | null>('hussain-sagar')
  const [activeChapterIndex, setActiveChapterIndex] = useState(0)
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('story')
  const [triageOpen, setTriageOpen] = useState(false)
  const [hoveredEntity, setHoveredEntity] = useState<HoveredEntity | null>(null)
  const [isHoldingCloudburst, setIsHoldingCloudburst] = useState(false)
  const [focusTrigger, setFocusTrigger] = useState(0)

  const lenisRef = useRef<LenisRef>(null)
  const scrollProgressRef = useRef(0)

  // Synchronize Lenis smooth scrolling with GSAP ScrollTrigger
  useEffect(() => {
    const update = (time: number) => {
      lenisRef.current?.lenis?.raf(time * 1000)
    }
    gsap.ticker.add(update)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(update)
    }
  }, [])

  // Lock page scroll when in Free Orbit mode so wheel zooms the 3D OrbitControls cleanly
  useEffect(() => {
    const lenis = lenisRef.current?.lenis
    if (interactionMode === 'orbit') {
      lenis?.stop()
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      lenis?.start()
      window.setTimeout(() => ScrollTrigger.refresh(), 60)
    }
  }, [interactionMode])

  const currentSector = useMemo(() => {
    return (
      HYDERABAD_SECTORS.find((s) => s.id === activeSectorId) ||
      HYDERABAD_SECTORS[2]
    )
  }, [activeSectorId])

  const telemetry = useMemo(() => {
    return computeHydrologicalState(rainfall, currentSector, isHoldingCloudburst)
  }, [rainfall, currentSector, isHoldingCloudburst])

  const handleSelectSector = useCallback((id: string) => {
    setActiveSectorId(id)
    setFocusTrigger((n) => n + 1)
  }, [])

  const handleChapterEnter = useCallback((index: number) => {
    setActiveChapterIndex(index)
    const ch = STORY_CHAPTERS[index]
    if (ch) {
      setActiveSectorId(ch.sectorId)
    }
  }, [])

  const handleJumpToChapter = useCallback((index: number) => {
    const ch = STORY_CHAPTERS[index]
    if (!ch) return
    const target = `#chapter-${ch.id}`
    if (lenisRef.current?.lenis) {
      lenisRef.current.lenis.scrollTo(target, { duration: 1.3 })
    } else {
      document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  const handleReset = useCallback(() => {
    setRainfall(0)
  }, [])

  return (
    <ReactLenis root options={{ autoRaf: false, lerp: 0.085, smoothWheel: true }} ref={lenisRef}>
      <div className="relative min-h-screen bg-[#040608] text-[#F2F4F7] font-sans">
        {/* Minimal Architectural Crosshair Reticle */}
        <MagneticCursor />

        {/* 1.1s Obsidian Calibration Preloader */}
        {!bootCompleted && <BootPreloader onComplete={() => setBootCompleted(true)} />}

        {/* FULL-BLEED 100vw x 100vh FIXED 3D WEBGL STAGE */}
        <SceneCanvas
          rainfall={telemetry.rainfall}
          waterLevel={telemetry.waterLevel}
          activeSectorId={activeSectorId}
          onSelectSector={handleSelectSector}
          onHoverEntity={setHoveredEntity}
          hoveredEntity={hoveredEntity}
          interactionMode={interactionMode}
          scrollProgressRef={scrollProgressRef}
          focusTrigger={focusTrigger}
          isHoldingCloudburst={isHoldingCloudburst}
        />

        {/* PERIMETER VIEWFINDER TELEMETRY RAIL */}
        <HudOverlay
          telemetry={telemetry}
          activeSector={currentSector}
          activeSectorId={activeSectorId}
          activeChapterIndex={activeChapterIndex}
          interactionMode={interactionMode}
          onSetInteractionMode={setInteractionMode}
          onJumpToChapter={handleJumpToChapter}
          onSelectSector={handleSelectSector}
          onRainfallChange={setRainfall}
          onReset={handleReset}
          onOpenTriage={() => setTriageOpen(true)}
          onHoldingCloudburstChange={setIsHoldingCloudburst}
        />

        {/* 5-CHAPTER SCROLL-CHOREOGRAPHED EDITORIAL STORY (Hidden in Free Orbit) */}
        {interactionMode === 'story' && (
          <StoryChapters
            telemetry={telemetry}
            activeSector={currentSector}
            activeSectorId={activeSectorId}
            onSelectSector={handleSelectSector}
            onRainfallChange={setRainfall}
            onReset={handleReset}
            onOpenTriage={() => setTriageOpen(true)}
            onHoldingCloudburstChange={setIsHoldingCloudburst}
            onChapterEnter={handleChapterEnter}
            scrollProgressRef={scrollProgressRef}
          />
        )}

        {/* SLIDE-OVER MONOCHROME AI WARD TRIAGE TERMINAL */}
        <AiTriageDrawer
          isOpen={triageOpen}
          onClose={() => setTriageOpen(false)}
          sector={currentSector}
          telemetry={telemetry}
        />
      </div>
    </ReactLenis>
  )
}

export default App
