import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { HYDERABAD_SECTORS, STORY_CHAPTERS } from '../../data/sectors'
import { SectorData, TelemetryState } from '../../types'
import { CloudburstTrigger } from '../hud/CloudburstTrigger'
import { soundEngine } from '../../utils/audio'
import { ArrowDown, ArrowUpRight } from 'lucide-react'

gsap.registerPlugin(ScrollTrigger)

interface StoryChaptersProps {
  telemetry: TelemetryState
  activeSector: SectorData
  activeSectorId: string | null
  onSelectSector: (id: string) => void
  onRainfallChange: (val: number) => void
  onReset: () => void
  onOpenTriage: () => void
  onHoldingCloudburstChange: (holding: boolean) => void
  onChapterEnter: (index: number) => void
  scrollProgressRef: React.MutableRefObject<number>
}

export function StoryChapters({
  telemetry,
  activeSectorId,
  onSelectSector,
  onRainfallChange,
  onReset,
  onOpenTriage,
  onHoldingCloudburstChange,
  onChapterEnter,
  scrollProgressRef,
}: StoryChaptersProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      // Master scroll progress tracker driving the 3D CameraRig spline (0 -> 1)
      ScrollTrigger.create({
        trigger: root,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: (self) => {
          scrollProgressRef.current = self.progress
        },
      })

      // Per-chapter activation & split-word kinetic typography reveal
      STORY_CHAPTERS.forEach((chapter) => {
        const el = root.querySelector<HTMLElement>(`#chapter-${chapter.id}`)
        if (!el) return

        ScrollTrigger.create({
          trigger: el,
          start: 'top 55%',
          end: 'bottom 45%',
          onEnter: () => onChapterEnter(chapter.index),
          onEnterBack: () => onChapterEnter(chapter.index),
        })

        const words = el.querySelectorAll('.kinetic-word')
        if (words.length > 0 && chapter.index > 0) {
          gsap.fromTo(
            words,
            { yPercent: 110, opacity: 0 },
            {
              yPercent: 0,
              opacity: 1,
              duration: 0.85,
              stagger: 0.055,
              ease: 'power3.out',
              scrollTrigger: {
                trigger: el,
                start: 'top 72%',
                toggleActions: 'play none none reverse',
              },
            }
          )
        }
      })
    }, root)

    return () => ctx.revert()
  }, [onChapterEnter, scrollProgressRef])

  const rainRatio = telemetry.rainfall / 120
  const hazardColor =
    rainRatio > 0.65 ? '#EF4444' : rainRatio > 0.32 ? '#F59E0B' : '#14B8A6'

  return (
    <main ref={containerRef} className="relative z-10 pointer-events-none">
      {STORY_CHAPTERS.map((chapter) => (
        <section
          key={chapter.id}
          id={`chapter-${chapter.id}`}
          data-chapter-index={chapter.index}
          className="relative min-h-screen w-full flex flex-col justify-end px-6 md:px-16 lg:px-24 pb-10 md:pb-14 pt-20"
        >
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-[#040608]/88 via-[#040608]/40 to-transparent" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8 w-full">
            {/* Lower-Left Editorial Typography Block (max 34rem so 90% of 3D stage stays open) */}
            <div className="max-w-lg space-y-4">
              {/* Chapter Kicker & Coordinates */}
              <div className="flex items-center gap-3 font-mono text-[10px] tracking-[0.22em] text-[#6E7781]">
                <span className="text-[#F2F4F7]">{chapter.numeral}</span>
                <span className="w-6 h-px bg-white/20" />
                <span>{chapter.kicker}</span>
              </div>

              {/* Oversized Tightly Tracked Display Headline with Split-Word Kinetic Mask */}
              <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-normal tracking-[-0.03em] leading-[1.02] text-[#F2F4F7]">
                {chapter.title.split(' ').map((word, wIdx) => (
                  <span key={wIdx} className="inline-block overflow-hidden mr-[0.26em] align-bottom">
                    <span className="kinetic-word inline-block">{word}</span>
                  </span>
                ))}
              </h2>

              {/* Concise Editorial Copy */}
              <p className="font-sans text-xs sm:text-sm font-light leading-relaxed text-[#F2F4F7]/70 max-w-md">
                {chapter.subtitle}
              </p>

              {/* Subtle 1px Hairline Micro-Telemetry Strip */}
              <div className="pt-3 hairline-t flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[9px] tracking-[0.18em] text-[#6E7781]">
                <span>{chapter.coordinates}</span>

                {chapter.index === 1 && (
                  <span className="text-[#F2F4F7]">
                    GRADIENT Δ 77M // CYBER TOWERS → DURGAM WEIR
                  </span>
                )}

                {chapter.index === 2 && (
                  <span style={{ color: hazardColor }}>
                    LAKE FTL {telemetry.lakeCapacityPct}% // {telemetry.inundationAreaSqKm} SQ KM
                  </span>
                )}

                {chapter.index === 3 && (
                  <span style={{ color: hazardColor }}>
                    CONDUIT {telemetry.drainageLoad}% // MUSI{' '}
                    {telemetry.musiDischargeCusecs.toLocaleString()} CUSECS
                  </span>
                )}

                {chapter.index === 4 && (
                  <span className="text-[#F2F4F7]">
                    EXPOSED POP {(telemetry.affectedPopulation / 1000).toFixed(1)}K
                  </span>
                )}
              </div>

              {/* Chapter 1 Scroll Cue */}
              {chapter.index === 0 && (
                <div className="pt-2 flex items-center gap-2 font-mono text-[9px] tracking-[0.24em] text-[#6E7781]">
                  <ArrowDown className="w-3 h-3 text-[#F2F4F7]/60" />
                  <span>SCROLL TO DESCEND INTO BASIN</span>
                </div>
              )}

              {/* Chapter 5 Interactive Ward Selector & AI Dispatch CTA */}
              {chapter.index === 4 && (
                <div className="pt-3 flex flex-wrap items-center gap-1.5 pointer-events-auto">
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
                        className={`px-3 py-1.5 font-mono text-[9px] tracking-[0.16em] hairline transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#F2F4F7] text-[#040608]'
                            : 'bg-[#040608]/75 text-[#6E7781] hover:text-[#F2F4F7]'
                        }`}
                      >
                        {sector.shortName.toUpperCase()}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playClick(1120)
                      onOpenTriage()
                    }}
                    className="px-3.5 py-1.5 bg-[#F2F4F7] text-[#040608] font-mono text-[9px] tracking-[0.18em] hover:bg-white transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <span>OPEN TRIAGE TERMINAL</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Chapter 3: Tactile Orbital Cloudburst Dial tucked cleanly at Bottom-Right */}
            {chapter.index === 2 && (
              <div className="self-start lg:self-end pointer-events-auto">
                <CloudburstTrigger
                  rainfall={telemetry.rainfall}
                  onRainfallChange={onRainfallChange}
                  onReset={onReset}
                  onHoldingChange={onHoldingCloudburstChange}
                />
              </div>
            )}

            {/* Chapter 4: Minimal Subterranean Conduit Status Legend at Bottom-Right */}
            {chapter.index === 3 && (
              <div className="hidden sm:flex flex-col items-end gap-1.5 font-mono text-[9px] tracking-[0.18em] text-[#6E7781] bg-[#040608]/65 backdrop-blur-md hairline px-4 py-3">
                <div className="text-[#F2F4F7]">X-RAY CONDUIT LAYER ACTIVE</div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-px bg-[#14B8A6]" />
                  <span>STORMWATER TUNNELS</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-px bg-[#F59E0B]" />
                  <span>
                    {telemetry.rainfall > 55
                      ? 'TRAFFIC REROUTED TO FLYOVERS'
                      : 'ARTERIAL FLOW NOMINAL'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>
      ))}
    </main>
  )
}
