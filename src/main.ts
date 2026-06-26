// ===================================================================
//  SINGULARITY — main orchestrator
//  Composes the lensing pass + GPGPU disk, drives the cinematic
//  descent camera, telemetry HUD, and all controls.
// ===================================================================
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { createLensing } from "./lensing.js";
import { createJets, createErgosphere } from "./extras.js";
import { createShip } from "./ship.js";
import { createAudio } from "./audio.js";
import { portraitDataURL } from "./portraits.js";
import { createCosmos } from "./cosmos.js";
import { buildUI, STAGES, toast } from "./ui.js";

// ---------- renderer ----------
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));   // heavy per-pixel ray-marcher
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;   // filmic HDR -> LDR
renderer.toneMappingExposure = 1.0;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- camera (drives the lensing ray-marcher + scene) ----------
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.01, 4000);
camera.position.set(0, 6, 40);
camera.lookAt(0, 0, 0);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 1.2;
controls.maxDistance = 120;
controls.enabled = false;

// ---------- engine pieces ----------
const lensing = createLensing(renderer);
const scene = new THREE.Scene();
// the full-screen lensing pass renders behind everything (renderOrder -1),
// so it can share one scene/camera and flow through the bloom pipeline
scene.add(lensing.mesh);

const jets = createJets();
jets.visible = false;            // off by default — match the clean Gargantua look
scene.add(jets.group);
const ergo = createErgosphere();
scene.add(ergo.mesh);

// ---------- lighting + exploration craft ----------
// the disk is the light source: a warm point light at the hole rim-lights the
// ship's inner face and leaves the far side dark → natural silhouette.
scene.add(new THREE.HemisphereLight(0x2a4070, 0x05060c, 0.55));
const diskLight = new THREE.PointLight(0xffb060, 3.0, 140, 1.2);
scene.add(diskLight);
const ship = createShip();
scene.add(ship.group);

// ---------- HDR post-processing: bloom + filmic tone mapping ----------
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// ---------- Cosmos page (a separate explorable universe) ----------
const cosmos = createCosmos(renderer);
let page = "bh";   // "bh" (black hole) | "cosmos"
function enterCosmos() {
  if (page === "cosmos") return;
  page = "cosmos";
  cosmos.enter();
  renderPass.scene = cosmos.scene; renderPass.camera = cosmos.camera;
  document.body.classList.add("page-cosmos");
  document.querySelector('.nav-pills button[data-view="sim"]')?.classList.remove("active");
  document.getElementById("nav-cosmos").classList.add("active");
  setHash("cosmos");
  toast("The cosmos — drag to look, scroll to dive deeper.");
}
function exitCosmos() {
  if (page !== "cosmos") return;
  page = "bh";
  cosmos.leave();
  renderPass.scene = scene; renderPass.camera = camera;
  document.body.classList.remove("page-cosmos");
  document.getElementById("nav-cosmos").classList.remove("active");
  document.getElementById("cosmos-card")?.classList.remove("open");
  document.getElementById("cosmos-label")?.classList.remove("show");
  document.body.style.cursor = "";
  tour = false; document.getElementById("cos-tour")?.classList.remove("active");
  setHash("");
}

// ---------- shareable deep links via the URL hash ----------
function setHash(v: string) { try { history.replaceState(null, "", v ? "#" + v : location.pathname + location.search); } catch (e) {} }
function applyHash() {
  const h = location.hash.slice(1).toLowerCase();
  if (h === "cosmos") enterCosmos();
  else if (h === "catalog") document.querySelector<HTMLElement>('.nav-pills button[data-view="catalog"]')?.click();
  else if (h === "anatomy") document.querySelector<HTMLElement>('.nav-pills button[data-view="features"]')?.click();
}
window.addEventListener("hashchange", applyHash);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.7,    // strength — lush Interstellar glow
  0.6,    // radius
  0.9     // luminance threshold — the gold disk + photon ring bloom
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// ---------- simulation parameters ----------
const params = {
  mass: 1.0,
  spin: 0.90,
  bright: 1.0,
  steps: 150,
  doppler: true,
  freeOrbit: false,
  jets: false,
  ergo: false,
  timeScale: 1.0,
};

// Bardeen prograde ISCO (in Schwarzschild-radius units; Rs = 2M)
function iscoRs(a) {
  a = Math.min(a, 0.9985);
  const Z1 = 1 + Math.cbrt(1 - a * a) * (Math.cbrt(1 + a) + Math.cbrt(1 - a));
  const Z2 = Math.sqrt(3 * a * a + Z1 * Z1);
  const rM = 3 + Z2 - Math.sqrt((3 - Z1) * (3 + Z1 + 2 * Z2)); // in units of M
  return rM / 2; // -> Rs units
}

function applyDisk() {
  const inner = iscoRs(params.spin);
  const outer = 9 + params.mass * 4.5;
  lensing.uniforms.uDiskInner.value = inner;
  lensing.uniforms.uDiskOuter.value = outer;
  lensing.uniforms.uSpin.value = params.spin;
}
applyDisk();

// ---------- mode: "explore" (drag the home scene) | "journey" (cinematic) ----------
let mode = "explore";
let progress = 0;        // 0..1
let targetProgress = 0;
let autoCruise = false;
let currentStage = -1;

// explore vantage — set up OrbitControls for a free, drag-to-look home scene
camera.position.set(0, 11, 36);
camera.lookAt(0, 0, 0);
controls.target.set(0, 0, 0);
controls.autoRotate = !reduceMotion;
controls.autoRotateSpeed = 0.45;

// camera radius as a function of progress (dive curve)
function radiusForProgress(p) {
  return 0.7 + 39.3 * Math.pow(1 - p, 2.2);   // 40 Rs -> 0.7 Rs
}

const _camTarget = new THREE.Vector3();
function updateJourneyCamera(dt, time) {
  if (params.freeOrbit) { controls.update(); return; }
  const R = radiusForProgress(progress);
  const az = time * 0.06 + progress * 1.4;
  const elev = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(7, 4.5, progress));
  const ce = Math.cos(elev);
  _camTarget.set(R * ce * Math.cos(az), R * Math.sin(elev), R * ce * Math.sin(az));
  // smooth follow → eases the hand-off from explore mode and softens the dive
  camera.position.lerp(_camTarget, 1 - Math.pow(0.0015, dt));
  camera.lookAt(0, 0, 0);
}

// ---------- ship choreography (leads the camera toward the hole) ----------
const _shipPos = new THREE.Vector3();
function updateShip(dt, time) {
  if (mode !== "journey") { ship.visible = false; return; }
  ship.visible = true;
  const R = radiusForProgress(progress) * 0.62;          // leads the camera toward the hole
  const az = time * 0.06 + progress * 1.4 + 0.22;        // off to one side of frame
  const elev = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(9, 5, progress));
  const ce = Math.cos(elev);
  _shipPos.set(R * ce * Math.cos(az), R * Math.sin(elev) - 0.5, R * ce * Math.sin(az));
  ship.group.position.copy(_shipPos);
  // nose (−z) toward the hole: point +z radially outward
  ship.group.lookAt(_shipPos.x * 2, _shipPos.y * 2, _shipPos.z * 2);
  ship.group.rotation.z += Math.sin(time * 0.7) * 0.12;  // gentle bank
  // swallowed by the horizon near the end
  const fade = 1 - THREE.MathUtils.clamp((progress - 0.82) / 0.12, 0, 1);
  ship.group.scale.setScalar(0.5 + fade * 0.32);
  ship.group.visible = fade > 0.02;
  ship.update(time);
}

// ---------- HUD ----------
const hud = {
  fps: document.getElementById("hud-fps"),
  particles: document.getElementById("hud-particles"),
  radius: document.getElementById("hud-radius"),
  stage: document.getElementById("hud-stage"),
  dilation: document.getElementById("hud-dilation"),
  redshift: document.getElementById("hud-redshift"),
  zone: document.getElementById("hud-zone"),
};
if (hud.particles) hud.particles.textContent = "volumetric";

function updateHUD(fps) {
  hud.fps.textContent = fps.toFixed(0);
  const r = camera.position.length();
  hud.radius.textContent = r.toFixed(2);
  hud.stage.textContent = mode === "explore" ? "Explore" : (STAGES[currentStage] || STAGES[0]).label;
  if (r > 1.0001) {
    const fac = 1 / Math.sqrt(1 - 1 / r);
    hud.dilation.textContent = fac > 50 ? "∞" : fac.toFixed(2) + "×";
    hud.redshift.textContent = (fac - 1) > 50 ? "∞" : (fac - 1).toFixed(2);
  } else {
    hud.dilation.textContent = "∞";
    hud.redshift.textContent = "∞";
  }
  let zone = "";
  if (r < 1.0) zone = "⚠ BEYOND THE HORIZON";
  else if (r < 1.5) zone = "⚠ INSIDE PHOTON SPHERE";
  else if (r < iscoRs(params.spin)) zone = "⚠ INSIDE ISCO — NO STABLE ORBIT";
  hud.zone.textContent = zone;
}

// ---------- stage captions ----------
const stageEl = document.getElementById("stage");
const stageName = stageEl.querySelector(".stage-name");
const stageDesc = stageEl.querySelector(".stage-desc");

function stageForProgress(p) {
  let idx = 0;
  for (let i = 0; i < STAGES.length; i++) if (p >= STAGES[i].t - 0.001) idx = i;
  return idx;
}
function refreshStage() {
  const idx = stageForProgress(progress);
  if (idx !== currentStage) {
    currentStage = idx;
    const s = STAGES[idx];
    stageEl.classList.remove("show");
    void stageEl.offsetWidth;
    stageName.textContent = s.name;
    stageDesc.textContent = s.desc;
    requestAnimationFrame(() => stageEl.classList.add("show"));
  }
}

const journeyFill = document.getElementById("journey-fill");

// ---------- input ----------
function nudgeProgress(d) { targetProgress = THREE.MathUtils.clamp(targetProgress + d, 0, 1); }

window.addEventListener("wheel", (e) => {
  if (document.querySelector(".panel.open")) return;
  if (page === "cosmos") { cosmos.addZoom(e.deltaY * 0.0006); return; }
  if (params.freeOrbit) return;
  nudgeProgress(e.deltaY * 0.00035);
}, { passive: true });

window.addEventListener("keydown", (e) => {
  if (document.querySelector(".panel.open")) return;
  if (page === "cosmos") {                 // WASD / arrows fly the cosmos
    const k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "a") cosmos.panBy(-0.14, 0);
    else if (k === "arrowright" || k === "d") cosmos.panBy(0.14, 0);
    else if (k === "arrowup" || k === "w") cosmos.addZoom(0.06);
    else if (k === "arrowdown" || k === "s") cosmos.addZoom(-0.06);
    else if (k === "q") cosmos.panBy(0, 0.14);
    else if (k === "e") cosmos.panBy(0, -0.14);
    else if (k === "r") { cosmos.reset(); toast("View recentered"); }
    else if (k === "g") { toast(cosmos.toggleGrid() ? "Reference grid on" : "Reference grid off"); }
    return;
  }
  if (e.key === "ArrowRight") nudgeProgress(0.04);
  else if (e.key === "ArrowLeft") nudgeProgress(-0.04);
  else if (e.code === "Space") {
    e.preventDefault();
    autoCruise = !autoCruise;
    toast(autoCruise ? "Auto-cruise engaged" : "Auto-cruise paused");
  }
});

// drag the journey bar
const track = document.querySelector(".journey-track") as HTMLElement;
let dragging = false;
function setFromBar(clientX) {
  const rect = track.getBoundingClientRect();
  targetProgress = THREE.MathUtils.clamp((clientX - rect.left) / rect.width, 0, 1);
}
track.addEventListener("pointerdown", (e) => { dragging = true; setFromBar(e.clientX); });
window.addEventListener("pointermove", (e) => { if (dragging) setFromBar(e.clientX); });
window.addEventListener("pointerup", () => { dragging = false; });

function jumpToStage(t) { autoCruise = false; targetProgress = t; }

// ---------- controls dock ----------
function bindRange(id, valId, fmt, set) {
  const el = document.getElementById(id) as HTMLInputElement;
  const lbl = document.getElementById(valId);
  el.addEventListener("input", () => { const v = parseFloat(el.value); lbl.textContent = fmt(v); set(v); });
  lbl.textContent = fmt(parseFloat(el.value));
}
bindRange("c-mass", "v-mass", v => v.toFixed(2) + " M", v => { params.mass = v; applyDisk(); });
bindRange("c-spin", "v-spin", v => v.toFixed(3), v => { params.spin = v; applyDisk(); });
bindRange("c-bright", "v-bright", v => v.toFixed(2), v => {
  params.bright = v; lensing.uniforms.uBright.value = v; jets.setBright(v);
});
bindRange("c-steps", "v-steps", v => String(v | 0), v => { params.steps = v; lensing.uniforms.uSteps.value = v; });
bindRange("c-time", "v-time", v => v.toFixed(2) + "×", v => { params.timeScale = v; });
bindRange("c-fov", "v-fov", v => (v | 0) + "°", v => { camera.fov = v; camera.updateProjectionMatrix(); });
bindRange("c-thick", "v-thick", v => v.toFixed(1) + "×", v => { lensing.uniforms.uDiskThick.value = v; });
bindRange("c-stars", "v-stars", v => v.toFixed(2) + "×", v => { lensing.uniforms.uStarBright.value = v; });
bindRange("c-ring", "v-ring", v => v.toFixed(2) + "×", v => { lensing.uniforms.uRingBright.value = v; });
bindRange("c-bloom", "v-bloom", v => v.toFixed(2), v => { bloomPass.strength = v; });

// real-object parameter presets
const PRESETS: Record<string, { mass: number; spin: number; pal: number }> = {
  sgra: { mass: 1.6, spin: 0.90, pal: 0 }, m87: { mass: 2.6, spin: 0.94, pal: 4 },
  cyg: { mass: 0.7, spin: 0.97, pal: 1 }, ton: { mass: 3.0, spin: 0.50, pal: 2 },
  gw: { mass: 0.5, spin: 0.67, pal: 0 },
};
document.getElementById("c-preset")?.addEventListener("change", (e) => {
  const p = PRESETS[(e.target as HTMLSelectElement).value]; if (!p) return;
  const setR = (id: string, v: number) => { const el = document.getElementById(id) as HTMLInputElement; el.value = String(v); el.dispatchEvent(new Event("input")); };
  setR("c-mass", p.mass); setR("c-spin", p.spin);
  document.querySelector<HTMLElement>(`#c-spectrum .sw[data-pal="${p.pal}"]`)?.click();
  toast("Preset applied");
});

// quality presets (manual override of the adaptive scaler)
const QUALITY: Record<string, { pr: number; steps: number; bloom: number }> = {
  low: { pr: 1, steps: 90, bloom: 0.3 }, med: { pr: 1.25, steps: 140, bloom: 0.5 },
  high: { pr: 1.5, steps: 200, bloom: 0.7 }, ultra: { pr: Math.min(window.devicePixelRatio, 2), steps: 320, bloom: 0.95 },
};
document.getElementById("c-quality")?.addEventListener("change", (e) => {
  const q = QUALITY[(e.target as HTMLSelectElement).value];
  if (!q) { perfTier = 2; toast("Adaptive quality on"); return; }   // back to auto
  renderer.setPixelRatio(q.pr); composer.setPixelRatio?.(q.pr); onResize();
  const steps = document.getElementById("c-steps") as HTMLInputElement;
  steps.value = String(q.steps); steps.dispatchEvent(new Event("input"));
  bloomPass.strength = q.bloom;
  perfTier = 0;                                                     // stop the adaptive scaler from overriding
  toast("Quality set");
});

document.getElementById("c-doppler").addEventListener("change", (e) => {
  const on = (e.target as HTMLInputElement).checked;
  params.doppler = on; lensing.uniforms.uDoppler.value = on ? 1 : 0;
});
document.getElementById("c-jets").addEventListener("change", (e) => {
  const on = (e.target as HTMLInputElement).checked;
  params.jets = on; jets.visible = on;
});
document.getElementById("c-ergo").addEventListener("change", (e) => {
  const on = (e.target as HTMLInputElement).checked;
  params.ergo = on; ergo.visible = on;
  if (on) toast("Ergosphere: region where space itself is dragged");
});
document.getElementById("c-orbit").addEventListener("change", (e) => {
  const on = (e.target as HTMLInputElement).checked;
  params.freeOrbit = on;
  controls.enabled = on;
  if (on) { controls.target.set(0, 0, 0); controls.update(); toast("Free orbit — drag to look, scroll to zoom"); }
  else toast("Guided descent resumed");
});
document.getElementById("toggle-dock").addEventListener("click", () => {
  document.getElementById("dock").classList.toggle("collapsed");
});
document.getElementById("nav-cosmos").addEventListener("click", enterCosmos);
document.querySelector('.nav-pills button[data-view="sim"]').addEventListener("click", exitCosmos);
const cosmosLabel = document.getElementById("cosmos-label");
const cosmosCard = document.getElementById("cosmos-card");
let cosmosHover = null;
const KIND_TO_PORTRAIT: Record<string, string> = {
  "Black Hole": "supermassive", "Quasar": "quasar", "Pulsar": "pulsar",
  "Magnetar": "magnetar", "Neutron Star": "neutron", "Nebula": "supermassive",
  "Merger": "binary", "Wormhole": "supermassive",
};
function openCosmosCard(d) {
  cosmosCard.style.setProperty("--cc-accent", "#" + d.color.toString(16).padStart(6, "0"));
  const img = document.getElementById("cc-img") as HTMLImageElement;
  if (img) { img.src = portraitDataURL({ name: d.name, kind: KIND_TO_PORTRAIT[d.kind] || "stellar" }, 760, 380); img.alt = `Rendered figure of ${d.name}`; }
  document.getElementById("cc-kind").textContent = d.kind;
  document.getElementById("cc-name").textContent = d.name;
  document.getElementById("cc-dist").textContent = "Distance · " + d.dist;
  document.getElementById("cc-blurb").textContent = d.blurb;
  cosmosCard.classList.add("open");
}
let cardIndex = 0;
function showAnomaly(i: number) {
  const n = cosmos.anomalies.length;
  cardIndex = ((i % n) + n) % n;
  openCosmosCard(cosmos.focus(cardIndex));   // focus() centres + returns the data
}
document.getElementById("cc-prev")?.addEventListener("click", () => showAnomaly(cardIndex - 1));
document.getElementById("cc-next")?.addEventListener("click", () => showAnomaly(cardIndex + 1));
document.getElementById("cos-random")?.addEventListener("click", () => showAnomaly(Math.floor(Math.random() * cosmos.anomalies.length)));

// cosmos kind-filter chips
(function buildCosmosFilter() {
  const bar = document.getElementById("cosmos-filter"); if (!bar) return;
  const kinds = ["All", ...cosmos.kinds()];
  bar.innerHTML = kinds.map((k, i) => `<button class="cfilter${i === 0 ? " active" : ""}" data-kind="${k === "All" ? "" : k}">${k}</button>`).join("");
  bar.querySelectorAll(".cfilter").forEach(b => b.addEventListener("click", () => {
    bar.querySelectorAll(".cfilter").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    cosmos.filterKind((b as HTMLElement).dataset.kind);
  }));
})();
cosmosCard.querySelector("[data-cosmos-close]").addEventListener("click", () => cosmosCard.classList.remove("open"));
document.getElementById("cc-enter").addEventListener("click", () => {
  cosmosCard.classList.remove("open");
  exitCosmos();
  document.querySelector('.nav-pills button[data-view="sim"]').classList.add("active");
  beginJourney();                      // fall into the black-hole descent
});

// ---------- cosmos auto-tour ----------
let tour = false, tourI = 0, tourT = 0;
document.getElementById("cos-tour")?.addEventListener("click", () => {
  tour = !tour; tourT = 0; tourI = 0;
  document.getElementById("cos-tour")?.classList.toggle("active", tour);
  if (tour) openCosmosCard(cosmos.focus(0)); else cosmosCard.classList.remove("open");
  toast(tour ? "Auto-tour started — sit back and drift." : "Auto-tour stopped");
});
canvas.addEventListener("click", (e) => {
  if (page !== "cosmos") return;
  const hit = cosmos.pick((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  if (hit) showAnomaly(cosmos.anomalies.indexOf(hit));
});

// ---------- star map (top-down minimap of the cosmos) ----------
const mapCanvas = document.getElementById("cosmos-map-canvas") as HTMLCanvasElement;
const mapCtx = mapCanvas.getContext("2d");
const MAP_W = 220, MAP_H = 220;
function worldToMap(x, z) {
  return [((x + 1100) / 2200) * MAP_W, ((z + 2900) / 3200) * MAP_H];
}
mapCanvas.addEventListener("click", (e) => {
  const r = mapCanvas.getBoundingClientRect();
  const my = ((e.clientY - r.top) / r.height) * MAP_H;
  const z = (my / MAP_H) * 3200 - 2900;       // inverse of worldToMap
  cosmos.flyToZ(z);
  toast("Diving toward that region…");
});
// hover the star map to label the nearest anomaly dot
mapCanvas.addEventListener("mousemove", (e) => {
  const r = mapCanvas.getBoundingClientRect();
  const mx = ((e.clientX - r.left) / r.width) * MAP_W, my = ((e.clientY - r.top) / r.height) * MAP_H;
  let best: any = null, bd = 9;
  for (const a of cosmos.anomalies) { const [ax, ay] = worldToMap(a.group.position.x, a.group.position.z); const d = Math.hypot(ax - mx, ay - my); if (d < bd) { bd = d; best = a; } }
  const lbl = document.getElementById("cosmos-label");
  if (best) { lbl.innerHTML = `<b>${best.data.name}</b><span>${best.data.kind}</span>`; lbl.style.left = e.clientX + "px"; lbl.style.top = e.clientY + "px"; lbl.classList.add("show"); }
  else lbl.classList.remove("show");
});
mapCanvas.addEventListener("mouseleave", () => document.getElementById("cosmos-label").classList.remove("show"));
const cosDepth = document.getElementById("cos-depth");
const cosZoom = document.getElementById("cos-zoom");
document.getElementById("cos-count").textContent = String(cosmos.anomalies.length);
const cosNear = document.getElementById("cos-near");
function updateCosmosHUD() {
  const z = cosmos.zoom;
  cosDepth.textContent = (z * 4.2).toFixed(2) + " Bly";
  let best: any = null, bd = Infinity;
  for (const a of cosmos.anomalies) { const d = a.group.position.distanceTo(cosmos.camera.position); if (d < bd) { bd = d; best = a; } }
  if (cosNear) cosNear.textContent = best ? best.data.name : "—";
  cosZoom.textContent = Math.round(z * 100) + "%";
}
function drawCosmosMap() {
  mapCtx.clearRect(0, 0, MAP_W, MAP_H);
  mapCtx.fillStyle = "rgba(8,11,24,0.55)"; mapCtx.fillRect(0, 0, MAP_W, MAP_H);
  mapCtx.strokeStyle = "rgba(120,150,220,0.12)"; mapCtx.lineWidth = 1;
  for (let i = 1; i < 4; i++) { const g = (i / 4) * MAP_H; mapCtx.beginPath(); mapCtx.moveTo(0, g); mapCtx.lineTo(MAP_W, g); mapCtx.stroke(); }
  for (const a of cosmos.anomalies) {
    const [mx, my] = worldToMap(a.group.position.x, a.group.position.z);
    mapCtx.fillStyle = "#" + a.data.color.toString(16).padStart(6, "0");
    mapCtx.beginPath(); mapCtx.arc(mx, my, 3, 0, 7); mapCtx.fill();
  }
  const [cx, cy] = worldToMap(cosmos.camera.position.x, cosmos.camera.position.z);
  mapCtx.strokeStyle = "#fff"; mapCtx.lineWidth = 1.5;
  mapCtx.beginPath(); mapCtx.arc(cx, cy, 4, 0, 7); mapCtx.stroke();
  mapCtx.strokeStyle = "rgba(255,255,255,0.35)";
  mapCtx.beginPath(); mapCtx.moveTo(cx, cy); mapCtx.lineTo(cx - 9, cy - 16); mapCtx.moveTo(cx, cy); mapCtx.lineTo(cx + 9, cy - 16); mapCtx.stroke();
}
window.addEventListener("pointermove", (e) => {
  if (page !== "cosmos") return;
  const nx = (e.clientX / window.innerWidth) * 2 - 1;
  const ny = (e.clientY / window.innerHeight) * 2 - 1;
  cosmos.setPointer(nx, ny);
  cosmosHover = cosmos.pick(nx, -ny);          // raycaster NDC has y up
  if (cosmosHover) {
    const d = cosmosHover.data;
    cosmosLabel.innerHTML = `<b>${d.name}</b><span>${d.kind} · ${d.dist}</span>`;
    cosmosLabel.style.left = e.clientX + "px";
    cosmosLabel.style.top = e.clientY + "px";
    cosmosLabel.classList.add("show");
    document.body.style.cursor = "pointer";
  } else {
    cosmosLabel.classList.remove("show");
    document.body.style.cursor = "";
  }
});

// ---------- frame capture (download the current view as a PNG) ----------
let captureRequested = false;
function saveFrame() {
  try {
    const url = renderer.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `singularity-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    document.body.classList.add("flash");
    setTimeout(() => document.body.classList.remove("flash"), 240);
    toast("Frame saved to your downloads.");
  } catch (err) {
    toast("Couldn't capture this frame.");
  }
}
document.getElementById("tool-capture").addEventListener("click", () => { captureRequested = true; });
window.addEventListener("keydown", (e) => { if ((e.key === "p" || e.key === "P") && !e.metaKey && !e.ctrlKey) captureRequested = true; });

// ---------- copy share link ----------
document.getElementById("tool-share")?.addEventListener("click", () => {
  const url = location.href;
  navigator.clipboard?.writeText(url).then(
    () => toast("Share link copied to clipboard."),
    () => toast(url),
  );
});

// ---------- fullscreen ----------
function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}
document.getElementById("tool-fs")?.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", () => document.getElementById("tool-fs")?.classList.toggle("active", !!document.fullscreenElement));
window.addEventListener("keydown", (e) => {
  if ((e.key === "f" || e.key === "F") && !e.metaKey && !e.ctrlKey && !document.querySelector(".panel.open")) toggleFullscreen();
});

// ---------- help / shortcuts overlay ----------
const helpModal = document.getElementById("help-modal");
function toggleHelp(force?: boolean) {
  const open = force !== undefined ? force : !helpModal.classList.contains("open");
  helpModal.classList.toggle("open", open);
}
document.getElementById("tool-help").addEventListener("click", () => toggleHelp());
helpModal.querySelector("[data-help-close]").addEventListener("click", () => toggleHelp(false));
helpModal.addEventListener("click", (e) => { if (e.target === helpModal) toggleHelp(false); });
window.addEventListener("keydown", (e) => {
  if (e.key === "?") toggleHelp();
  else if (e.key === "Escape") toggleHelp(false);
});

// ---------- procedural ambient audio (swells near the horizon) ----------
const audio = createAudio();
document.getElementById("tool-audio").addEventListener("click", () => {
  const on = audio.toggle();
  const btn = document.getElementById("tool-audio");
  btn.classList.toggle("active", on);
  btn.textContent = on ? "🔊" : "🔈";
  toast(on ? "Ambient audio on" : "Ambient audio muted");
});

// ---------- cinematic mode (hide chrome + letterbox) ----------
function toggleCinematic() {
  const on = document.body.classList.toggle("cinematic");
  document.getElementById("tool-cinema").classList.toggle("active", on);
  toast(on ? "Cinematic mode — press C to exit" : "Interface restored");
}
document.getElementById("tool-cinema").addEventListener("click", toggleCinematic);
window.addEventListener("keydown", (e) => {
  if ((e.key === "c" || e.key === "C") && !e.metaKey && !e.ctrlKey && !document.querySelector(".panel.open")) toggleCinematic();
});

// ---------- disk spectrum (color theme) ----------
const SPECTRUM_NAMES = ["Sagittarius Gold", "Cygnus Blue", "Quasar Violet", "Magnetar Ice", "Crimson Redshift"];
document.querySelectorAll("#c-spectrum .sw").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll("#c-spectrum .sw").forEach((x) => x.classList.remove("active"));
  b.classList.add("active");
  const p = +(b as HTMLElement).dataset.pal;
  lensing.uniforms.uPalette.value = p;
  document.getElementById("v-spectrum").textContent = SPECTRUM_NAMES[p];
  toast(`Disk spectrum: ${SPECTRUM_NAMES[p]}`);
}));

// ---------- settings persistence (localStorage) ----------
const PREF_KEY = "singularity.prefs.v1";
function savePrefs() {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify({
      mass: params.mass, spin: params.spin, bright: params.bright, steps: params.steps,
      timeScale: params.timeScale, doppler: params.doppler, jets: params.jets, ergo: params.ergo,
      palette: lensing.uniforms.uPalette.value,
    }));
  } catch (e) { /* storage unavailable */ }
}
function loadPrefs() {
  let p: any;
  try { p = JSON.parse(localStorage.getItem(PREF_KEY) || "null"); } catch (e) { return; }
  if (!p) return;
  const setRange = (id: string, v: number) => { const el = document.getElementById(id) as HTMLInputElement; if (el && v != null) { el.value = String(v); el.dispatchEvent(new Event("input")); } };
  const setCheck = (id: string, v: boolean) => { const el = document.getElementById(id) as HTMLInputElement; if (el && v != null && el.checked !== v) { el.checked = v; el.dispatchEvent(new Event("change")); } };
  setRange("c-mass", p.mass); setRange("c-spin", p.spin); setRange("c-bright", p.bright);
  setRange("c-steps", p.steps); setRange("c-time", p.timeScale);
  setCheck("c-doppler", p.doppler); setCheck("c-jets", p.jets); setCheck("c-ergo", p.ergo);
  if (p.palette != null) document.querySelector<HTMLElement>(`#c-spectrum .sw[data-pal="${p.palette}"]`)?.click();
}
["c-mass", "c-spin", "c-bright", "c-steps", "c-time"].forEach(id => document.getElementById(id)?.addEventListener("input", savePrefs));
["c-doppler", "c-jets", "c-ergo"].forEach(id => document.getElementById(id)?.addEventListener("change", savePrefs));
document.getElementById("c-spectrum")?.addEventListener("click", () => setTimeout(savePrefs, 0));

// ---------- UI build ----------
buildUI(jumpToStage);
loadPrefs();

// ---------- anime.js: buttery hero entrance ----------
if (window.anime && !reduceMotion) {
  window.anime.timeline({ easing: "easeOutExpo" })
    .add({ targets: ".hero-eyebrow", opacity: [0, 0.85], translateY: [16, 0], duration: 700 })
    .add({ targets: "#loader h1", opacity: [0, 1], translateY: [22, 0], duration: 1000 }, "-=520")
    .add({ targets: ".hero-sub", opacity: [0, 0.82], translateY: [16, 0], duration: 700 }, "-=640")
    .add({ targets: ".hero-stats > div", opacity: [0, 1], translateY: [16, 0], delay: window.anime.stagger(90), duration: 600 }, "-=520")
    .add({ targets: ".hero-hint", opacity: [0, 0.7], duration: 700 }, "-=300");
}

// ---------- loader / enter ----------
const loader = document.getElementById("loader");
const enterBtn = document.getElementById("enter-btn");
const loaderStatus = document.getElementById("loader-status");
const bootMsgs = [
  "Warming up the engines…",
  "Painting a million stars…",
  "Lighting the accretion disk…",
  "Bending the starlight…",
  "Ready.",
];
const ctaCatalog = document.getElementById("enter-catalog");
const ctaPhysics = document.getElementById("enter-physics");
const ctaCosmos = document.getElementById("enter-cosmos");

document.body.classList.add("mode-explore");

let revealed = false, started = false;
function runTips(delay = 1600) {           // staggered onboarding toasts
  const tips = [
    "Tip: drag to orbit the black hole.",
    "Scroll to zoom in and out.",
    "Press “Begin the Journey” to fall in.",
    "Or open the Cosmos to explore a universe.",
  ];
  tips.forEach((t, i) => setTimeout(() => toast(t), delay + i * 3200));
}
function firstVisitTips() {                // shown once, on the first visit
  try { if (localStorage.getItem("singularity.seen")) return; localStorage.setItem("singularity.seen", "1"); } catch (e) { return; }
  runTips();
}
document.getElementById("help-replay")?.addEventListener("click", () => { toggleHelp(false); runTips(300); });
function reveal() {                       // home scene becomes live + draggable
  if (revealed) return;
  revealed = true;
  loader.classList.add("revealed");       // backdrop turns transparent, scene shows
  controls.enabled = true;                // drag to explore the 3D space
  applyHash();                            // honour a shared deep link (#cosmos/#catalog/#anatomy)
  if (!location.hash) firstVisitTips();
}

let boot = 0;
const bootTimer = setInterval(() => {
  loaderStatus.textContent = bootMsgs[boot];
  if (++boot >= bootMsgs.length) {
    clearInterval(bootTimer);
    enterBtn.classList.add("ready");
    ctaCatalog.classList.add("ready");
    ctaCosmos.classList.add("ready");
    ctaPhysics.classList.add("ready");
    loaderStatus.textContent = "Drag to look around — then begin.";
    reveal();
  }
}, 420);

function beginJourney() {                 // explicit Start → cinematic tracking shot
  if (started) return;
  started = true;
  loader.classList.add("hidden");
  document.body.classList.replace("mode-explore", "mode-journey");
  mode = "journey";
  controls.autoRotate = false;
  controls.enabled = params.freeOrbit;
  progress = 0; targetProgress = 0;
  autoCruise = true;
  toast("Launching… scroll or ← → to steer · Space to pause.");
}
function returnToExplore() {              // go back to the draggable home scene
  if (mode !== "journey") return;
  mode = "explore";
  document.body.classList.replace("mode-journey", "mode-explore");
  started = false;
  autoCruise = false;
  ship.visible = false;
  controls.enabled = true;
  controls.autoRotate = !reduceMotion;
  camera.position.set(0, 11, 36);
  controls.target.set(0, 0, 0);
  controls.update();
  loader.classList.remove("hidden");      // bring the hero/Start back
  loader.classList.add("revealed");
  toast("Back to free exploration — drag to look around.");
}
enterBtn.addEventListener("click", beginJourney);
document.getElementById("back-home").addEventListener("click", returnToExplore);
ctaCatalog.addEventListener("click", () => {
  reveal();
  document.querySelector<HTMLElement>('.nav-pills button[data-view="catalog"]')?.click();
});
ctaPhysics.addEventListener("click", () => {
  reveal();
  document.querySelector<HTMLElement>('.nav-pills button[data-view="features"]')?.click();
});
ctaCosmos.addEventListener("click", () => { reveal(); enterCosmos(); });

// ---------- resize ----------
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  lensing.uniforms.uResolution.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
  cosmos.resize(w, h);
}
window.addEventListener("resize", onResize);
onResize();

// ---------- adaptive performance (keep it smooth) ----------
let perfTier = 2, lowTime = 0;
function adaptPerf(dt) {
  if (!revealed || perfTier === 0) return;
  lowTime = fpsEMA < 42 ? lowTime + dt : Math.max(0, lowTime - dt * 0.6);
  if (lowTime > 3.5) {
    perfTier--;
    if (perfTier === 1) {
      const pr = Math.min(window.devicePixelRatio, 1.25);
      renderer.setPixelRatio(pr); composer.setPixelRatio?.(pr); onResize();
      toast("Tuning resolution for a smoother ride…");
    } else {
      renderer.setPixelRatio(1); composer.setPixelRatio?.(1);
      bloomPass.strength = 0.32; onResize();
      toast("Performance mode on");
    }
    lowTime = 0;
  }
}

// ---------- render loop ----------
const clock = new THREE.Clock();
let fpsEMA = 60, frame = 0, simTime = 0;
const right = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  simTime += dt * params.timeScale;          // Time Flow scales all animation
  const time = simTime;

  if (page === "cosmos") {
    cosmos.update(dt, time);
    if (tour) { tourT += dt; if (tourT > 5) { tourT = 0; tourI = (tourI + 1) % cosmos.anomalies.length; openCosmosCard(cosmos.focus(tourI)); } }
    if (frame % 3 === 0) { drawCosmosMap(); updateCosmosHUD(); }
  } else {
    if (mode === "explore") {
      controls.update();                               // drag-to-look + auto-rotate
    } else {
      if (autoCruise && !params.freeOrbit) {
        targetProgress += dt * 0.045 * params.timeScale;
        if (targetProgress >= 1) targetProgress = 0;   // endless dive
      }
      progress += (targetProgress - progress) * Math.min(1, dt * 3.2);
      journeyFill.style.width = (progress * 100).toFixed(1) + "%";
      refreshStage();
      updateJourneyCamera(dt, time);
    }

    // animated elements
    updateShip(dt, time);
    jets.update(time, params.spin);
    ergo.update(time, params.spin);

    // feed camera basis into the lensing shader
    camera.updateMatrixWorld();
    const m = camera.matrixWorld.elements;
    right.set(m[0], m[1], m[2]);
    up.set(m[4], m[5], m[6]);
    fwd.set(-m[8], -m[9], -m[10]);
    lensing.uniforms.uCamPos.value.copy(camera.position);
    lensing.uniforms.uCamRight.value.copy(right);
    lensing.uniforms.uCamUp.value.copy(up);
    lensing.uniforms.uCamFwd.value.copy(fwd);
    lensing.uniforms.uTanFov.value = Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5);
    lensing.uniforms.uTime.value = time;
    lensing.uniforms.uPlunge.value = THREE.MathUtils.clamp((progress - 0.9) / 0.1, 0, 1);
    // gravitational-wave ripple swells through the ISCO→horizon stretch
    lensing.uniforms.uRipple.value = THREE.MathUtils.clamp((progress - 0.72) / 0.16, 0, 1) * (1 - lensing.uniforms.uPlunge.value);
  }

  // render through the HDR bloom + tone-mapping pipeline
  composer.render();

  // capture the freshly-rendered frame before the next clear
  if (captureRequested) { captureRequested = false; saveFrame(); }

  // ambient audio intensifies as the camera nears the horizon
  if (page !== "cosmos") audio.setIntensity(THREE.MathUtils.clamp((40 - camera.position.length()) / 38, 0, 1));

  // HUD
  frame++;
  const fps = 1 / Math.max(1e-4, dt);
  fpsEMA += (fps - fpsEMA) * 0.08;
  if (frame % 8 === 0) updateHUD(fpsEMA);
  adaptPerf(dt);

  requestAnimationFrame(tick);
}
tick();

// expose for debugging
window.__sing = { params, lensing, camera, ship, cosmos, get mode() { return mode; }, get page() { return page; }, begin: beginJourney };
