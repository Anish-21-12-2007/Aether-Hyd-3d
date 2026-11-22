import { useEffect, useRef, useState, useCallback } from 'react'
import { soundEngine } from '../../utils/audio'

interface CloudburstTriggerProps {
  rainfall: number
  onRainfallChange: (val: number) => void
  onReset: () => void
  onHoldingChange: (holding: boolean) => void
  compact?: boolean
}

const PRESET_TICKS = [
  { label: '00', value: 0 },
  { label: '65', value: 65 },
  { label: '115', value: 115 },
] as const

export function CloudburstTrigger({
  rainfall,
  onRainfallChange,
  onReset,
  onHoldingChange,
  compact = false,
}: CloudburstTriggerProps) {
  const [isHolding, setIsHolding] = useState(false)
  const animFrameRef = useRef<number | null>(null)
  const holdingRef = useRef(false)
  const rainfallRef = useRef(rainfall)
  rainfallRef.current = rainfall

  const startHold = useCallback(() => {
    if (holdingRef.current) return
    holdingRef.current = true
    setIsHolding(true)
    onHoldingChange(true)
    soundEngine.playClick(760)
    let previousTime = performance.now()

    const ramp = () => {
      if (!holdingRef.current) return
      const now = performance.now()
      const dt = Math.min((now - previousTime) / 1000, 0.1)
      previousTime = now
      const next = Math.min(120, rainfallRef.current + dt * 32)
      rainfallRef.current = next
      onRainfallChange(Number(next.toFixed(1)))
      soundEngine.startReactorHum(next / 120)
      animFrameRef.current = requestAnimationFrame(ramp)
    }

    animFrameRef.current = requestAnimationFrame(ramp)
  }, [onRainfallChange, onHoldingChange])

  const stopHold = useCallback(() => {
    if (!holdingRef.current) return
    holdingRef.current = false
    setIsHolding(false)
    onHoldingChange(false)
    soundEngine.stopReactorHum()
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
  }, [onHoldingChange])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
        e.preventDefault()
        startHold()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const target = e.target as HTMLElement
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
        e.preventDefault()
        stopHold()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      stopHold()
    }
  }, [startHold, stopHold])

  const ratio = Math.min(Math.max(rainfall / 120, 0), 1)
  const accentColor = ratio > 0.65 ? '#EF4444' : ratio > 0.32 ? '#F59E0B' : '#14B8A6'

  const size = compact ? 88 : 136
  const radius = compact ? 38 : 60
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - ratio * circumference

  return (
    <div className="flex flex-col items-center gap-3 select-none pointer-events-auto">
      {/* Tactile Monochrome Orbital Dial */}
      <button
        type="button"
        data-testid="cloudburst-dial"
        onMouseDown={startHold}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        onTouchStart={startHold}
        onTouchEnd={stopHold}
        style={{ width: size, height: size }}
        className={`relative rounded-full bg-[#040608]/85 backdrop-blur-md border transition-transform duration-150 flex flex-col items-center justify-center cursor-pointer ${
          isHolding ? 'scale-[0.97] border-white/40' : 'border-white/15 hover:border-white/30'
        }`}
      >
        <svg
          width={size}
          height={size}
          className="absolute inset-0 -rotate-90 pointer-events-none"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="1.5"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={accentColor}
            strokeWidth="2"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="butt"
          />
        </svg>

        <div className="relative z-10 flex flex-col items-center text-center px-2 pointer-events-none">
          <span
            className="font-mono text-base md:text-lg font-medium tracking-tight leading-none"
            style={{ color: ratio > 0.05 ? accentColor : '#F2F4F7' }}
          >
            {Math.round(rainfall)}
          </span>
          <span className="font-mono text-[8px] tracking-[0.2em] text-[#6E7781] mt-1">
            MM/HR
          </span>
          {!compact && (
            <span className="font-mono text-[8px] tracking-[0.16em] text-[#F2F4F7]/85 mt-2 uppercase">
              {isHolding ? 'SURGING' : 'HOLD // SPACE'}
            </span>
          )}
        </div>
      </button>

      {/* Hairline preset ticks & Drain reset */}
      <div className="flex items-center gap-1 bg-[#040608]/80 backdrop-blur-md border border-white/10 px-1.5 py-1">
        {PRESET_TICKS.map((tick) => {
          const active = Math.abs(rainfall - tick.value) < 3
          return (
            <button
              key={tick.label}
              type="button"
              onClick={() => {
                soundEngine.playClick(950)
                onRainfallChange(tick.value)
              }}
              className={`px-2 py-0.5 font-mono text-[9px] tracking-[0.16em] transition-colors cursor-pointer ${
                active
                  ? 'bg-[#F2F4F7] text-[#040608]'
                  : 'text-[#6E7781] hover:text-[#F2F4F7]'
              }`}
            >
              {tick.label}
            </button>
          )
        })}
        <div className="w-px h-3 bg-white/10 mx-0.5" />
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick(640)
            onReset()
          }}
          className="px-2 py-0.5 font-mono text-[9px] tracking-[0.16em] text-[#6E7781] hover:text-[#F2F4F7] transition-colors cursor-pointer"
        >
          DRAIN
        </button>
      </div>
    </div>
  )
}
