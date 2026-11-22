import { SectorData, TelemetryState, TriageDispatch } from '../types'
import { GoogleGenAI } from '@google/genai'

/**
 * Hydrological model computing dynamic floodwater height, discharge rate, and impacted population.
 * Water level calibrated to the 2.4-scale hyd-heightmap.png terrain mesh (-0.18 baseline -> +0.58 peak surge).
 */
export function computeHydrologicalState(
  rainfall: number, // mm/hr (0 to 120)
  sector: SectorData,
  isSimulating: boolean = false,
  drainActive: boolean = false
): TelemetryState {
  const rainRatio = Math.min(Math.max(rainfall / 120, 0), 1)
  const elevationFactor = Math.max(0.5, (600 - sector.elevation) / 110)

  const waterLevel =
    -0.18 + rainRatio * 0.72 * (drainActive ? 0.2 : 1) * (0.92 + elevationFactor * 0.08)

  const drainageLoad = Math.min(100, Math.round(15 + Math.pow(rainRatio, 1.25) * 84))
  const inundationAreaSqKm = Number((1.2 + Math.pow(rainRatio, 1.6) * 44.8).toFixed(1))
  const affectedPopulation = Math.round(
    rainRatio * sector.populationDensity * 0.85 + rainRatio * rainRatio * 42000
  )
  const lakeCapacityPct = Math.min(100, Math.round(48 + rainRatio * 51))
  const musiDischargeCusecs = Math.round(1200 + Math.pow(rainRatio, 2.1) * 44800)

  return {
    rainfall,
    waterLevel,
    drainageLoad,
    inundationAreaSqKm,
    affectedPopulation,
    activeSectorId: sector.id,
    isSimulating,
    drainActive,
    lakeCapacityPct,
    musiDischargeCusecs,
  }
}

/**
 * Deterministic Hyderabad hydrological fallback for offline/no-API-key judging
 */
export function generateDeterministicDispatch(
  sector: SectorData,
  telemetry: TelemetryState,
  customQuery?: string
): TriageDispatch {
  const rain = telemetry.rainfall
  let riskGrade: 'ALPHA' | 'BRAVO' | 'CHARLIE' | 'DELTA' = 'ALPHA'

  if (rain > 90) riskGrade = 'DELTA'
  else if (rain > 60) riskGrade = 'CHARLIE'
  else if (rain > 25) riskGrade = 'BRAVO'

  const now = new Date()
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now
    .getMinutes()
    .toString()
    .padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} IST`

  let summary = ''
  let alerts: string[] = []

  if (riskGrade === 'DELTA') {
    summary = `CRITICAL CLOUDBURST: ${rain} mm/hr recorded over ${sector.name}. Storm conduits at ${telemetry.drainageLoad}% saturation. Immediate low-lying evacuation ordered for ${sector.vulnerabilityType}.`
    alerts = [
      `RED ADVISORY: Flash inundation across ${sector.name} transit corridors. Non-emergency traffic restricted to elevated flyovers.`,
      `Sluice discharge at overflow threshold. Evacuate low-lying basements and river causeways immediately.`,
      `TG-SDMA tactical command transitioned to full dewatering and rescue staging.`,
    ]
  } else if (riskGrade === 'CHARLIE') {
    summary = `HIGH SURGE: Sustained ${rain} mm/hr rainfall across ${sector.name}. Drainage saturation at ${telemetry.drainageLoad}%; feeder nalas approaching bankfull threshold.`
    alerts = [
      `AMBER ADVISORY: Standing water accumulating in underpasses and low-lying arterial links.`,
      `Mobile siphon rigs staged at primary chokepoints; elevated bypasses remain open.`,
    ]
  } else if (riskGrade === 'BRAVO') {
    summary = `ELEVATED MONITORING: ${rain} mm/hr across ${sector.name}. Storm drainage holding steady at ${telemetry.drainageLoad}% with localized sheet runoff.`
    alerts = [
      `ADVISORY: Reduced speeds on connecting flyovers; sluice gates pre-calibrated for catchment release.`,
    ]
  } else {
    summary = `NOMINAL BASELINE: ${sector.name} operating within safe hydrological margins (${rain} mm/hr, ${telemetry.drainageLoad}% base conduit load).`
    alerts = [
      `NOMINAL: All municipal drainage channels unobstructed and sensor telemetry online.`,
    ]
  }

  const pumpUnits =
    riskGrade === 'DELTA'
      ? '4x 500HP Submersible'
      : riskGrade === 'CHARLIE'
      ? '2x 300HP Diesel Siphon'
      : '1x 150HP Mobile Unit'
  const pumpStatus = riskGrade === 'DELTA' || riskGrade === 'CHARLIE' ? 'OPERATIONAL' : 'STANDBY'

  const query = customQuery?.trim()
  const routeRequest = query?.match(/from\s+(.+?)\s+to\s+(.+?)(?:[?.!,;]|$)/i)
  const requestedRoute = routeRequest
    ? `${routeRequest[1].trim()} → ${routeRequest[2].trim()}`
    : undefined

  if (query) {
    summary = requestedRoute
      ? `ROUTING ASSESSMENT (${requestedRoute}): ${summary}`
      : `OPERATOR QUERY "${query}": ${summary}`
  }

  const substationRisk =
    riskGrade === 'DELTA'
      ? 'CRITICAL'
      : riskGrade === 'CHARLIE'
      ? 'HIGH'
      : riskGrade === 'BRAVO'
      ? 'ELEVATED'
      : 'LOW'

  const substationAction =
    riskGrade === 'DELTA'
      ? 'Isolate low-elevation feeder at first safe opportunity after verifying redundancy.'
      : riskGrade === 'CHARLIE'
      ? 'Stage field crew on standby and inspect perimeter sumps.'
      : 'Continue remote telemetry monitoring; no isolation required.'

  return {
    timestamp: timeStr,
    sectorName: sector.name,
    riskGrade,
    summary,
    pumpDeployments: [
      {
        location: sector.criticalAssets[0] || 'Central Sump Station',
        units: pumpUnits,
        status: pumpStatus,
      },
      {
        location: sector.criticalAssets[1] || 'Secondary Weir Node',
        units: riskGrade === 'DELTA' ? '6x Mobile Trailer Siphons' : '2x Standby Rigs',
        status: riskGrade === 'DELTA' ? 'EN_ROUTE' : 'STANDBY',
      },
    ],
    trafficDiversions: [
      {
        corridor: sector.criticalAssets[2] || 'Low-Lying Underpass',
        status:
          riskGrade === 'DELTA' ? 'CLOSED' : riskGrade === 'CHARLIE' ? 'RESTRICTED' : 'CLEAR',
        alternateRoute: requestedRoute || sector.evacuationRoutes[0] || 'Elevated Outer Bypass',
      },
      {
        corridor: sector.vulnerabilityType.includes('river')
          ? 'Causeway Crossing'
          : 'Basement Ring Road',
        status: riskGrade === 'DELTA' || riskGrade === 'CHARLIE' ? 'RESTRICTED' : 'CLEAR',
        alternateRoute: requestedRoute || sector.evacuationRoutes[1] || 'Main Ridge Route',
      },
    ],
    citizenAlerts: requestedRoute
      ? [`ROUTE ADVISORY: ${requestedRoute} — verify live road barriers before dispatch.`, ...alerts]
      : alerts,
    substationRisks: [
      {
        location:
          sector.criticalAssets.find((asset) => /substation|power|feeder/i.test(asset)) ||
          `${sector.name} Distribution Substation`,
        risk: substationRisk,
        action: substationAction,
      },
    ],
    citizenSmsBroadcast: {
      message:
        riskGrade === 'DELTA'
          ? `${sector.name}: Severe flood alert. Move to higher ground; avoid underpasses and causeways. Emergency: 112.`
          : riskGrade === 'CHARLIE'
          ? `${sector.name}: Heavy rain advisory. Use elevated corridors and follow GHMC diversions.`
          : `${sector.name}: Hydrological monitoring active. Avoid standing water in low-lying underpasses.`,
      status: riskGrade === 'DELTA' ? 'QUEUED' : 'READY',
    },
    ndrfDeploymentZone: `${sector.name} Rapid Response Outpost (${sector.code.split('//')[0].trim()})`,
  }
}

/**
 * Generate tactical dispatch using Gemini API if key is present, otherwise deterministic fallback
 */
export async function requestTacticalDispatch(
  sector: SectorData,
  telemetry: TelemetryState,
  customQuery?: string,
  onSummary?: (summary: string) => void
): Promise<TriageDispatch> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY

  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY' || apiKey.trim() === '') {
    return generateDeterministicDispatch(sector, telemetry, customQuery)
  }

  try {
    const ai = new GoogleGenAI({ apiKey })
    const prompt = `You are AETHER-HYD, the Tactical AI Hydrological Commander for Hyderabad, India (GHMC / TG-SDMA).
Sector: ${sector.name} (${sector.code}), Elevation: ${sector.elevation}m MSL, Vulnerability: ${sector.vulnerabilityType}
Rainfall: ${telemetry.rainfall} mm/hr, Drainage Load: ${telemetry.drainageLoad}%, Musi Discharge: ${telemetry.musiDischargeCusecs} cusecs, Hussain Sagar: ${telemetry.lakeCapacityPct}% FTL
${customQuery ? `Operator Query: "${customQuery}"` : ''}
Respond ONLY with valid JSON matching:
{"riskGrade":"ALPHA"|"BRAVO"|"CHARLIE"|"DELTA","summary":"string","pumpDeployments":[{"location":"string","units":"string","status":"EN_ROUTE"|"OPERATIONAL"|"STANDBY"}],"trafficDiversions":[{"corridor":"string","status":"CLOSED"|"RESTRICTED"|"CLEAR","alternateRoute":"string"}],"citizenAlerts":["string"],"substationRisks":[{"location":"string","risk":"LOW"|"ELEVATED"|"HIGH"|"CRITICAL","action":"string"}],"citizenSmsBroadcast":{"message":"string","status":"READY"|"QUEUED"|"SENT"},"ndrfDeploymentZone":"string"}`

    let responseText = ''
    const stream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: prompt,
    })
    for await (const chunk of stream) {
      responseText += chunk.text || ''
      const partialSummary = responseText.match(/"summary"\s*:\s*"((?:\\.|[^"\\])*)/)
      if (partialSummary) {
        try {
          onSummary?.(JSON.parse(`"${partialSummary[1]}"`))
        } catch {
          // Wait for complete escape sequence
        }
      }
    }

    const cleaned = responseText.replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    const fallback = generateDeterministicDispatch(sector, telemetry, customQuery)

    const dispatch: TriageDispatch = {
      timestamp: fallback.timestamp,
      sectorName: sector.name,
      riskGrade: parsed.riskGrade || fallback.riskGrade,
      summary: parsed.summary || fallback.summary,
      pumpDeployments: parsed.pumpDeployments || fallback.pumpDeployments,
      trafficDiversions: parsed.trafficDiversions || fallback.trafficDiversions,
      citizenAlerts: parsed.citizenAlerts || fallback.citizenAlerts,
      substationRisks: parsed.substationRisks || fallback.substationRisks,
      citizenSmsBroadcast: parsed.citizenSmsBroadcast || fallback.citizenSmsBroadcast,
      ndrfDeploymentZone: parsed.ndrfDeploymentZone || fallback.ndrfDeploymentZone,
    }
    onSummary?.(dispatch.summary)
    return dispatch
  } catch (err) {
    console.warn('Gemini API fallback activated:', err)
    const fallback = generateDeterministicDispatch(sector, telemetry, customQuery)
    onSummary?.(fallback.summary)
    return fallback
  }
}
