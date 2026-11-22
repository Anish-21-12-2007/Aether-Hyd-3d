export type InteractionMode = 'story' | 'orbit'

export type RiskLevel = 'SAFE' | 'ADVISORY' | 'WARNING' | 'CRITICAL'

export interface SectorData {
  id: string
  name: string
  shortName: string
  code: string
  lat: number
  lng: number
  elevation: number // meters above sea level
  groundY: number // world Y aligned to hyd-heightmap.png
  baselineRisk: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'
  vulnerabilityType: string
  populationDensity: number // per sq km
  criticalAssets: string[]
  evacuationRoutes: string[]
  dewateringCapacity: string
  pumpStatus: string
  cameraPosition: [number, number, number]
  cameraTarget: [number, number, number]
  beaconPosition: [number, number, number]
}

export interface ChapterData {
  index: number
  id: string
  numeral: string
  kicker: string
  title: string
  subtitle: string
  coordinates: string
  sectorId: string
  cameraPosition: [number, number, number]
  cameraTarget: [number, number, number]
  xrayTarget: number
}

export interface HoveredEntity {
  id: string
  name: string
  category: 'LANDMARK' | 'SECTOR' | 'CHOKEPOINT'
  elevation: number
  waterDepthCm: number
  status: string
  worldPosition: [number, number, number]
}

export interface TelemetryState {
  rainfall: number // mm/hr (0 to 120)
  waterLevel: number // world Y water plane height
  drainageLoad: number // 0 to 100%
  inundationAreaSqKm: number
  affectedPopulation: number
  activeSectorId: string
  isSimulating: boolean
  drainActive: boolean
  lakeCapacityPct: number
  musiDischargeCusecs: number
}

export interface TriageDispatch {
  timestamp: string
  sectorName: string
  riskGrade: 'ALPHA' | 'BRAVO' | 'CHARLIE' | 'DELTA'
  summary: string
  pumpDeployments: Array<{
    location: string
    units: string
    status: 'EN_ROUTE' | 'OPERATIONAL' | 'STANDBY'
  }>
  trafficDiversions: Array<{
    corridor: string
    status: 'CLOSED' | 'RESTRICTED' | 'CLEAR'
    alternateRoute: string
  }>
  citizenAlerts: string[]
  substationRisks: Array<{
    location: string
    risk: 'LOW' | 'ELEVATED' | 'HIGH' | 'CRITICAL'
    action: string
  }>
  citizenSmsBroadcast: {
    message: string
    status: 'READY' | 'QUEUED' | 'SENT'
  }
  ndrfDeploymentZone: string
}
