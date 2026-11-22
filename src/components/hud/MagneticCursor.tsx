import { useEffect, useState, useRef } from 'react'

export function MagneticCursor() {
  const [isHovered, setIsHovered] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const dotRef = useRef<HTMLDivElement>(null)
  const reticleRef = useRef<HTMLDivElement>(null)

  const mousePos = useRef({ x: -100, y: -100 })
  const reticlePos = useRef({ x: -100, y: -100 })

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return

    const onMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY }
      setIsVisible(true)

      const target = e.target as HTMLElement | null
      const interactive = target?.closest('button, a, input, [role="button"], .cursor-pointer')
      setIsHovered(!!interactive)
    }

    const onMouseLeave = () => setIsVisible(false)

    window.addEventListener('mousemove', onMouseMove, { passive: true })
    document.addEventListener('mouseleave', onMouseLeave)

    let raf = 0
    const loop = () => {
      reticlePos.current.x += (mousePos.current.x - reticlePos.current.x) * 0.2
      reticlePos.current.y += (mousePos.current.y - reticlePos.current.y) * 0.2

      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${mousePos.current.x}px, ${mousePos.current.y}px, 0)`
      }
      if (reticleRef.current) {
        reticleRef.current.style.transform = `translate3d(${reticlePos.current.x}px, ${reticlePos.current.y}px, 0)`
      }

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseleave', onMouseLeave)
      cancelAnimationFrame(raf)
    }
  }, [])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden hidden md:block">
      {/* 2px center precision dot */}
      <div
        ref={dotRef}
        className="absolute top-0 left-0 -ml-[1.5px] -mt-[1.5px] w-[3px] h-[3px] bg-[#F2F4F7]"
      />

      {/* Minimal architectural crosshair reticle */}
      <div
        ref={reticleRef}
        className={`absolute top-0 left-0 transition-[width,height,margin,border-color] duration-200 border ${
          isHovered
            ? 'w-9 h-9 -ml-[18px] -mt-[18px] border-white/55'
            : 'w-6 h-6 -ml-3 -mt-3 border-white/25'
        } rounded-full`}
      >
        <div className="absolute -top-1.5 left-1/2 -ml-[0.5px] w-px h-1.5 bg-white/40" />
        <div className="absolute -bottom-1.5 left-1/2 -ml-[0.5px] w-px h-1.5 bg-white/40" />
        <div className="absolute -left-1.5 top-1/2 -mt-[0.5px] w-1.5 h-px bg-white/40" />
        <div className="absolute -right-1.5 top-1/2 -mt-[0.5px] w-1.5 h-px bg-white/40" />
      </div>
    </div>
  )
}
