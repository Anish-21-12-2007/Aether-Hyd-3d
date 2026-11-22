import { useEffect, useState } from 'react'

interface BootPreloaderProps {
  onComplete: () => void
}

const CALIBRATION_STAGES = [
  'LOADING HYD-DEM TOPOGRAPHY',
  'MOUNTING HYDROLOGICAL SHADERS',
  'CALIBRATING MUSI BASIN CONDUITS',
  'READY // 17.3850° N  78.4867° E',
]

export function BootPreloader({ onComplete }: BootPreloaderProps) {
  const [progress, setProgress] = useState(0)
  const [stageIndex, setStageIndex] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const start = performance.now()
    const duration = 1100

    let frame = 0
    const tick = (now: number) => {
      const elapsed = now - start
      const pct = Math.min(100, Math.round((elapsed / duration) * 100))
      setProgress(pct)
      setStageIndex(
        Math.min(CALIBRATION_STAGES.length - 1, Math.floor((pct / 100) * CALIBRATION_STAGES.length))
      )

      if (pct < 100) {
        frame = requestAnimationFrame(tick)
      } else {
        window.setTimeout(() => {
          setFading(true)
          window.setTimeout(onComplete, 420)
        }, 120)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [onComplete])

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-between bg-[#040608] p-6 md:p-10 transition-opacity duration-500 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.24em] text-[#6E7781]">
        <span>AETHER-HYD // REV 4.0</span>
        <span>WGS84 // HYDERABAD</span>
      </div>

      <div className="max-w-lg w-full mx-auto space-y-6">
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-2xl md:text-4xl font-light tracking-[-0.03em] text-[#F2F4F7]">
            AETHER—HYD
          </h1>
          <span className="font-mono text-xs tracking-[0.2em] text-[#F2F4F7]">
            {String(progress).padStart(3, '0')}%
          </span>
        </div>

        {/* 1px architectural hairline progress bar */}
        <div className="w-full h-px bg-white/10 overflow-hidden">
          <div
            className="h-full bg-[#F2F4F7] transition-[width] duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.18em] text-[#6E7781]">
          <span>{CALIBRATION_STAGES[stageIndex]}</span>
          <span>60HZ</span>
        </div>
      </div>

      <div className="flex items-center justify-between font-mono text-[9px] tracking-[0.2em] text-[#6E7781]">
        <span>DECCAN WATERSHED TWIN</span>
        <span>TG-SDMA // GHMC</span>
      </div>
    </div>
  )
}
