// ===================================================================
//  SINGULARITY — main orchestrator
//  Composes the lensing pass + GPGPU disk, drives the cinematic
//  descent camera, telemetry HUD, and all controls.
// ===================================================================
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createLensing } from "./lensing.js";
import { createParticles, PARTICLE_PRESETS } from "./particles.js";
import { createJets, createErgosphere } from "./extras.js";
import { buildUI, STAGES, toast } from "./ui.js";

// ---------- renderer ----------
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.autoClear = false;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);

// ---------- camera (shared by lensing + particles) ----------
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
const particleScene = new THREE.Scene();
let particles = createParticles(renderer, 3);    // ~262K default
particleScene.add(particles.points);

const jets = createJets();
particleScene.add(jets.group);
const ergo = createErgosphere();
particleScene.add(ergo.mesh);

// ---------- simulation parameters ----------
const params = {
  mass: 1.0,
  spin: 0.90,
  bright: 1.0,
  steps: 260,
  doppler: true,
  freeOrbit: false,
  countIndex: 3,
  jets: true,
  ergo: false,
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
  particles.setDisk(inner, outer);
}
applyDisk();

// ---------- cinematic journey ----------
let progress = 0;        // 0..1
let targetProgress = 0;
let autoCruise = false;
let currentStage = -1;

// camera radius as a function of progress (dive curve)
function radiusForProgress(p) {
  return 0.7 + 39.3 * Math.pow(1 - p, 2.2);   // 40 Rs -> 0.7 Rs
}

function updateJourneyCamera(dt, time) {
  if (params.freeOrbit) { controls.update(); return; }
  const R = radiusForProgress(progress);
  // slowly orbit + gently descend toward edge-on near the hole
  const az = time * 0.06 + progress * 1.4;
  const elev = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(20, 7, progress));
  const ce = Math.cos(elev);
  camera.position.set(
    R * ce * Math.cos(az),
    R * Math.sin(elev) + (1 - progress) * 0.0,
    R * ce * Math.sin(az)
  );
  camera.lookAt(0, 0, 0);
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

function fmtCount(n) {
  if (n === 0) return "off";
  if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.00$/, "") + "M";
  if (n >= 1e3) return Math.round(n / 1e3) + "K";
  return String(n);
}

function updateHUD(fps) {
  hud.fps.textContent = fps.toFixed(0);
  hud.particles.textContent = fmtCount(particles.count);
  const r = camera.position.length();
  hud.radius.textContent = r.toFixed(2);
  const stage = STAGES[currentStage] || STAGES[0];
  hud.stage.textContent = stage.label;
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
  if (params.freeOrbit) return;
  nudgeProgress(e.deltaY * 0.00035);
}, { passive: true });

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") nudgeProgress(0.04);
  else if (e.key === "ArrowLeft") nudgeProgress(-0.04);
  else if (e.code === "Space") {
    e.preventDefault();
    autoCruise = !autoCruise;
    toast(autoCruise ? "Auto-cruise engaged" : "Auto-cruise paused");
  }
});

// drag the journey bar
const track = document.querySelector(".journey-track");
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
  const el = document.getElementById(id);
  const lbl = document.getElementById(valId);
  el.addEventListener("input", () => { const v = parseFloat(el.value); lbl.textContent = fmt(v); set(v); });
  lbl.textContent = fmt(parseFloat(el.value));
}
bindRange("c-mass", "v-mass", v => v.toFixed(2) + " M", v => { params.mass = v; applyDisk(); });
bindRange("c-spin", "v-spin", v => v.toFixed(3), v => { params.spin = v; applyDisk(); });
bindRange("c-bright", "v-bright", v => v.toFixed(2), v => {
  params.bright = v; lensing.uniforms.uBright.value = v; particles.setBright(v); jets.setBright(v);
});
bindRange("c-steps", "v-steps", v => String(v | 0), v => { params.steps = v; lensing.uniforms.uSteps.value = v; });
bindRange("c-count", "v-count", v => fmtCount((PARTICLE_PRESETS[v] || 0) ** 2), v => rebuildParticles(v | 0));

document.getElementById("c-doppler").addEventListener("change", (e) => {
  params.doppler = e.target.checked; lensing.uniforms.uDoppler.value = e.target.checked ? 1 : 0;
});
document.getElementById("c-jets").addEventListener("change", (e) => {
  params.jets = e.target.checked; jets.visible = e.target.checked;
});
document.getElementById("c-ergo").addEventListener("change", (e) => {
  params.ergo = e.target.checked; ergo.visible = e.target.checked;
  if (e.target.checked) toast("Ergosphere: region where space itself is dragged");
});
document.getElementById("c-orbit").addEventListener("change", (e) => {
  params.freeOrbit = e.target.checked;
  controls.enabled = e.target.checked;
  if (e.target.checked) { controls.target.set(0, 0, 0); controls.update(); toast("Free orbit — drag to look, scroll to zoom"); }
  else toast("Guided descent resumed");
});
document.getElementById("toggle-dock").addEventListener("click", () => {
  document.getElementById("dock").classList.toggle("collapsed");
});

function rebuildParticles(index) {
  particleScene.remove(particles.points);
  particles.points.geometry.dispose();
  particles.points.material.dispose();
  particles = createParticles(renderer, index);
  particleScene.add(particles.points);
  particles.setBright(params.bright);
  applyDisk();
  particles.visible = particles.count > 0;
}

// ---------- UI build ----------
buildUI(jumpToStage);

// ---------- loader / enter ----------
const loader = document.getElementById("loader");
const enterBtn = document.getElementById("enter-btn");
const loaderStatus = document.getElementById("loader-status");
const bootMsgs = [
  "Initializing WebGL2 context…",
  "Compiling photon-geodesic shader…",
  "Seeding 262,144 accretion particles…",
  "Solving Schwarzschild metric…",
  "Calibrating ISCO at 3 Rₛ…",
  "Ready.",
];
let boot = 0;
const bootTimer = setInterval(() => {
  loaderStatus.textContent = bootMsgs[boot];
  if (++boot >= bootMsgs.length) { clearInterval(bootTimer); enterBtn.classList.add("ready"); }
}, 420);

let started = false;
enterBtn.addEventListener("click", () => {
  if (started) return;
  started = true;
  loader.classList.add("hidden");
  autoCruise = true;
  toast("Welcome. Scroll or use ← → to fly. Space toggles auto-cruise.");
});

// ---------- resize ----------
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  lensing.uniforms.uResolution.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
}
window.addEventListener("resize", onResize);
onResize();

// ---------- render loop ----------
const clock = new THREE.Clock();
let fpsEMA = 60, frame = 0;
const right = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3();

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  // smooth progress + auto cruise
  if (autoCruise && !params.freeOrbit) {
    targetProgress += dt * 0.045;
    if (targetProgress >= 1) targetProgress = 0;   // endless dive
  }
  progress += (targetProgress - progress) * Math.min(1, dt * 3.2);
  journeyFill.style.width = (progress * 100).toFixed(1) + "%";
  refreshStage();

  updateJourneyCamera(dt, time);

  // physics step
  if (particles.count > 0) particles.step(dt * 1.0, time);
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

  // render: lensed background, then additive particles
  renderer.clear();
  renderer.render(lensing.scene, lensing.camera);
  renderer.render(particleScene, camera);

  // HUD
  frame++;
  const fps = 1 / Math.max(1e-4, dt);
  fpsEMA += (fps - fpsEMA) * 0.08;
  if (frame % 8 === 0) updateHUD(fpsEMA);

  requestAnimationFrame(tick);
}
tick();

// expose for debugging
window.__sing = { params, lensing, get particles() { return particles; }, camera };
