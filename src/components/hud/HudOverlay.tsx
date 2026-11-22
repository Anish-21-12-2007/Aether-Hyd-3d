import { useState, useEffect } from 'react'
import { InteractionMode, SectorData, TelemetryState } from '../../types'
import { HYDERABAD_SECTORS, STORY_CHAPTERS } from '../../data/sectors'
import { CloudburstTrigger } from './CloudburstTrigger'
import { soundEngine } from '../../utils/audio'

interface HudOverlayProps {
  telemetry: TelemetryState
  activeSector: SectorData
  activeSectorId: string | null
  activeChapterIndex: number
  interactionMode: InteractionMode
  onSetInteractionMode: (mode: InteractionMode) => void
  onJumpToChapter: (index: number) => void
  onSelectSector: (id: string) => void
  onRainfallChange: (val: number) => void
  onReset: () => void
  onOpenTriage: () => void
  onHoldingCloudburstChange: (holding: boolean) => void
}

export function HudOverlay({
  telemetry,
  activeSectorId,
  activeChapterIndex,
  interactionMode,
  onSetInteractionMode,
  onJumpToChapter,
  onSelectSector,
  onRainfallChange,
  onReset,
  onOpenTriage,
  onHoldingCloudburstChange,
}: HudOverlayProps) {
  const [audioEnabled, setAudioEnabled] = useState(false)

  useEffect(() => {
    soundEngine.setRainfall(telemetry.rainfall)
  }, [telemetry.rainfall])

  const toggleAudio = () => {
    const next = !audioEnabled
    setAudioEnabled(next)
    soundEngine.setEnabled(next)
    if (next) soundEngine.playClick(960)
  }

  const rainRatio = telemetry.rainfall / 120
  const statusColor =
    rainRatio > 0.65 ? '#EF4444' : rainRatio > 0.32 ? '#F59E0B' : '#14B8A6'

  return (
    <div className="fixed inset-0 z-30 pointer-events-none select-none">
      {/* Subtle monochrome film grain overlay */}
      <div className="fixed inset-0 film-grain z-40" />

      {/* TOP PERIMETER TELEMETRY RAIL (48px slim hairline) */}
      <header className="fixed top-0 inset-x-0 h-12 px-4 md:px-7 flex items-center justify-between bg-[#040608]/65 backdrop-blur-md hairline-b pointer-events-auto">
        {/* Left: Wordmark + Live Datum */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: statusColor }}
            />
            <span className="font-display text-xs md:text-sm font-medium tracking-[0.14em] text-[#F2F4F7]">
              AETHER—HYD
            </span>
          </div>
          <span className="hidden lg:inline font-mono text-[9px] tracking-[0.2em] text-[#6E7781]">
            17.3850° N  78.4867° E
          </span>
        </div>

        {/* Center: [ STORY MODE / FREE ORBIT ] Toggle */}
        <div
          role="group"
          aria-label="Camera Interaction Mode"
          className="flex items-center hairline bg-[#040608]/70 p-0.5 font-mono text-[9px] tracking-[0.16em]"
        >
          <button
            type="button"
            data-testid="mode-story"
            onClick={() => {
              soundEngine.playClick(980)
              onSetInteractionMode('story')
            }}
            className={`px-2.5 py-1 transition-colors cursor-pointer ${
              interactionMode === 'story'
                ? 'bg-[#F2F4F7] text-[#040608]'
                : 'text-[#6E7781] hover:text-[#F2F4F7]'
            }`}
          >
            STORY MODE
          </button>
          <button
            type="button"
            data-testid="mode-orbit"
            onClick={() => {
              soundEngine.playClick(1060)
              onSetInteractionMode('orbit')
            }}
            className={`px-2.5 py-1 transition-colors cursor-pointer ${
              interactionMode === 'orbit'
                ? 'bg-[#F2F4F7] text-[#040608]'
                : 'text-[#6E7781] hover:text-[#F2F4F7]'
            }`}
          >
            FREE ORBIT
          </button>
        </div>

        {/* Right: Soundwave Visualizer + Rainfall Micro-Readout + AI Dispatch Trigger */}
        <div className="flex items-center gap-3 md:gap-4">
          {/* Live Rainfall Micro Readout */}
          <div className="hidden sm:flex items-center gap-2 font-mono text-[10px] tracking-[0.14em]">
            <span className="text-[#6E7781]">RAIN</span>
            <span style={{ color: rainRatio > 0.05 ? statusColor : '#F2F4F7' }}>
              {String(Math.round(telemetry.rainfall)).padStart(3, '0')} MM/HR
            </span>
          </div>

          <div className="hidden sm:block w-px h-3.5 bg-white/10" />

          {/* Minimal Soundwave Visualizer Audio Toggle (Muted by Default) */}
          <button
            type="button"
            onClick={toggleAudio}
            aria-label={audioEnabled ? 'Mute ambient audio' : 'Unmute ambient audio'}
            title={audioEnabled ? 'Mute audio' : 'Enable monsoon audio'}
            className="flex items-end gap-[2px] h-4 px-1.5 cursor-pointer group"
          >
            <span
              className={`w-[2px] bg-[#F2F4F7] transition-all ${
                audioEnabled ? 'h-3.5 animate-wave-1' : 'h-1 opacity-35 group-hover:opacity-70'
              }`}
            />
            <span
              className={`w-[2px] bg-[#F2F4F7] transition-all ${
                audioEnabled ? 'h-3.5 animate-wave-2' : 'h-1.5 opacity-35 group-hover:opacity-70'
              }`}
            />
            <span
              className={`w-[2px] bg-[#F2F4F7] transition-all ${
                audioEnabled ? 'h-3.5 animate-wave-3' : 'h-1 opacity-35 group-hover:opacity-70'
              }`}
            />
            <span
              className={`w-[2px] bg-[#F2F4F7] transition-all ${
                audioEnabled ? 'h-3.5 animate-wave-4' : 'h-1 opacity-35 group-hover:opacity-70'
              }`}
            />
          </button>

          {/* AI Tactical Dispatch Trigger */}
          <button
            type="button"
            data-testid="open-ai-dispatch"
            onClick={() => {
              soundEngine.playClick(1120)
              onOpenTriage()
            }}
            className="px-2.5 py-1 hairline font-mono text-[9px] tracking-[0.18em] text-[#F2F4F7] hover:bg-[#F2F4F7] hover:text-[#040608] transition-colors cursor-pointer"
          >
            AI DISPATCH
          </button>
        </div>
      </header>

      {/* LEFT PERIMETER CHAPTER RAIL (Story Mode Only) */}
      {interactionMode === 'story' && (
        <nav
          aria-label="Story Chapters"
          className="fixed left-4 md:left-7 top-1/2 -translate-y-1/2 hidden md:flex flex-col gap-3 pointer-events-auto"
        >
          {STORY_CHAPTERS.map((ch) => {
            const active = ch.index === activeChapterIndex
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => {
                  soundEngine.playClick(900)
                  onJumpToChapter(ch.index)
                }}
                className="group flex items-center gap-2.5 text-left cursor-pointer"
              >
                <span
                  className={`h-px transition-all duration-300 ${
                    active ? 'w-6 bg-[#F2F4F7]' : 'w-2.5 bg-white/25 group-hover:w-4 group-hover:bg-white/60'
                  }`}
                />
                <span
                  className={`font-mono text-[9px] tracking-[0.2em] transition-colors ${
                    active ? 'text-[#F2F4F7]' : 'text-[#6E7781] group-hover:text-[#F2F4F7]'
                  }`}
                >
                  {ch.numeral}
                </span>
              </button>
            )
          })}
        </nav>
      )}

      {/* FREE ORBIT PERIMETER CONTROLS (Zero center clutter) */}
      {interactionMode === 'orbit' && (
        <div className="fixed bottom-5 inset-x-4 md:inset-x-7 flex flex-col sm:flex-row items-end justify-between gap-4 pointer-events-none">
          {/* Bottom-Left: Minimal 4-Sector Focus Strip */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-1 bg-[#040608]/80 backdrop-blur-md hairline p-1">
            {HYDERABAD_SECTORS.map((sector) => {
              const active = sector.id === activeSectorId
              return (
                <button
                  key={sector.id}
                  type="button"
                  onClick={() => {
                    soundEngine.playSectorSwitch()
                    onSelectSector(sector.id)
                  }}
                  className={`px-3 py-1.5 font-mono text-[9px] tracking-[0.16em] transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#F2F4F7] text-[#040608]'
                      : 'text-[#6E7781] hover:text-[#F2F4F7]'
                  }`}
                >
                  {sector.shortName.toUpperCase()}
                </button>
              )
            })}
          </div>

          {/* Bottom-Right: Compact Cloudburst Orbital Dial */}
          <div className="pointer-events-auto flex items-end gap-4">
            <span className="hidden lg:inline font-mono text-[9px] tracking-[0.18em] text-[#6E7781] mb-2">
              DRAG TO ORBIT // SCROLL TO ZOOM // CLICK BEACONS
            </span>
            <CloudburstTrigger
              rainfall={telemetry.rainfall}
              onRainfallChange={onRainfallChange}
              onReset={onReset}
              onHoldingChange={onHoldingCloudburstChange}
              compact
            />
          </div>
        </div>
      )}
    </div>
  )
}
