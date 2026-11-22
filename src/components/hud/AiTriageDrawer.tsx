import { useState, useRef, useEffect } from 'react'
import { SectorData, TelemetryState, TriageDispatch } from '../../types'
import { requestTacticalDispatch } from '../../utils/triageEngine'
import { soundEngine } from '../../utils/audio'
import { ArrowUpRight, X } from 'lucide-react'

interface AiTriageDrawerProps {
  isOpen: boolean
  onClose: () => void
  sector: SectorData
  telemetry: TelemetryState
}

export function AiTriageDrawer({
  isOpen,
  onClose,
  sector,
  telemetry,
}: AiTriageDrawerProps) {
  const [loading, setLoading] = useState(false)
  const [dispatch, setDispatch] = useState<TriageDispatch | null>(null)
  const [displayedSummary, setDisplayedSummary] = useState('')
  const [userQuery, setUserQuery] = useState('')
  const typeIntervalRef = useRef<number | null>(null)
  const streamedSummaryRef = useRef(false)

  useEffect(
    () => () => {
      if (typeIntervalRef.current !== null) window.clearInterval(typeIntervalRef.current)
    },
    []
  )

  const streamTypewriter = (text: string) => {
    setDisplayedSummary('')
    if (typeIntervalRef.current) window.clearInterval(typeIntervalRef.current)
    let i = 0
    typeIntervalRef.current = window.setInterval(() => {
      if (i < text.length) {
        setDisplayedSummary(text.slice(0, i + 1))
        i++
      } else if (typeIntervalRef.current) {
        window.clearInterval(typeIntervalRef.current)
      }
    }, 12)
  }

  const handleGenerateDispatch = async (customQ?: string) => {
    setLoading(true)
    setDisplayedSummary('')
    streamedSummaryRef.current = false
    soundEngine.playClick(980)
    try {
      const res = await requestTacticalDispatch(sector, telemetry, customQ, (summary) => {
        streamedSummaryRef.current = true
        setDisplayedSummary(summary)
      })
      setDispatch(res)
      if (!streamedSummaryRef.current) streamTypewriter(res.summary)
    } finally {
      setLoading(false)
    }
  }

  // Auto-generate dispatch when drawer opens or active sector changes while open
  useEffect(() => {
    if (isOpen) {
      handleGenerateDispatch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, sector.id])

  if (!isOpen) return null

  const gradeColor =
    dispatch?.riskGrade === 'DELTA'
      ? '#EF4444'
      : dispatch?.riskGrade === 'CHARLIE'
      ? '#F59E0B'
      : '#14B8A6'

  return (
    <aside
      data-testid="ai-triage-drawer"
      className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#040608]/96 backdrop-blur-2xl hairline-l flex flex-col text-[#F2F4F7] pointer-events-auto"
    >
      {/* Terminal Header */}
      <div className="px-6 py-4 hairline-b flex items-center justify-between">
        <div>
          <div className="font-mono text-[9px] tracking-[0.22em] text-[#6E7781]">
            TG-SDMA // WARD INTELLIGENCE TERMINAL
          </div>
          <div className="font-display text-sm font-medium tracking-tight text-[#F2F4F7] mt-0.5">
            {sector.name}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            soundEngine.playClick(740)
            onClose()
          }}
          aria-label="Close AI Dispatch Terminal"
          className="p-2 text-[#6E7781] hover:text-[#F2F4F7] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Live Telemetry Strip */}
      <div className="grid grid-cols-3 hairline-b font-mono text-[10px]">
        <div className="px-4 py-3 hairline-r">
          <span className="block text-[8px] tracking-[0.18em] text-[#6E7781]">PRECIP</span>
          <span className="text-[#F2F4F7]">{Math.round(telemetry.rainfall)} MM/HR</span>
        </div>
        <div className="px-4 py-3 hairline-r">
          <span className="block text-[8px] tracking-[0.18em] text-[#6E7781]">CONDUIT</span>
          <span className="text-[#F2F4F7]">{telemetry.drainageLoad}%</span>
        </div>
        <div className="px-4 py-3">
          <span className="block text-[8px] tracking-[0.18em] text-[#6E7781]">ELEVATION</span>
          <span className="text-[#F2F4F7]">{sector.elevation}M MSL</span>
        </div>
      </div>

      {/* Scrollable Intelligence Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        {/* Operator Query Input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && userQuery.trim()) {
                handleGenerateDispatch(userQuery.trim())
              }
            }}
            placeholder="Query routing or ward protocol..."
            className="flex-1 bg-transparent hairline px-3 py-2 font-mono text-[11px] text-[#F2F4F7] placeholder-[#6E7781] focus:outline-none focus:border-white/40"
          />
          <button
            type="button"
            onClick={() => handleGenerateDispatch(userQuery.trim() || undefined)}
            disabled={loading}
            className="px-3 py-2 bg-[#F2F4F7] text-[#040608] font-mono text-[10px] tracking-[0.16em] hover:bg-white transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
          >
            <span>{loading ? 'RUN' : 'EXEC'}</span>
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        {dispatch && (
          <div className="space-y-6">
            {/* Risk Grade Row */}
            <div className="flex items-center justify-between py-2.5 px-3 hairline">
              <div className="flex items-center gap-2.5">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: gradeColor }}
                />
                <span className="font-mono text-[10px] tracking-[0.2em]">
                  GRADE {dispatch.riskGrade}
                </span>
              </div>
              <span className="font-mono text-[9px] text-[#6E7781]">{dispatch.timestamp}</span>
            </div>

            {/* Situation Summary */}
            <section className="space-y-2">
              <div className="font-mono text-[9px] tracking-[0.2em] text-[#6E7781]">
                01 // SITUATION ASSESSMENT
              </div>
              <p
                aria-live="polite"
                className="font-mono text-[11px] leading-relaxed text-[#F2F4F7]/90 border-l border-white/20 pl-3"
              >
                {displayedSummary}
                {loading && <span className="animate-pulse">_</span>}
              </p>
            </section>

            {/* Pump Deployments */}
            <section className="space-y-2">
              <div className="font-mono text-[9px] tracking-[0.2em] text-[#6E7781]">
                02 // DEWATERING DEPLOYMENT
              </div>
              <div className="divide-y divide-white/10 hairline">
                {dispatch.pumpDeployments.map((p, idx) => (
                  <div key={idx} className="px-3 py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs text-[#F2F4F7]">{p.location}</div>
                      <div className="font-mono text-[9px] text-[#6E7781] mt-0.5">{p.units}</div>
                    </div>
                    <span
                      className="font-mono text-[9px] tracking-[0.14em]"
                      style={{
                        color:
                          p.status === 'OPERATIONAL'
                            ? '#14B8A6'
                            : p.status === 'EN_ROUTE'
                            ? '#F59E0B'
                            : '#6E7781',
                      }}
                    >
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Traffic Diversions */}
            <section className="space-y-2">
              <div className="font-mono text-[9px] tracking-[0.2em] text-[#6E7781]">
                03 // CORRIDOR DIVERSIONS
              </div>
              <div className="divide-y divide-white/10 hairline">
                {dispatch.trafficDiversions.map((t, idx) => (
                  <div key={idx} className="px-3 py-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#F2F4F7]">{t.corridor}</span>
                      <span
                        className="font-mono text-[9px] tracking-[0.14em]"
                        style={{
                          color:
                            t.status === 'CLOSED'
                              ? '#EF4444'
                              : t.status === 'RESTRICTED'
                              ? '#F59E0B'
                              : '#14B8A6',
                        }}
                      >
                        {t.status}
                      </span>
                    </div>
                    <div className="font-mono text-[9px] text-[#6E7781]">
                      ALT → {t.alternateRoute}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Substation Risks */}
            <section className="space-y-2">
              <div className="font-mono text-[9px] tracking-[0.2em] text-[#6E7781]">
                04 // SUBSTATION INTEGRITY
              </div>
              <div className="divide-y divide-white/10 hairline">
                {dispatch.substationRisks.map((sub, idx) => (
                  <div key={idx} className="px-3 py-2.5 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#F2F4F7]">{sub.location}</span>
                      <span
                        className="font-mono text-[9px] tracking-[0.14em]"
                        style={{
                          color:
                            sub.risk === 'CRITICAL' || sub.risk === 'HIGH'
                              ? '#EF4444'
                              : sub.risk === 'ELEVATED'
                              ? '#F59E0B'
                              : '#14B8A6',
                        }}
                      >
                        {sub.risk}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#6E7781]">{sub.action}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Citizen SMS Broadcast */}
            <section className="space-y-2">
              <div className="flex items-center justify-between font-mono text-[9px] tracking-[0.2em] text-[#6E7781]">
                <span>05 // CITIZEN BROADCAST</span>
                <span className="text-[#F2F4F7]">{dispatch.citizenSmsBroadcast.status}</span>
              </div>
              <div className="p-3 hairline font-mono text-[10px] leading-relaxed text-[#F2F4F7]/85">
                {dispatch.citizenSmsBroadcast.message}
              </div>
            </section>

            {/* Staging Outpost */}
            <div className="pt-2 font-mono text-[9px] tracking-[0.16em] text-[#6E7781]">
              STAGING: <span className="text-[#F2F4F7]">{dispatch.ndrfDeploymentZone}</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}
