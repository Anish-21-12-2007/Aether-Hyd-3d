# AETHER-HYD — Hyderabad 3D Hydrological Spatial Twin

An interactive 3D WebGL urban hydrology simulator, subterranean stormwater X-ray, and AI ward-level flood triage command center for **Hyderabad, India**.

Built with **React 19**, **TypeScript**, **Three.js / React Three Fiber**, **GSAP ScrollTrigger**, **Lenis**, **Tailwind CSS v4**, and **Google Gemini (`@google/genai`)** with a deterministic offline hydrological fallback.

---

## Architecture Overview

### 1. Continuous 5-Chapter Scroll-Choreographed 3D Stage + Free Orbit
The WebGL `<Canvas>` stays fixed full-bleed (`100vw × 100vh`) while **Lenis** and **GSAP ScrollTrigger** drive a Catmull-Rom spline camera through five chapters:
1. **Orbital Overview** — Low-angle fly-in over the Deccan basin heightmap (`public/textures/hyd-heightmap.png`).
2. **HITEC City & Durgam Cheruvu** — Swoop past procedural glass-and-steel skyscrapers, **Cyber Towers**, and the **Durgam Cheruvu Cable-Stayed Bridge**.
3. **Hussain Sagar & Cloudburst** — Interactive **Hold-to-Simulate Cloudburst** orbital dial (mouse hold / touch / `Spacebar`) with camera micro-shake, drifting volumetric clouds, lightning illumination bursts, and live water inundation.
4. **Musi Riverbed & Subterranean Flow** — Terrain cross-sections into wireframe X-ray mode to expose animated subterranean stormwater tunnels, bottleneck chokepoints, and GPU-instanced traffic light-trails dynamically rerouting onto elevated flyovers.
5. **AI Ward Triage Command** — Full-basin tactical pull-out with Three.js raycasting on 3D sector beacons and landmarks to inspect depth (`cm`), elevation, and pump readiness, paired with a slide-over AI Tactical Dispatch terminal.

Use the **`STORY MODE / FREE ORBIT`** toggle in the top rail at any time to switch between scroll choreography and free 3D orbit/zoom/pan.

### 2. Custom Shaders & Procedural Architecture
- **`TerrainMesh.tsx`**: Heightmap-displaced basalt/lidar topography with infinite obsidian horizon blending and smooth X-ray cross-section transition.
- **`FloodWaterShader.tsx`**: Multi-octave Gerstner wave vertex shader with analytical normals, Schlick Fresnel sky + lightning reflections, procedural caustics, terrain-matched shoreline foam, and depth-threshold hazard coloring (`#14B8A6` baseline → `#F59E0B` surge → `#EF4444` critical inundation).
- **`HyderabadLandmarks.tsx`**: Procedural **Cyber Towers**, **Durgam Cheruvu Cable-Stayed Bridge**, **Hussain Sagar Monolith**, **Charminar Monument**, a 330-tower shader-lit urban skyline, and 3D raycasted architectural callout tooltips.
- **`SubterraneanDrainage.tsx`**: Animated GLSL stormwater conduit flow shader, pulsing chokepoints, and 120 GPU-instanced vehicle/emergency light trails.
- **`StormAtmosphere.tsx`**: Dual-layer volumetric FBM monsoon cloud decks, lightning flash bursts synchronized with procedural Web Audio thunder (`src/utils/audio.ts`), and 3,600 wind-angled rain streaks.

### 3. AI Ward-Level Triage Engine (`src/utils/triageEngine.ts`)
- Connects to Gemini (`gemini-2.5-flash`) when `VITE_GEMINI_API_KEY` is provided in `.env`.
- Falls back instantaneously to a deterministic Hyderabad hydrological engine when offline or without an API key.

---

## Local Development & Build

```bash
npm install
npm run dev
```

To enable live Gemini streaming in the AI Dispatch terminal, create a `.env` file in the project root:

```env
VITE_GEMINI_API_KEY=your_api_key_here
```

Production build & preview:

```bash
npm run build
npm run preview
```
