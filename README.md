# SINGULARITY — Real-Time Black Hole Simulator

A GPU-accelerated, in-browser black hole simulator: Schwarzschild photon
geodesics ray-marched per pixel, an RK4-integrated million-particle accretion
disk, an HDR bloom + filmic pipeline, relativistic jets and a Kerr ergosphere,
a richly lensed deep-space backdrop, and a guided cinematic descent from
approach to beyond the event horizon.

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

**The descent**
- Per-pixel **gravitational lensing** — every fragment integrates a photon
  geodesic in the Schwarzschild metric with **RK4** and bends the starfield,
  disk, and photon ring in real time.
- **GPGPU accretion disk** up to **1,048,576** particles, each on a GR-corrected
  orbit RK4-integrated on the GPU; particles that cross the **ISCO** destabilize
  and spiral in, then respawn — a continuously churning flow.
- **Relativistic Doppler beaming**, gravitational redshift, **relativistic polar
  jets**, and a toggleable **Kerr ergosphere**.
- **HDR pipeline**: linear-HDR shading → **UnrealBloom** → **ACES filmic** tone
  mapping for a high-definition, cinematic look.
- A six-stage guided journey (Approach → Lensing → Photon Ring → ISCO → Horizon
  → Beyond) with a live telemetry HUD (r/Rₛ, time dilation, redshift, zone
  warnings).
- **Adaptive performance** — sustained low FPS automatically steps down
  resolution, then bloom, to keep it smooth.

**The catalog**
- The **top 20 black holes**, **quasars**, and **top 20 pulsars**, filterable by
  category.
- Every object has a **procedurally rendered, telescope-style portrait** themed
  to its physical kind (lensed disks, quasar jets, binary accretion streams,
  pulsar beams, magnetar field lines).
- Click any object for a **detail modal**: large portrait, full stat sheet,
  a creative write-up, and a link to its real-world data.

## Controls

- **Scroll / ← → / drag the bar** — fly the descent · **Space** — auto-cruise
- **Controls** dock — mass, spin, brightness, lensing quality, particle count
  (up to 1M), Doppler, **relativistic jets**, **Kerr ergosphere**, free-orbit camera
- **Anatomy** — every region of a black hole explained
- **Catalog** — browse, filter, and open any object

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

**Artistic license** — GPGPU particle sprites are drawn in flat 3D and aren't
themselves lensed (the ray-marcher handles the smooth lensed disk); spin moves
the ISCO and beaming but full Kerr frame-dragging of the lensed image isn't
ray-traced; catalog portraits are rendered representations, not photographs;
tone-mapping, turbulence, jets, and the starfield are stylized.

## Files

```
index.html        UI shell + import map + modal/hero markup
css/style.css      cinematic glass UI, catalog, detail modal, polish
js/data.js         top-20 black holes/quasars + top-20 pulsars + categories
js/portraits.js    procedural per-object portrait generator (canvas)
js/lensing.js      per-pixel Schwarzschild photon ray-marcher (RK4, HDR)
js/particles.js    GPGPU RK4 accretion disk (up to 1M particles)
js/extras.js       relativistic jets + Kerr ergosphere
js/ui.js           panels, catalog, filters, detail modal, journey stages
js/main.js         renderer, bloom pipeline, camera descent, HUD, controls
```

## Performance

Defaults target a smooth 60 FPS on an M4 (262K particles, 260 lensing steps,
bloom on). If you push particles to 1M or raise lensing steps and it dips, lower
**Lensing Steps** first (it's the per-pixel cost), then particle count — or just
let the adaptive scaler handle it.
