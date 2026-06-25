# SINGULARITY — Real-Time Black Hole Simulator

A GPU-accelerated, in-browser black hole simulator: Schwarzschild photon
geodesics ray-marched per pixel, a smooth **volumetric accretion disk** rendered
entirely in the ray-marcher (Interstellar/Gargantua-style), an HDR bloom + filmic
pipeline, optional relativistic jets and a Kerr ergosphere, a richly lensed
deep-space backdrop, and a guided cinematic descent from approach to beyond the
event horizon — plus a second, separate **Cosmos** you can fly into, dive
through, and space map

### ▶ Live: https://viswa-z1.github.io/BlackHole-simulator/

## Run it locally

No build step. Any static server works:

```bash
cd "Black hole simulator"
python3 -m http.server 8777
# open http://localhost:8777
```

(Needs internet on first load — Three.js is pulled from a CDN via an import map.)
Best experienced in **Chrome or Safari on an Apple-Silicon Mac**, full-screen.

## Features

**The experience**
- **Explorable 3D home** — the landing page is the live black hole. Drag to
  orbit, scroll to zoom. Nothing auto-plays; press **Begin the Journey** to
  launch the cinematic.
- **Cinematic tracking shot** — a procedural exploration **ship** leads the
  camera down toward the hole, silhouetted against the disk with glowing engines.

**The descent**
- Per-pixel **gravitational lensing** — every fragment integrates a photon
  geodesic in the Schwarzschild metric with **RK4** and bends the starfield,
  disk, and photon ring in real time.
- **Volumetric accretion disk** — smooth, glassy, gently flaring plasma
  integrated through the ray-marcher itself (no particles): Keplerian-sheared
  silky bands, a warm-gold temperature gradient, white-hot inner edge, and a
  crisp **photon ring** on the shadow's silhouette.
- **Relativistic Doppler beaming**, gravitational redshift, **relativistic polar
  jets**, and a toggleable **Kerr ergosphere**.
- **HDR pipeline**: linear-HDR shading → **UnrealBloom** → **ACES filmic** tone
  mapping for a high-definition, cinematic look.
- A six-stage guided journey (Approach → Lensing → Photon Ring → ISCO → Horizon
  → Beyond) with a live telemetry HUD (r/Rₛ, time dilation, redshift, zone
  warnings).
- **Adaptive performance** — sustained low FPS automatically steps down
  resolution, then bloom, to keep it smooth.

**The cosmos** (a second, explorable universe)
- A separate **Cosmos** page: a deep, multi-layer **parallax** star field you
  **scroll to dive** through, with procedural **nebulae**, drifting **cosmic
  dust**, and ambient **shooting stars**.
- **14 astrophysical anomalies** (black holes, quasars, pulsars, magnetars, a
  neutron star, nebulae, a merger and a wormhole) as glowing nodes — **hover**
  for a label, **click** for an info card, and **fall into the simulation** from
  any card.
- A live top-down **star map** you can click to navigate, plus a cosmos
  telemetry HUD (dive depth / anomaly count).

**Tools** (right-hand rail)
- **📷 Capture** a frame (P), **🎬 Cinematic** mode (C, letterbox + hidden UI),
  **🔈 Ambient audio** (a synthesized drone that swells near the horizon), and a
  **? Help** overlay of shortcuts.

**The catalog**
- The **top 20 black holes**, **quasars**, and **top 20 pulsars**, filterable by
  category.
- Every object has a **procedurally rendered, telescope-style portrait** themed
  to its physical kind (lensed disks, quasar jets, binary accretion streams,
  pulsar beams, magnetar field lines).
- Click any object for a **detail modal**: large portrait, full stat sheet,
  a creative write-up, and a link to its real-world data.

**The anatomy**
- The **Anatomy** section explains each region of a black hole with a live,
  looping **animated visualization** (singularity, horizon, photon sphere,
  ISCO, disk, lensing, ergosphere, jets, Doppler beaming, redshift).

## Controls

- **Scroll / ← → / drag the bar** — fly the descent · **Space** — auto-cruise
- **Controls** dock — mass, spin, brightness, lensing quality, **disk spectrum**,
  **Time Flow** (0–3×), Doppler, **relativistic jets**, **Kerr ergosphere**, free-orbit
- **Cosmos** — fly into the universe: drag to look, scroll to dive, click nodes
  and the star map
- **Anatomy** — every region of a black hole, each with an animated visualization
- **Catalog** — browse, filter, and open any object
- **Keys** — **P** capture · **C** cinematic · **?** help · **Esc** close

## About the "CUDA + OpenGL" request

The original ask was CUDA + native OpenGL on an M4 Mac mini. Two hard facts:
**CUDA is NVIDIA-only** and cannot run on Apple Silicon, and **browsers can't
call native OpenGL or CUDA** anyway — the web GPU APIs are WebGL2 / WebGPU.

So this is built on **WebGL2 + GPGPU**, the correct fast path on an M4: the
geodesic integration and the million-particle physics both run on the Mac's GPU.
Everything in the vision is preserved — per-pixel light bending, RK4,
Schwarzschild geodesics, ISCO, the glowing lensed ring. A true compute-shader
1M-particle pipeline is a drop-in upgrade via **WebGPU** (Three's
`WebGPURenderer` + TSL); the architecture is structured for it.

## Physically modeled vs. artistic

**Modeled** — Schwarzschild photon geodesics (RK4, per pixel); event horizon,
photon sphere (1.5 Rₛ), lensed disk wrapping over/under the hole; **Bardeen
prograde ISCO** from spin `a`; GR-corrected particle orbits with ISCO
instability; Doppler beaming, gravitational redshift; the Kerr ergosurface
`r_E(θ)=M+√(M²−a²cos²θ)`.

**Artistic license** — the volumetric disk's turbulence (Keplerian-sheared
noise) and density profile are stylized for the Interstellar look; spin moves
the ISCO and beaming but full Kerr frame-dragging of the lensed image isn't
ray-traced; catalog portraits are rendered representations, not photographs;
tone-mapping, jets, and the starfield are stylized.

## Files

```
index.html        UI shell + import map (three.js, anime.js) + modal/hero markup
css/style.css      cinematic glass UI, catalog, detail modal, explore/journey modes
js/data.js         top-20 black holes/quasars + top-20 pulsars + categories
js/portraits.js    procedural per-object portrait generator (canvas)
js/lensing.js      per-pixel ray-marcher: RK4 geodesics + volumetric disk (HDR)
js/ship.js         procedural exploration craft for the tracking shot
js/extras.js       relativistic jets + Kerr ergosphere
js/anatomy.js      animated per-region visualizations for the Anatomy section
js/audio.js        procedural Web Audio ambient drone
js/cosmos.js       the Cosmos page: parallax field, nebulae, dust, anomalies, streaks
js/cosmos-data.js  the 14 astrophysical anomalies on the star map
js/ui.js           panels, catalog, filters, detail modal, journey stages
js/main.js         renderer, bloom, page routing (black hole ↔ cosmos), HUD, tools
```

## Performance

Defaults target a smooth 60 FPS on an M4 (150 lensing steps, bloom on, pixel
ratio capped at 1.5). The volumetric disk is per-pixel, so **Lensing Steps** is
the main cost — lower it if it dips, or just let the adaptive scaler step down
resolution and bloom automatically.
