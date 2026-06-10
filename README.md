# SINGULARITY — Real-Time Black Hole Simulator

A GPU-accelerated, in-browser black hole simulator: Schwarzschild photon
geodesics ray-marched per pixel, an RK4-integrated million-particle accretion
disk, relativistic Doppler beaming, the ISCO and photon ring, and a guided
cinematic descent from approach to beyond the event horizon.

## Run it

No build step. Any static server works:

```bash
cd "Black hole simulator"
python3 -m http.server 8777
# open http://localhost:8777
```

(Needs internet on first load — Three.js is pulled from a CDN via an import map.)

Best experienced in **Chrome or Safari on your M4 Mac**, full-screen.

## Controls

- **Scroll / ← → / drag the bar** — fly the descent
- **Space** — toggle auto-cruise
- **Controls** (top right) — mass, spin, brightness, lensing quality, particle
  count (up to **1,048,576**), Doppler toggle, free-orbit camera
- **Anatomy** — every region explained
- **Catalog** — the top 20 black holes & top 20 pulsars

## About the "CUDA + OpenGL" request

The original ask was CUDA + native OpenGL on an M4 Mac mini. Two hard facts:

1. **CUDA is NVIDIA-only** and cannot run on Apple Silicon — there's no GPU for
   it. 2. **Browsers can't call native OpenGL or CUDA** anyway; the web GPU APIs
   are WebGL2 / WebGPU.

So this is built on **WebGL2 + GPGPU**, which *is* the correct, fast path on an
M4: the geodesic integration and the million-particle physics both run on the
Mac's GPU. Everything you asked for is preserved — per-pixel light bending, RK4,
Schwarzschild geodesics, ISCO, the glowing lensed ring — just through the API
the hardware actually exposes.

> Want a true 1M-particle compute pipeline with real compute shaders? Swap the
> GPGPU layer for **WebGPU** (Safari 18+ / Chrome support this on the M4). The
> render architecture is already structured for it.

## What's physically modeled vs. artistic

**Modeled**
- Null (photon) geodesics in the Schwarzschild metric, integrated per pixel with
  **RK4** (`js/lensing.js`) — this is the real light-bending / lensing.
- Event horizon (capture), photon sphere (1.5 Rₛ), and the lensed disk seen
  wrapping over/under the hole.
- **Bardeen prograde ISCO** computed from spin `a` (1 Rₛ at a=0 down to ~0.5 Rₛ
  near extremal) — sets the disk's inner edge (`iscoRs()` in `js/main.js`).
- Accretion particles: GR-corrected orbits (Newtonian + `3h²/r²` term) RK4-
  integrated on the GPU, so orbits inside the ISCO destabilize and spiral in,
  then respawn at the outer disk (`js/particles.js`).
- Relativistic Doppler beaming + gravitational redshift dimming on the disk.
- Schwarzschild time-dilation / redshift readout in the HUD.

**Artistic license** (for looks / performance)
- The GPGPU particle sprites are drawn in flat 3D and are **not** themselves
  lensed (the lensing pass handles the smooth disk; particles add fine texture).
- Spin only tilts beaming and moves the ISCO; full Kerr frame-dragging of the
  lensed image is not ray-traced.
- Tone-mapping, turbulence, and the procedural starfield are stylized.

## Files

```
index.html        UI shell + import map
css/style.css     cinematic glass UI
js/data.js        top-20 black holes & pulsars + feature glossary
js/lensing.js     per-pixel Schwarzschild photon ray-marcher (RK4)
js/particles.js   GPGPU RK4 accretion disk (up to 1M particles)
js/ui.js          panels, catalog, journey stages
js/main.js        renderer, camera descent, HUD, controls
```

## Performance

Defaults target a smooth 60 FPS on an M4 (262K particles, 260 lensing steps).
If you push particles to 1M or raise lensing steps and it dips, lower **Lensing
Steps** first (it's the per-pixel cost), then particle count.
