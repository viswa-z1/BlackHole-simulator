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
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { createLensing } from "./lensing.js";
import { createJets, createErgosphere } from "./extras.js";
import { createShip } from "./ship.js";
import { createAudio } from "./audio.js";
import { portraitDataURL } from "./portraits.js";
import { createCosmos } from "./cosmos.js";
import { buildUI, STAGES, toast, openObjectByName, recordObjectView, getViewedCount, getRecentlyViewed, openRecentlyViewed, cosmosEntityHasCatalogMatch, compareCosmosEntity, unlockAchievement, getCatalogFavorites } from "./ui.js";
import { ALL_OBJECTS } from "./data.js";
import { ANOMALIES } from "./cosmos-data.js";
// ---------- renderer ----------
const canvas = document.getElementById("scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // heavy per-pixel ray-marcher
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping; // filmic HDR -> LDR
renderer.toneMappingExposure = 1.0;
let reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
jets.visible = false; // off by default — match the clean Gargantua look
scene.add(jets.group);
const ergo = createErgosphere();
scene.add(ergo.mesh);
// ---------- lighting + exploration craft ----------
// the disk is the light source: a warm point light at the hole rim-lights the
// ship's inner face and leaves the far side dark → natural silhouette.
scene.add(new THREE.HemisphereLight(0x2a4070, 0x05060c, 0.55));
const diskLight = new THREE.PointLight(0xffb060, 3.0, 140, 1.2);
scene.add(diskLight);
// image-based lighting so the ship's metal reflects realistically (PBR)
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
const ship = createShip();
scene.add(ship.group);
scene.add(ship.trail);
// ---------- HDR post-processing: bloom + filmic tone mapping ----------
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
// ---------- Cosmos page (a separate explorable universe) ----------
const cosmos = createCosmos(renderer);
let page = "bh"; // "bh" (black hole) | "cosmos"
// smooth cross-fade around the scene swap (Vercel-style page transition)
const pageFade = document.getElementById("page-fade");
function crossfade(swap) {
    pageFade?.classList.add("show");
    setTimeout(() => { swap(); setTimeout(() => pageFade?.classList.remove("show"), 90); }, 240);
}
function enterCosmos() {
    if (page === "cosmos")
        return;
    page = "cosmos";
    cosmos.enter();
    crossfade(() => { renderPass.scene = cosmos.scene; renderPass.camera = cosmos.camera; });
    document.body.classList.add("page-cosmos");
    document.querySelector('.nav-pills button[data-view="sim"]')?.classList.remove("active");
    document.getElementById("nav-cosmos").classList.add("active");
    // reset the filter bar UI to "All" to match the freshly-reset visibility
    const bar = document.getElementById("cosmos-filter");
    bar?.querySelectorAll(".cfilter").forEach((b, i) => b.classList.toggle("active", i === 0));
    setHash("cosmos");
    toast("The cosmos — drag to look, scroll to dive deeper.");
}
function exitCosmos() {
    if (page !== "cosmos")
        return;
    page = "bh";
    cosmos.leave();
    crossfade(() => { renderPass.scene = scene; renderPass.camera = camera; });
    document.body.classList.remove("page-cosmos");
    document.getElementById("nav-cosmos").classList.remove("active");
    document.getElementById("cosmos-card")?.classList.remove("open");
    document.getElementById("cosmos-label")?.classList.remove("show");
    document.body.style.cursor = "";
    cosmos.spotlight(-1);
    tour = false;
    document.getElementById("cos-tour")?.classList.remove("active");
    const tourBtn = document.getElementById("cos-tour");
    if (tourBtn)
        tourBtn.textContent = "▶ Auto-tour";
    setHash("");
}
// ---------- shareable deep links via the URL hash ----------
function setHash(v) { try {
    history.replaceState(null, "", v ? "#" + v : location.pathname + location.search);
}
catch (e) { } }
function applyHash() {
    const h = location.hash.slice(1).toLowerCase();
    if (h === "cosmos")
        enterCosmos();
    else if (h.startsWith("cosmos/")) {
        enterCosmos();
        const idx = parseInt(h.slice(7), 10);
        if (!isNaN(idx))
            setTimeout(() => showAnomaly(idx), 420);
    }
    else if (h === "catalog")
        document.querySelector('.nav-pills button[data-view="catalog"]')?.click();
    else if (h.startsWith("object/")) {
        document.querySelector('.nav-pills button[data-view="catalog"]')?.click();
        const name = decodeURIComponent(location.hash.slice(8)); // preserve original casing
        if (!openObjectByName(name))
            toast("That object isn't in the catalog.");
    }
    else if (h === "anatomy")
        document.querySelector('.nav-pills button[data-view="features"]')?.click();
}
window.addEventListener("hashchange", applyHash);
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.7, // strength — lush Interstellar glow
0.6, // radius
0.9 // luminance threshold — the gold disk + photon ring bloom
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
let progress = 0; // 0..1
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
    return 0.7 + 39.3 * Math.pow(1 - p, 2.2); // 40 Rs -> 0.7 Rs
}
const _camTarget = new THREE.Vector3();
function updateJourneyCamera(dt, time) {
    if (params.freeOrbit) {
        controls.update();
        return;
    }
    const R = radiusForProgress(progress);
    const az = time * 0.06 + progress * 1.4;
    const elev = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(7, 4.5, progress));
    const ce = Math.cos(elev);
    _camTarget.set(R * ce * Math.cos(az), R * Math.sin(elev), R * ce * Math.sin(az));
    // smooth follow → eases the hand-off from explore mode and softens the dive
    camera.position.lerp(_camTarget, 1 - Math.pow(0.0015, dt));
    // gravitational turbulence: multi-frequency shake building toward the horizon
    if (!reduceMotion) {
        const shake = THREE.MathUtils.clamp((progress - 0.78) / 0.2, 0, 1) * 0.05;
        if (shake > 0.001) {
            const t = time * 31;
            camera.position.x += (Math.sin(t) + 0.5 * Math.sin(t * 2.7)) * shake;
            camera.position.y += (Math.cos(t * 1.3) + 0.5 * Math.sin(t * 3.1)) * shake;
        }
    }
    camera.lookAt(0, 0, 0);
}
// ---------- ship choreography (leads the camera toward the hole) ----------
const _shipPos = new THREE.Vector3();
function updateShip(dt, time) {
    if (mode !== "journey") {
        ship.visible = false;
        ship.clearTrail();
        return;
    }
    ship.visible = true;
    const R = radiusForProgress(progress) * 0.62; // leads the camera toward the hole
    const az = time * 0.06 + progress * 1.4 + 0.22; // off to one side of frame
    const elev = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(9, 5, progress));
    const ce = Math.cos(elev);
    _shipPos.set(R * ce * Math.cos(az), R * Math.sin(elev) - 0.5, R * ce * Math.sin(az));
    ship.group.position.copy(_shipPos);
    // nose (−z) toward the hole: point +z radially outward
    ship.group.lookAt(_shipPos.x * 2, _shipPos.y * 2, _shipPos.z * 2);
    ship.group.rotation.z += Math.sin(time * 0.7) * 0.12; // gentle bank
    // swallowed by the horizon near the end
    const fade = 1 - THREE.MathUtils.clamp((progress - 0.82) / 0.12, 0, 1);
    ship.group.scale.setScalar(0.5 + fade * 0.32);
    ship.group.visible = fade > 0.02;
    if (ship.group.visible)
        ship.updateTrail(_shipPos);
    else
        ship.clearTrail();
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
    etaRow: document.getElementById("hud-eta-row"),
    eta: document.getElementById("hud-eta"),
};
if (hud.particles)
    hud.particles.textContent = "volumetric";
// frame-time sparkline (last ~120 frames)
const sparkCanvas = document.getElementById("hud-spark");
const sparkCtx = sparkCanvas?.getContext("2d");
const sparkBuf = new Float32Array(120);
let sparkI = 0;
function pushSpark(dt) { sparkBuf[sparkI++ % sparkBuf.length] = dt * 1000; }
function drawSpark() {
    if (!sparkCtx || !sparkCanvas)
        return;
    const W = sparkCanvas.width, H = sparkCanvas.height;
    sparkCtx.clearRect(0, 0, W, H);
    sparkCtx.strokeStyle = "rgba(120,150,220,0.25)";
    sparkCtx.beginPath();
    sparkCtx.moveTo(0, H - (16.7 / 50) * H);
    sparkCtx.lineTo(W, H - (16.7 / 50) * H);
    sparkCtx.stroke(); // 60fps line
    sparkCtx.strokeStyle = "#4db5ff";
    sparkCtx.lineWidth = 1;
    sparkCtx.beginPath();
    for (let i = 0; i < sparkBuf.length; i++) {
        const v = sparkBuf[(sparkI + i) % sparkBuf.length];
        const y = H - Math.min(1, v / 50) * H;
        const x = (i / (sparkBuf.length - 1)) * W;
        i ? sparkCtx.lineTo(x, y) : sparkCtx.moveTo(x, y);
    }
    sparkCtx.stroke();
}
function updateHUD(fps) {
    drawSpark();
    hud.fps.textContent = fps.toFixed(0);
    const r = camera.position.length();
    hud.radius.textContent = r.toFixed(2);
    hud.stage.textContent = mode === "explore" ? "Explore" : (STAGES[currentStage] || STAGES[0]).label;
    if (hud.etaRow) {
        if (mode !== "journey") {
            hud.etaRow.style.display = "none";
        }
        else {
            hud.etaRow.style.display = "";
            const rate = 0.045 * params.timeScale; // progress units per real second, matches tick()'s auto-cruise advance
            if (!autoCruise || rate <= 0.0001 || progress >= 0.999) {
                hud.eta.textContent = progress >= 0.999 ? "arriving" : "paused";
            }
            else {
                hud.eta.textContent = formatStatsTime((1 - progress) / rate);
            }
        }
    }
    if (r > 1.0001) {
        const fac = 1 / Math.sqrt(1 - 1 / r);
        hud.dilation.textContent = fac > 50 ? "∞" : fac.toFixed(2) + "×";
        hud.redshift.textContent = (fac - 1) > 50 ? "∞" : (fac - 1).toFixed(2);
    }
    else {
        hud.dilation.textContent = "∞";
        hud.redshift.textContent = "∞";
    }
    let zone = "";
    if (r < 1.0)
        zone = "⚠ BEYOND THE HORIZON";
    else if (r < 1.5)
        zone = "⚠ INSIDE PHOTON SPHERE";
    else if (r < iscoRs(params.spin))
        zone = "⚠ INSIDE ISCO — NO STABLE ORBIT";
    hud.zone.textContent = zone;
}
// ---------- stage captions ----------
const stageEl = document.getElementById("stage");
const stageName = stageEl.querySelector(".stage-name");
const stageDesc = stageEl.querySelector(".stage-desc");
function stageForProgress(p) {
    let idx = 0;
    for (let i = 0; i < STAGES.length; i++)
        if (p >= STAGES[i].t - 0.001)
            idx = i;
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
    if (document.querySelector(".panel.open"))
        return;
    if (page === "cosmos") {
        stopTourForManualControl();
        cosmos.addZoom(e.deltaY * 0.0006);
        return;
    }
    if (params.freeOrbit)
        return;
    nudgeProgress(e.deltaY * 0.00035);
}, { passive: true });
window.addEventListener("keydown", (e) => {
    if (document.querySelector(".panel.open"))
        return;
    if ((e.key === "h" || e.key === "H") && !e.metaKey && !e.ctrlKey) {
        const hidden = document.body.classList.toggle("hud-hidden");
        toast(hidden ? "Telemetry hidden — press H to restore" : "Telemetry shown");
        return;
    }
    if (page === "cosmos") { // WASD / arrows fly the cosmos
        const k = e.key.toLowerCase();
        if (k === "arrowleft" || k === "a")
            cosmos.panBy(-0.14, 0);
        else if (k === "arrowright" || k === "d")
            cosmos.panBy(0.14, 0);
        else if (k === "arrowup" || k === "w")
            cosmos.addZoom(0.06);
        else if (k === "arrowdown" || k === "s")
            cosmos.addZoom(-0.06);
        else if (k === "q")
            cosmos.panBy(0, 0.14);
        else if (k === "e")
            cosmos.panBy(0, -0.14);
        else if (k === "r") {
            cosmos.reset();
            toast("View recentered");
        }
        else if (k === "g") {
            toast(cosmos.toggleGrid() ? "Reference grid on" : "Reference grid off");
        }
        else if (k >= "1" && k <= "9")
            showAnomaly(+k - 1); // jump to entity N
        return;
    }
    if (e.key === "ArrowRight")
        nudgeProgress(0.04);
    else if (e.key === "ArrowLeft")
        nudgeProgress(-0.04);
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") { // step between journey stages
        e.preventDefault();
        const idx = stageForProgress(progress) + (e.key === "ArrowUp" ? 1 : -1);
        const s = STAGES[THREE.MathUtils.clamp(idx, 0, STAGES.length - 1)];
        autoCruise = false;
        targetProgress = s.t;
        toast(`Stage: ${s.name}`);
    }
    else if (e.code === "Space") {
        e.preventDefault();
        autoCruise = !autoCruise;
        toast(autoCruise ? "Auto-cruise engaged" : "Auto-cruise paused");
    }
    else if (e.key === "[" || e.key === "]" || e.key === "0") { // Time Flow quick keys
        const el = document.getElementById("c-time");
        const v = e.key === "0" ? 1 : Math.max(0, Math.min(3, parseFloat(el.value) + (e.key === "]" ? 0.25 : -0.25)));
        el.value = String(v);
        el.dispatchEvent(new Event("input"));
        toast(`Time flow ${v.toFixed(2)}×`);
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
window.addEventListener("pointermove", (e) => { if (dragging)
    setFromBar(e.clientX); });
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
    params.bright = v;
    lensing.uniforms.uBright.value = v;
    jets.setBright(v);
});
bindRange("c-steps", "v-steps", v => String(v | 0), v => { params.steps = v; lensing.uniforms.uSteps.value = v; });
bindRange("c-time", "v-time", v => v.toFixed(2) + "×", v => { params.timeScale = v; });
bindRange("c-fov", "v-fov", v => (v | 0) + "°", v => { camera.fov = v; camera.updateProjectionMatrix(); });
bindRange("c-thick", "v-thick", v => v.toFixed(1) + "×", v => { lensing.uniforms.uDiskThick.value = v; });
bindRange("c-stars", "v-stars", v => v.toFixed(2) + "×", v => { lensing.uniforms.uStarBright.value = v; });
bindRange("c-ring", "v-ring", v => v.toFixed(2) + "×", v => { lensing.uniforms.uRingBright.value = v; });
bindRange("c-bloom", "v-bloom", v => v.toFixed(2), v => { bloomPass.strength = v; });
bindRange("c-vol", "v-vol", v => v.toFixed(2) + "×", v => { audio.setVolume(v); });
// ---------- randomize simulator parameters (mass, spin, brightness, spectrum) ----------
function randomizeParams() {
    const setRange = (id, v) => { const el = document.getElementById(id); el.value = String(v); el.dispatchEvent(new Event("input")); };
    setRange("c-mass", +(0.4 + Math.random() * 2.6).toFixed(2));
    setRange("c-spin", +(Math.random() * 0.998).toFixed(3));
    setRange("c-bright", +(Math.random() * 2.5).toFixed(2));
    document.querySelector(`#c-spectrum .sw[data-pal="${Math.floor(Math.random() * 5)}"]`)?.click();
    toast("Parameters randomized — a new black hole.");
}
document.getElementById("c-randomize")?.addEventListener("click", randomizeParams);
window.addEventListener("keydown", (e) => {
    if ((e.key === "r" || e.key === "R") && !e.metaKey && !e.ctrlKey && page !== "cosmos"
        && !document.querySelector(".panel.open, .detail-modal.open, .help-modal.open, input:focus, textarea:focus"))
        randomizeParams();
});
// real-object parameter presets
const PRESETS = {
    sgra: { mass: 1.6, spin: 0.90, pal: 0 }, m87: { mass: 2.6, spin: 0.94, pal: 4 },
    cyg: { mass: 0.7, spin: 0.97, pal: 1 }, ton: { mass: 3.0, spin: 0.50, pal: 2 },
    gw: { mass: 0.5, spin: 0.67, pal: 0 },
};
document.getElementById("c-preset")?.addEventListener("change", (e) => {
    const p = PRESETS[e.target.value];
    if (!p)
        return;
    const setR = (id, v) => { const el = document.getElementById(id); el.value = String(v); el.dispatchEvent(new Event("input")); };
    setR("c-mass", p.mass);
    setR("c-spin", p.spin);
    document.querySelector(`#c-spectrum .sw[data-pal="${p.pal}"]`)?.click();
    toast("Preset applied");
});
// quality presets (manual override of the adaptive scaler)
const QUALITY = {
    low: { pr: 1, steps: 90, bloom: 0.3 }, med: { pr: 1.25, steps: 140, bloom: 0.5 },
    high: { pr: 1.5, steps: 200, bloom: 0.7 }, ultra: { pr: Math.min(window.devicePixelRatio, 2), steps: 320, bloom: 0.95 },
};
document.getElementById("c-quality")?.addEventListener("change", (e) => {
    const q = QUALITY[e.target.value];
    if (!q) {
        perfPinned = false;
        perfTier = 2;
        toast("Adaptive quality on");
        return;
    } // back to auto
    renderer.setPixelRatio(q.pr);
    composer.setPixelRatio?.(q.pr);
    onResize();
    const steps = document.getElementById("c-steps");
    steps.value = String(q.steps);
    steps.dispatchEvent(new Event("input"));
    bloomPass.strength = q.bloom;
    perfPinned = true; // manual choice: adaptive scaler stands down
    toast("Quality set");
});
document.getElementById("c-doppler").addEventListener("change", (e) => {
    const on = e.target.checked;
    params.doppler = on;
    lensing.uniforms.uDoppler.value = on ? 1 : 0;
});
document.getElementById("c-jets").addEventListener("change", (e) => {
    const on = e.target.checked;
    params.jets = on;
    jets.visible = on;
});
document.getElementById("c-ergo").addEventListener("change", (e) => {
    const on = e.target.checked;
    params.ergo = on;
    ergo.visible = on;
    if (on)
        toast("Ergosphere: region where space itself is dragged");
});
document.getElementById("c-orbit").addEventListener("change", (e) => {
    const on = e.target.checked;
    params.freeOrbit = on;
    controls.enabled = on;
    if (on) {
        controls.target.set(0, 0, 0);
        controls.update();
        toast("Free orbit — drag to look, scroll to zoom");
    }
    else
        toast("Guided descent resumed");
});
document.getElementById("c-reduce-motion").checked = reduceMotion;
document.getElementById("c-reduce-motion")?.addEventListener("change", (e) => {
    reduceMotion = e.target.checked;
    controls.autoRotate = !reduceMotion && mode === "explore";
    toast(reduceMotion ? "Motion reduced — camera shake and auto-rotate off" : "Full motion restored");
});
document.getElementById("toggle-dock").addEventListener("click", () => {
    document.getElementById("dock").classList.toggle("collapsed");
});
document.getElementById("nav-cosmos").addEventListener("click", enterCosmos);
document.querySelector('.nav-pills button[data-view="sim"]').addEventListener("click", exitCosmos);
const cosmosLabel = document.getElementById("cosmos-label");
const cosmosCard = document.getElementById("cosmos-card");
let cosmosHover = null;
const KIND_TO_PORTRAIT = {
    "Black Hole": "supermassive", "Quasar": "quasar", "Pulsar": "pulsar",
    "Magnetar": "magnetar", "Neutron Star": "neutron", "Nebula": "supermassive",
    "Merger": "binary", "Wormhole": "supermassive",
};
// cosmos favorites (persisted), independent of the catalog's favorites
const COS_FAV_KEY = "singularity.cosmosFavs";
const cosmosFavs = new Set((() => { try {
    return JSON.parse(localStorage.getItem(COS_FAV_KEY) || "[]");
}
catch (e) {
    return [];
} })());
function saveCosmosFavs() { try {
    localStorage.setItem(COS_FAV_KEY, JSON.stringify([...cosmosFavs]));
}
catch (e) { } }
function openCosmosCard(d) {
    recordObjectView(d.name);
    cosmosCard.style.setProperty("--cc-accent", "#" + d.color.toString(16).padStart(6, "0"));
    const img = document.getElementById("cc-img");
    if (img) {
        img.src = portraitDataURL({ name: d.name, kind: KIND_TO_PORTRAIT[d.kind] || "stellar" }, 760, 380);
        img.alt = `Rendered figure of ${d.name}`;
    }
    document.getElementById("cc-kind").textContent = d.kind;
    document.getElementById("cc-name").textContent = d.name;
    document.getElementById("cc-dist").textContent = "Distance · " + d.dist;
    document.getElementById("cc-blurb").textContent = d.blurb;
    const favBtn = document.getElementById("cc-fav");
    if (favBtn) {
        favBtn.textContent = cosmosFavs.has(d.name) ? "★" : "☆";
        favBtn.classList.toggle("on", cosmosFavs.has(d.name));
    }
    const compareBtn = document.getElementById("cc-compare");
    if (compareBtn)
        compareBtn.style.display = cosmosEntityHasCatalogMatch(d.name) ? "" : "none";
    cosmosCard.classList.add("open");
}
document.getElementById("cc-compare")?.addEventListener("click", () => {
    const name = document.getElementById("cc-name").textContent;
    if (name)
        compareCosmosEntity(name);
});
document.getElementById("cc-fav")?.addEventListener("click", () => {
    const name = document.getElementById("cc-name").textContent;
    if (!name)
        return;
    cosmosFavs.has(name) ? cosmosFavs.delete(name) : cosmosFavs.add(name);
    saveCosmosFavs();
    if (cosmosFavs.size >= 5)
        unlockAchievement("collector");
    const favBtn = document.getElementById("cc-fav");
    favBtn.textContent = cosmosFavs.has(name) ? "★" : "☆";
    favBtn.classList.toggle("on", cosmosFavs.has(name));
    refreshCosmosFavCount();
    toast(cosmosFavs.has(name) ? `${name} added to cosmos favorites` : `${name} removed from favorites`);
});
document.getElementById("cc-link")?.addEventListener("click", () => {
    const url = location.href; // showAnomaly() keeps the hash in sync, so this already points at the open entity
    navigator.clipboard?.writeText(url).then(() => toast("Link to this entity copied to clipboard."), () => toast(url));
});
let cardIndex = 0;
function showAnomaly(i) {
    const n = cosmos.anomalies.length;
    cardIndex = ((i % n) + n) % n;
    openCosmosCard(cosmos.focus(cardIndex)); // focus() centres + returns the data
    cosmos.spotlight(cardIndex); // dim the rest for focus
    setHash("cosmos/" + cardIndex); // shareable deep link to this entity
}
function stepAnomaly(dir) {
    const n = cosmos.anomalies.length;
    let i = cardIndex;
    for (let k = 0; k < n; k++) {
        i = ((i + dir) % n + n) % n;
        if (cosmos.anomalies[i].group.visible) {
            showAnomaly(i);
            return;
        }
    }
}
document.getElementById("cc-prev")?.addEventListener("click", () => stepAnomaly(-1));
document.getElementById("cc-next")?.addEventListener("click", () => stepAnomaly(1));
document.getElementById("cos-random")?.addEventListener("click", () => showAnomaly(Math.floor(Math.random() * cosmos.anomalies.length)));
document.getElementById("cos-zoom-in")?.addEventListener("click", () => cosmos.addZoom(0.08));
document.getElementById("cos-zoom-out")?.addEventListener("click", () => cosmos.addZoom(-0.08));
// cosmos entity search (datalist + Enter/pick jumps to the match)
(function wireCosmosSearch() {
    const input = document.getElementById("cosmos-search");
    const list = document.getElementById("cosmos-entities");
    if (!input || !list)
        return;
    list.innerHTML = cosmos.anomalies.map((a) => `<option value="${a.data.name}"></option>`).join("");
    const jump = () => {
        const q = input.value.trim().toLowerCase();
        if (!q)
            return;
        const i = cosmos.anomalies.findIndex((a) => a.data.name.toLowerCase().includes(q));
        if (i >= 0) {
            showAnomaly(i);
            input.blur();
        }
        else
            toast("No entity matches that name.");
    };
    input.addEventListener("change", jump);
    input.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter")
        jump(); });
})();
// cosmos kind-filter chips
(function buildCosmosFilter() {
    const bar = document.getElementById("cosmos-filter");
    if (!bar)
        return;
    const kinds = ["All", ...cosmos.kinds()];
    const countFor = (k) => k === "All" ? cosmos.anomalies.length : cosmos.anomalies.filter((a) => a.data.kind === k).length;
    bar.innerHTML = kinds.map((k, i) => `<button class="cfilter${i === 0 ? " active" : ""}" data-kind="${k === "All" ? "" : k}">${k}<i>${countFor(k)}</i></button>`).join("")
        + `<button class="cfilter cfilter-fav" data-kind="__fav__">★<i id="cos-fav-count">${cosmosFavs.size}</i></button>`;
    bar.querySelectorAll(".cfilter").forEach(b => b.addEventListener("click", () => {
        bar.querySelectorAll(".cfilter").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        const kind = b.dataset.kind;
        if (kind === "__fav__")
            cosmos.filterNames(cosmosFavs.size ? cosmosFavs : new Set());
        else
            cosmos.filterKind(kind);
    }));
})();
function refreshCosmosFavCount() { const el = document.getElementById("cos-fav-count"); if (el)
    el.textContent = String(cosmosFavs.size); }
cosmosCard.querySelector("[data-cosmos-close]").addEventListener("click", () => { cosmosCard.classList.remove("open"); cosmos.spotlight(-1); });
// ---------- cosmos auto-tour ----------
let tour = false, tourI = 0, tourT = 0;
document.getElementById("cos-tour")?.addEventListener("click", () => {
    tour = !tour;
    tourT = 0;
    tourI = 0;
    document.getElementById("cos-tour")?.classList.toggle("active", tour);
    if (tour) {
        openCosmosCard(cosmos.focus(0));
        updateTourLabel();
    }
    else {
        cosmosCard.classList.remove("open");
        updateTourLabel();
    }
    toast(tour ? "Auto-tour started — sit back and drift." : "Auto-tour stopped");
});
function stopTourForManualControl() {
    if (!tour)
        return;
    tour = false;
    document.getElementById("cos-tour")?.classList.remove("active");
    updateTourLabel();
    toast("Auto-tour paused — you have the controls.");
}
canvas.addEventListener("pointerdown", () => { if (page === "cosmos")
    stopTourForManualControl(); });
function updateTourLabel() {
    const btn = document.getElementById("cos-tour");
    if (!btn)
        return;
    btn.textContent = tour
        ? `◼ ${tourI + 1} / ${cosmos.anomalies.length} · ${cosmos.anomalies[tourI].data.name}`
        : "▶ Auto-tour";
}
canvas.addEventListener("click", (e) => {
    if (page !== "cosmos")
        return;
    const hit = cosmos.pick((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    if (hit)
        showAnomaly(cosmos.anomalies.indexOf(hit));
});
// ---------- star map (top-down minimap of the cosmos) ----------
const mapCanvas = document.getElementById("cosmos-map-canvas");
const mapCtx = mapCanvas.getContext("2d");
const MAP_W = 220, MAP_H = 220;
function worldToMap(x, z) {
    return [((x + 1100) / 2200) * MAP_W, ((z + 2900) / 3200) * MAP_H];
}
mapCanvas.addEventListener("click", (e) => {
    const r = mapCanvas.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * MAP_W, my = ((e.clientY - r.top) / r.height) * MAP_H;
    // clicking a dot displays that entity; clicking empty space dives to that depth
    let bi = -1, bd = 11;
    cosmos.anomalies.forEach((a, i) => { const [ax, ay] = worldToMap(a.group.position.x, a.group.position.z); const d = Math.hypot(ax - mx, ay - my); if (d < bd) {
        bd = d;
        bi = i;
    } });
    if (bi >= 0)
        showAnomaly(bi);
    else {
        cosmos.flyToZ((my / MAP_H) * 3200 - 2900);
        toast("Diving toward that region…");
    }
});
// collapse / expand the star map
document.getElementById("map-collapse")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const map = document.getElementById("cosmos-map");
    const collapsed = map.classList.toggle("collapsed");
    e.target.textContent = collapsed ? "+" : "–";
    e.target.title = collapsed ? "Expand map" : "Collapse map";
});
// hover the star map to label the nearest anomaly dot
mapCanvas.addEventListener("mousemove", (e) => {
    const r = mapCanvas.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * MAP_W, my = ((e.clientY - r.top) / r.height) * MAP_H;
    let best = null, bd = 9;
    for (const a of cosmos.anomalies) {
        const [ax, ay] = worldToMap(a.group.position.x, a.group.position.z);
        const d = Math.hypot(ax - mx, ay - my);
        if (d < bd) {
            bd = d;
            best = a;
        }
    }
    const lbl = document.getElementById("cosmos-label");
    if (best) {
        lbl.innerHTML = `<b>${best.data.name}</b><span>${best.data.kind}</span>`;
        lbl.style.left = e.clientX + "px";
        lbl.style.top = e.clientY + "px";
        lbl.classList.add("show");
    }
    else
        lbl.classList.remove("show");
});
mapCanvas.addEventListener("mouseleave", () => document.getElementById("cosmos-label").classList.remove("show"));
const cosDepth = document.getElementById("cos-depth");
const cosZoom = document.getElementById("cos-zoom");
document.getElementById("cos-count").textContent = String(cosmos.anomalies.length);
const cosNear = document.getElementById("cos-near");
function updateCosmosHUD() {
    const z = cosmos.zoom;
    cosDepth.textContent = (z * 4.2).toFixed(2) + " Bly";
    let best = null, bd = Infinity;
    for (const a of cosmos.anomalies) {
        const d = a.group.position.distanceTo(cosmos.camera.position);
        if (d < bd) {
            bd = d;
            best = a;
        }
    }
    if (cosNear)
        cosNear.textContent = best ? best.data.name : "—";
    cosZoom.textContent = Math.round(z * 100) + "%";
}
function drawCosmosMap() {
    mapCtx.clearRect(0, 0, MAP_W, MAP_H);
    mapCtx.fillStyle = "rgba(8,11,24,0.55)";
    mapCtx.fillRect(0, 0, MAP_W, MAP_H);
    mapCtx.strokeStyle = "rgba(120,150,220,0.12)";
    mapCtx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
        const g = (i / 4) * MAP_H;
        mapCtx.beginPath();
        mapCtx.moveTo(0, g);
        mapCtx.lineTo(MAP_W, g);
        mapCtx.stroke();
    }
    const selected = cosmosCard.classList.contains("open") ? cardIndex : -1;
    cosmos.anomalies.forEach((a, i) => {
        const [mx, my] = worldToMap(a.group.position.x, a.group.position.z);
        const col = "#" + a.data.color.toString(16).padStart(6, "0");
        mapCtx.fillStyle = col;
        mapCtx.beginPath();
        mapCtx.arc(mx, my, i === selected ? 4.5 : 3, 0, 7);
        mapCtx.fill();
        if (i === selected) {
            mapCtx.strokeStyle = col;
            mapCtx.lineWidth = 1.5;
            mapCtx.beginPath();
            mapCtx.arc(mx, my, 8, 0, 7);
            mapCtx.stroke();
        }
    });
    const [cx, cy] = worldToMap(cosmos.camera.position.x, cosmos.camera.position.z);
    mapCtx.strokeStyle = "#fff";
    mapCtx.lineWidth = 1.5;
    mapCtx.beginPath();
    mapCtx.arc(cx, cy, 4, 0, 7);
    mapCtx.stroke();
    mapCtx.strokeStyle = "rgba(255,255,255,0.35)";
    mapCtx.beginPath();
    mapCtx.moveTo(cx, cy);
    mapCtx.lineTo(cx - 9, cy - 16);
    mapCtx.moveTo(cx, cy);
    mapCtx.lineTo(cx + 9, cy - 16);
    mapCtx.stroke();
}
window.addEventListener("pointermove", (e) => {
    if (page !== "cosmos")
        return;
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = (e.clientY / window.innerHeight) * 2 - 1;
    cosmos.setPointer(nx, ny);
    cosmosHover = cosmos.pick(nx, -ny); // raycaster NDC has y up
    if (cosmosHover) {
        const d = cosmosHover.data;
        cosmosLabel.innerHTML = `<b>${d.name}</b><span>${d.kind} · ${d.dist}</span>`;
        cosmosLabel.style.left = e.clientX + "px";
        cosmosLabel.style.top = e.clientY + "px";
        cosmosLabel.classList.add("show");
        document.body.style.cursor = "pointer";
    }
    else {
        cosmosLabel.classList.remove("show");
        document.body.style.cursor = "";
    }
});
// ---------- frame capture (download the current view as a PNG) ----------
let captureRequested = false;
let capturePreviewTimer = null;
function showCapturePreview(dataUrl) {
    const wrap = document.getElementById("capture-preview");
    const img = document.getElementById("capture-preview-img");
    if (!wrap || !img)
        return;
    img.src = dataUrl;
    wrap.classList.add("show");
    clearTimeout(capturePreviewTimer);
    capturePreviewTimer = setTimeout(() => wrap.classList.remove("show"), 4500);
}
document.getElementById("capture-preview")?.addEventListener("click", () => {
    const img = document.getElementById("capture-preview-img");
    if (img?.src)
        window.open(img.src, "_blank");
});
function saveFrame(dest) {
    try {
        const previewUrl = renderer.domElement.toDataURL("image/png");
        showCapturePreview(previewUrl);
        if (dest === "clipboard" && navigator.clipboard && window.ClipboardItem) {
            renderer.domElement.toBlob((blob) => {
                if (!blob) {
                    toast("Couldn't capture this frame.");
                    return;
                }
                navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]).then(() => toast("Frame copied to your clipboard."), () => toast("Clipboard blocked — press P to download instead."));
            }, "image/png");
        }
        else {
            const a = document.createElement("a");
            a.href = previewUrl;
            a.download = `singularity-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            toast("Frame saved to your downloads.");
        }
        document.body.classList.add("flash");
        setTimeout(() => document.body.classList.remove("flash"), 240);
    }
    catch (err) {
        toast("Couldn't capture this frame.");
    }
}
document.getElementById("tool-capture").addEventListener("click", () => { captureRequested = "download"; });
window.addEventListener("keydown", (e) => {
    if ((e.key === "p" || e.key === "P") && !e.metaKey && !e.ctrlKey)
        captureRequested = e.shiftKey ? "clipboard" : "download";
});
// ---------- copy share link ----------
document.getElementById("tool-share")?.addEventListener("click", () => {
    const url = location.href;
    navigator.clipboard?.writeText(url).then(() => toast("Share link copied to clipboard."), () => toast(url));
});
// ---------- "My Collection": catalog + cosmos favorites in one place ----------
const collectionModal = document.getElementById("collection-modal");
function renderCollection() {
    const catGrid = document.getElementById("collection-catalog-grid");
    const cosGrid = document.getElementById("collection-cosmos-grid");
    const catFavs = getCatalogFavorites();
    if (catGrid) {
        catGrid.innerHTML = catFavs.length
            ? catFavs.map(o => `<button class="collection-card" data-cat-name="${encodeURIComponent(o.name)}">${o.name}</button>`).join("")
            : `<span class="collection-empty">No catalog favorites yet — tap ☆ on any object.</span>`;
    }
    if (cosGrid) {
        const cosFavList = [...cosmosFavs].map(name => {
            const idx = ANOMALIES.findIndex((a) => a.name === name);
            return idx >= 0 ? { name, idx, color: ANOMALIES[idx].color } : null;
        }).filter(Boolean);
        cosGrid.innerHTML = cosFavList.length
            ? cosFavList.map(f => `<button class="collection-card" data-cos-idx="${f.idx}"><span class="cc-swatch" style="background:#${f.color.toString(16).padStart(6, "0")}"></span>${f.name}</button>`).join("")
            : `<span class="collection-empty">No cosmos favorites yet — tap ☆ on any figure card.</span>`;
    }
}
function toggleCollection(force) {
    const open = force !== undefined ? force : !collectionModal.classList.contains("open");
    collectionModal.classList.toggle("open", open);
    if (open)
        renderCollection();
}
document.getElementById("tool-collection")?.addEventListener("click", () => toggleCollection());
collectionModal?.querySelector("[data-collection-close]")?.addEventListener("click", () => toggleCollection(false));
collectionModal?.addEventListener("click", (e) => { if (e.target === collectionModal)
    toggleCollection(false); });
document.getElementById("collection-catalog-grid")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cat-name]");
    if (!btn)
        return;
    toggleCollection(false);
    document.querySelector('.nav-pills button[data-view="catalog"]')?.click();
    openObjectByName(decodeURIComponent(btn.dataset.catName));
});
document.getElementById("collection-cosmos-grid")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-cos-idx]");
    if (!btn)
        return;
    toggleCollection(false);
    location.hash = "cosmos/" + btn.dataset.cosIdx;
});
window.addEventListener("keydown", (e) => { if (e.key === "Escape")
    toggleCollection(false); });
// ---------- auto-immersion: fade the chrome when idle during the journey ----------
let idleTimer = null;
function pokeIdle() {
    document.body.classList.remove("ui-idle");
    clearTimeout(idleTimer);
    if (mode === "journey" && page === "bh" && !document.querySelector(".panel.open, .detail-modal.open, .help-modal.open")) {
        idleTimer = setTimeout(() => document.body.classList.add("ui-idle"), 4000);
    }
}
["pointermove", "pointerdown", "keydown", "wheel"].forEach(ev => window.addEventListener(ev, pokeIdle, { passive: true }));
// ---------- fullscreen ----------
function toggleFullscreen() {
    if (!document.fullscreenElement)
        document.documentElement.requestFullscreen?.();
    else
        document.exitFullscreen?.();
}
document.getElementById("tool-fs")?.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", () => document.getElementById("tool-fs")?.classList.toggle("active", !!document.fullscreenElement));
window.addEventListener("keydown", (e) => {
    if ((e.key === "f" || e.key === "F") && !e.metaKey && !e.ctrlKey && !document.querySelector(".panel.open"))
        toggleFullscreen();
});
// ---------- session stats (time explored, deepest dive, objects viewed) ----------
const STATS_KEY = "singularity.stats.session";
const sessionStats = (() => {
    try {
        const s = JSON.parse(localStorage.getItem(STATS_KEY) || "null");
        return s && typeof s === "object" ? s : {};
    }
    catch (e) {
        return {};
    }
})();
let statsTime = sessionStats.time || 0;
let statsDepth = sessionStats.depth || 0;
function saveSessionStats() { try {
    localStorage.setItem(STATS_KEY, JSON.stringify({ time: statsTime, depth: statsDepth }));
}
catch (e) { } }
function formatStatsTime(sec) {
    const m = Math.floor(sec / 60), h = Math.floor(m / 60);
    if (h > 0)
        return `${h}h ${m % 60}m`;
    if (m > 0)
        return `${m}m ${Math.floor(sec % 60)}s`;
    return `${Math.floor(sec)}s`;
}
window.addEventListener("pagehide", saveSessionStats);
function updateStatsDisplay() {
    const t = document.getElementById("stat-time"), d = document.getElementById("stat-depth"), v = document.getElementById("stat-viewed");
    if (t)
        t.textContent = formatStatsTime(statsTime);
    if (d)
        d.textContent = statsDepth.toFixed(2) + " Bly";
    if (v)
        v.textContent = String(getViewedCount());
    const list = document.getElementById("help-recent-list");
    if (list) {
        const recent = getRecentlyViewed();
        list.innerHTML = recent.length
            ? recent.map(name => `<button data-recent-name="${encodeURIComponent(name)}">${name}</button>`).join("")
            : `<span class="help-recent-empty">Nothing viewed yet — open an object from the Catalog or Cosmos.</span>`;
    }
}
document.getElementById("help-recent-list")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-recent-name]");
    if (!btn)
        return;
    toggleHelp(false);
    openRecentlyViewed(decodeURIComponent(btn.dataset.recentName));
});
// ---------- help / shortcuts overlay ----------
const helpModal = document.getElementById("help-modal");
function toggleHelp(force) {
    const open = force !== undefined ? force : !helpModal.classList.contains("open");
    helpModal.classList.toggle("open", open);
    if (open)
        updateStatsDisplay();
}
document.getElementById("tool-help").addEventListener("click", () => toggleHelp());
helpModal.querySelector("[data-help-close]").addEventListener("click", () => toggleHelp(false));
helpModal.addEventListener("click", (e) => { if (e.target === helpModal)
    toggleHelp(false); });
window.addEventListener("keydown", (e) => {
    if (e.key === "?")
        toggleHelp();
    else if (e.key === "Escape")
        toggleHelp(false);
});
const cmdkItems = [
    { label: "Simulator", sub: "view", action: () => document.querySelector('.nav-pills button[data-view="sim"]')?.click() },
    { label: "Anatomy", sub: "view", action: () => document.querySelector('.nav-pills button[data-view="features"]')?.click() },
    { label: "Catalog", sub: "view", action: () => document.querySelector('.nav-pills button[data-view="catalog"]')?.click() },
    { label: "Cosmos", sub: "view", action: () => document.getElementById("nav-cosmos")?.click() },
    { label: "Controls", sub: "view", action: () => document.getElementById("toggle-dock")?.click() },
    { label: "Begin the Journey", sub: "action", action: () => document.getElementById("enter-btn")?.click() },
    { label: "Return home", sub: "action", action: () => document.getElementById("back-home")?.click() },
    { label: "Surprise me (random object)", sub: "action", action: () => document.getElementById("cat-random")?.click() },
    ...ALL_OBJECTS.map((o) => ({
        label: o.name, sub: (o.type || o.category || "catalog") + " · catalog",
        action: () => { location.hash = "object/" + encodeURIComponent(o.name); },
    })),
    ...ANOMALIES.map((a, i) => ({
        label: a.name, sub: a.kind + " · cosmos",
        action: () => { location.hash = "cosmos/" + i; },
    })),
];
const cmdkOverlay = document.getElementById("cmdk-overlay");
const cmdkInput = document.getElementById("cmdk-input");
const cmdkResults = document.getElementById("cmdk-results");
const cmdkEmpty = document.getElementById("cmdk-empty");
let cmdkMatches = [];
let cmdkActive = 0;
function renderCmdk() {
    const q = cmdkInput.value.trim().toLowerCase();
    cmdkMatches = (q ? cmdkItems.filter(it => it.label.toLowerCase().includes(q) || it.sub.toLowerCase().includes(q)) : cmdkItems).slice(0, 40);
    cmdkActive = 0;
    cmdkEmpty.classList.toggle("show", cmdkMatches.length === 0);
    cmdkResults.innerHTML = cmdkMatches.map((it, i) => `<div class="cmdk-item${i === 0 ? " active" : ""}" data-i="${i}"><span class="cmdk-label">${it.label}</span><span class="cmdk-sub">${it.sub}</span></div>`).join("");
}
function highlightCmdk() {
    cmdkResults.querySelectorAll(".cmdk-item").forEach((el, i) => el.classList.toggle("active", i === cmdkActive));
    cmdkResults.children[cmdkActive]?.scrollIntoView({ block: "nearest" });
}
function activateCmdk(i) {
    const it = cmdkMatches[i];
    if (!it)
        return;
    toggleCmdk(false);
    it.action();
}
function toggleCmdk(force) {
    const open = force !== undefined ? force : !cmdkOverlay.classList.contains("open");
    cmdkOverlay.classList.toggle("open", open);
    if (open) {
        cmdkInput.value = "";
        renderCmdk();
        setTimeout(() => cmdkInput.focus(), 10);
    }
    else
        cmdkInput.blur();
}
cmdkInput.addEventListener("input", renderCmdk);
cmdkResults.addEventListener("click", (e) => {
    const item = e.target.closest(".cmdk-item");
    if (item)
        activateCmdk(parseInt(item.dataset.i, 10));
});
cmdkOverlay.addEventListener("click", (e) => { if (e.target === cmdkOverlay)
    toggleCmdk(false); });
cmdkInput.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "ArrowDown") {
        e.preventDefault();
        cmdkActive = Math.min(cmdkActive + 1, cmdkMatches.length - 1);
        highlightCmdk();
    }
    else if (e.key === "ArrowUp") {
        e.preventDefault();
        cmdkActive = Math.max(cmdkActive - 1, 0);
        highlightCmdk();
    }
    else if (e.key === "Enter") {
        e.preventDefault();
        activateCmdk(cmdkActive);
    }
    else if (e.key === "Escape") {
        e.preventDefault();
        toggleCmdk(false);
    }
});
window.addEventListener("keydown", (e) => {
    if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleCmdk(true);
    }
});
// ---------- procedural ambient audio (swells near the horizon) ----------
const audio = createAudio();
function toggleAudio() {
    const on = audio.toggle();
    const btn = document.getElementById("tool-audio");
    btn.classList.toggle("active", on);
    btn.textContent = on ? "🔊" : "🔈";
    toast(on ? "Ambient audio on" : "Ambient audio muted");
}
document.getElementById("tool-audio").addEventListener("click", toggleAudio);
window.addEventListener("keydown", (e) => {
    if ((e.key === "m" || e.key === "M") && !e.metaKey && !e.ctrlKey && !document.querySelector(".panel.open, .detail-modal.open, .help-modal.open, input:focus"))
        toggleAudio();
});
// ---------- cinematic mode (hide chrome + letterbox) ----------
function toggleCinematic() {
    const on = document.body.classList.toggle("cinematic");
    document.getElementById("tool-cinema").classList.toggle("active", on);
    toast(on ? "Cinematic mode — press C to exit" : "Interface restored");
}
document.getElementById("tool-cinema").addEventListener("click", toggleCinematic);
window.addEventListener("keydown", (e) => {
    if ((e.key === "c" || e.key === "C") && !e.metaKey && !e.ctrlKey && !document.querySelector(".panel.open"))
        toggleCinematic();
});
// ---------- disk spectrum (color theme) ----------
const SPECTRUM_NAMES = ["Sagittarius Gold", "Cygnus Blue", "Quasar Violet", "Magnetar Ice", "Crimson Redshift"];
document.querySelectorAll("#c-spectrum .sw").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("#c-spectrum .sw").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    const p = +b.dataset.pal;
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
            fov: camera.fov,
            thick: lensing.uniforms.uDiskThick.value,
            stars: lensing.uniforms.uStarBright.value,
            ring: lensing.uniforms.uRingBright.value,
            bloom: bloomPass.strength,
            vol: parseFloat(document.getElementById("c-vol")?.value || "1"),
            orbit: params.freeOrbit,
            reduceMotion,
        }));
    }
    catch (e) { /* storage unavailable */ }
}
function loadPrefs() {
    let p;
    try {
        p = JSON.parse(localStorage.getItem(PREF_KEY) || "null");
    }
    catch (e) {
        return;
    }
    if (!p)
        return;
    const setRange = (id, v) => { const el = document.getElementById(id); if (el && v != null) {
        el.value = String(v);
        el.dispatchEvent(new Event("input"));
    } };
    const setCheck = (id, v) => { const el = document.getElementById(id); if (el && v != null && el.checked !== v) {
        el.checked = v;
        el.dispatchEvent(new Event("change"));
    } };
    setRange("c-mass", p.mass);
    setRange("c-spin", p.spin);
    setRange("c-bright", p.bright);
    setRange("c-steps", p.steps);
    setRange("c-time", p.timeScale);
    setRange("c-fov", p.fov);
    setRange("c-thick", p.thick);
    setRange("c-stars", p.stars);
    setRange("c-ring", p.ring);
    setRange("c-bloom", p.bloom);
    setRange("c-vol", p.vol);
    setCheck("c-doppler", p.doppler);
    setCheck("c-jets", p.jets);
    setCheck("c-ergo", p.ergo);
    setCheck("c-orbit", p.orbit);
    setCheck("c-reduce-motion", p.reduceMotion);
    if (p.palette != null)
        document.querySelector(`#c-spectrum .sw[data-pal="${p.palette}"]`)?.click();
}
["c-mass", "c-spin", "c-bright", "c-steps", "c-time", "c-fov", "c-thick", "c-stars", "c-ring", "c-bloom", "c-vol"]
    .forEach(id => document.getElementById(id)?.addEventListener("input", savePrefs));
["c-doppler", "c-jets", "c-ergo", "c-orbit", "c-reduce-motion"].forEach(id => document.getElementById(id)?.addEventListener("change", savePrefs));
document.getElementById("c-spectrum")?.addEventListener("click", () => setTimeout(savePrefs, 0));
// ---------- centralized list of every persisted-settings key ----------
// (kept in one place so reset/export/import can never silently drift apart)
const SETTINGS_KEYS = [
    "singularity.prefs.v1", "singularity.favs", "singularity.cosmosFavs",
    "singularity.seen", "singularity.uiaccent",
    "singularity.stats.viewed", "singularity.stats.session",
    "singularity.notes", "singularity.recent", "singularity.achievements",
];
// ---------- reset all saved settings ----------
let resetArmed = false;
document.getElementById("c-reset")?.addEventListener("click", (e) => {
    const btn = e.target;
    if (!resetArmed) { // two-step: arm, then confirm
        resetArmed = true;
        btn.textContent = "Tap again to confirm reset";
        btn.classList.add("armed");
        setTimeout(() => { resetArmed = false; btn.textContent = "Reset all settings"; btn.classList.remove("armed"); }, 3000);
        return;
    }
    try {
        SETTINGS_KEYS.forEach(k => localStorage.removeItem(k));
    }
    catch (err) { }
    location.reload();
});
// ---------- export / import settings as a JSON file ----------
document.getElementById("c-export")?.addEventListener("click", () => {
    const data = {};
    SETTINGS_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v !== null)
        data[k] = v; });
    const blob = new Blob([JSON.stringify({ app: "singularity", version: 1, exportedAt: new Date().toISOString(), data }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "singularity-settings.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Settings exported.");
});
document.getElementById("c-import")?.addEventListener("click", () => {
    document.getElementById("c-import-file")?.click();
});
document.getElementById("c-import-file")?.addEventListener("change", (e) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file)
        return;
    const reader = new FileReader();
    reader.onload = () => {
        try {
            const parsed = JSON.parse(String(reader.result));
            const data = parsed && typeof parsed === "object" && parsed.data && typeof parsed.data === "object" ? parsed.data : parsed;
            let count = 0;
            SETTINGS_KEYS.forEach(k => {
                if (data && Object.prototype.hasOwnProperty.call(data, k) && data[k] !== undefined) {
                    localStorage.setItem(k, typeof data[k] === "string" ? data[k] : JSON.stringify(data[k]));
                    count++;
                }
            });
            if (!count) {
                toast("That file doesn't contain any recognized settings.");
                return;
            }
            toast(`Imported ${count} setting${count === 1 ? "" : "s"} — reloading…`);
            setTimeout(() => location.reload(), 700);
        }
        catch (err) {
            toast("Couldn't read that settings file.");
        }
    };
    reader.readAsText(file);
    input.value = ""; // allow re-importing the same file later
});
// ---------- interface accent themes (persisted) ----------
const UI_ACCENTS = {
    ember: { name: "Ember", accent: "#ff9d3c", hot: "#ffd98a" },
    ice: { name: "Ice", accent: "#4db5ff", hot: "#a8dcff" },
    nova: { name: "Nova", accent: "#b79cff", hot: "#e2d4ff" },
};
function applyUIAccent(key, save = true) {
    const a = UI_ACCENTS[key];
    if (!a)
        return;
    document.documentElement.style.setProperty("--accent", a.accent);
    document.documentElement.style.setProperty("--hot", a.hot);
    const lbl = document.getElementById("v-uiaccent");
    if (lbl)
        lbl.textContent = a.name;
    document.querySelectorAll("#c-uiaccent .sw").forEach(b => b.classList.toggle("active", b.dataset.ui === key));
    if (save) {
        try {
            localStorage.setItem("singularity.uiaccent", key);
        }
        catch (e) { }
    }
}
document.querySelectorAll("#c-uiaccent .sw").forEach(b => b.addEventListener("click", () => applyUIAccent(b.dataset.ui)));
try {
    const saved = localStorage.getItem("singularity.uiaccent");
    if (saved)
        applyUIAccent(saved, false);
}
catch (e) { }
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
function runTips(delay = 1600) {
    const tips = [
        "Tip: drag to orbit the black hole.",
        "Scroll to zoom in and out.",
        "Press “Begin the Journey” to fall in.",
        "Or open the Cosmos to explore a universe.",
    ];
    tips.forEach((t, i) => setTimeout(() => toast(t), delay + i * 3200));
}
function firstVisitTips() {
    try {
        if (localStorage.getItem("singularity.seen"))
            return;
        localStorage.setItem("singularity.seen", "1");
    }
    catch (e) {
        return;
    }
    runTips();
}
document.getElementById("help-replay")?.addEventListener("click", () => { toggleHelp(false); runTips(300); });
function reveal() {
    if (revealed)
        return;
    revealed = true;
    loader.classList.add("revealed"); // backdrop turns transparent, scene shows
    controls.enabled = true; // drag to explore the 3D space
    applyHash(); // honour a shared deep link (#cosmos/#catalog/#anatomy)
    if (!location.hash)
        firstVisitTips();
}
let boot = 0;
// returning visitors skip the slow boot theatre and get straight in
const returning = (() => { try {
    return !!localStorage.getItem("singularity.seen");
}
catch (e) {
    return false;
} })();
const bootTimer = setInterval(() => {
    loaderStatus.textContent = bootMsgs[boot];
    if (++boot >= bootMsgs.length) {
        clearInterval(bootTimer);
        enterBtn.classList.add("ready");
        ctaCatalog.classList.add("ready");
        ctaCosmos.classList.add("ready");
        ctaPhysics.classList.add("ready");
        loaderStatus.textContent = returning ? "Welcome back." : "Drag to look around — then begin.";
        reveal();
    }
}, returning ? 90 : 420);
// ---------- "did you know" fact rotator on the welcome screen ----------
(function heroFactRotator() {
    const el = document.getElementById("hero-fact");
    const textEl = document.getElementById("hf-text");
    if (!el || !textEl)
        return;
    const facts = ALL_OBJECTS.map((o) => o.fact).filter(Boolean);
    if (!facts.length)
        return;
    let i = Math.floor(Math.random() * facts.length);
    textEl.textContent = facts[i];
    requestAnimationFrame(() => el.classList.add("show"));
    const timer = setInterval(() => {
        if (loader.classList.contains("hidden")) {
            clearInterval(timer);
            return;
        }
        el.classList.remove("show");
        setTimeout(() => {
            i = (i + 1) % facts.length;
            textEl.textContent = facts[i];
            el.classList.add("show");
        }, 350);
    }, 5000);
})();
function beginJourney() {
    if (started)
        return;
    started = true;
    loader.classList.add("hidden");
    document.body.classList.replace("mode-explore", "mode-journey");
    mode = "journey";
    controls.autoRotate = false;
    controls.enabled = params.freeOrbit;
    progress = 0;
    targetProgress = 0;
    autoCruise = true;
    toast("Launching… scroll or ← → to steer · Space to pause.");
    pokeIdle();
}
function returnToExplore() {
    if (mode !== "journey")
        return;
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
    loader.classList.remove("hidden"); // bring the hero/Start back
    loader.classList.add("revealed");
    toast("Back to free exploration — drag to look around.");
    document.body.classList.remove("ui-idle");
    clearTimeout(idleTimer);
}
enterBtn.addEventListener("click", beginJourney);
document.getElementById("back-home").addEventListener("click", returnToExplore);
ctaCatalog.addEventListener("click", () => {
    reveal();
    document.querySelector('.nav-pills button[data-view="catalog"]')?.click();
});
ctaPhysics.addEventListener("click", () => {
    reveal();
    document.querySelector('.nav-pills button[data-view="features"]')?.click();
});
ctaCosmos.addEventListener("click", () => { reveal(); enterCosmos(); });
// ---------- resize ----------
function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    lensing.uniforms.uResolution.value.set(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    cosmos.resize(w, h);
}
window.addEventListener("resize", onResize);
onResize();
// ---------- adaptive performance (keep it smooth) ----------
let perfTier = 2, lowTime = 0, highTime = 0, perfPinned = false;
function applyPerfTier() {
    if (perfTier >= 2) {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        composer.setPixelRatio?.(Math.min(window.devicePixelRatio, 1.5));
        bloomPass.strength = parseFloat(document.getElementById("c-bloom")?.value || "0.7");
    }
    else if (perfTier === 1) {
        const pr = Math.min(window.devicePixelRatio, 1.25);
        renderer.setPixelRatio(pr);
        composer.setPixelRatio?.(pr);
    }
    else {
        renderer.setPixelRatio(1);
        composer.setPixelRatio?.(1);
        bloomPass.strength = 0.32;
    }
    onResize();
}
function adaptPerf(dt) {
    if (!revealed || perfPinned)
        return;
    lowTime = fpsEMA < 42 ? lowTime + dt : Math.max(0, lowTime - dt * 0.6);
    highTime = fpsEMA > 56 ? highTime + dt : 0;
    if (lowTime > 3.5 && perfTier > 0) { // sustained low FPS → step down
        perfTier--;
        applyPerfTier();
        toast(perfTier === 1 ? "Tuning resolution for a smoother ride…" : "Performance mode on");
        lowTime = 0;
        highTime = 0;
    }
    else if (highTime > 8 && perfTier < 2) { // comfortably fast again → step back up
        perfTier++;
        applyPerfTier();
        toast("Performance recovered — quality restored.");
        lowTime = 0;
        highTime = 0;
    }
}
// ---------- render loop ----------
const clock = new THREE.Clock();
let fpsEMA = 60, frame = 0, simTime = 0;
const right = new THREE.Vector3(), up = new THREE.Vector3(), fwd = new THREE.Vector3();
function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    simTime += dt * params.timeScale; // Time Flow scales all animation
    const time = simTime;
    if (page === "cosmos") {
        cosmos.update(dt, time);
        if (tour) {
            tourT += dt;
            if (tourT > 5) {
                tourT = 0;
                tourI = (tourI + 1) % cosmos.anomalies.length;
                openCosmosCard(cosmos.focus(tourI));
                updateTourLabel();
            }
        }
        if (frame % 3 === 0) {
            drawCosmosMap();
            updateCosmosHUD();
        }
    }
    else {
        if (mode === "explore") {
            controls.update(); // drag-to-look + auto-rotate
        }
        else {
            if (autoCruise && !params.freeOrbit) {
                targetProgress += dt * 0.045 * params.timeScale;
                if (targetProgress >= 1)
                    targetProgress = 0; // endless dive
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
    if (captureRequested) {
        const dest = captureRequested;
        captureRequested = false;
        saveFrame(dest);
    }
    // ambient audio intensifies as the camera nears the horizon
    if (page !== "cosmos")
        audio.setIntensity(THREE.MathUtils.clamp((40 - camera.position.length()) / 38, 0, 1));
    // session stats: real wall-clock time explored + deepest cosmos dive, persisted periodically
    if (revealed)
        statsTime += dt;
    if (page === "cosmos")
        statsDepth = Math.max(statsDepth, cosmos.zoom * 4.2);
    if (frame % 300 === 0)
        saveSessionStats();
    if (statsTime >= 300)
        unlockAchievement("time-traveler");
    if (statsDepth >= 2)
        unlockAchievement("deep-diver");
    if (mode === "journey" && progress >= 0.999)
        unlockAchievement("horizon-crosser");
    // HUD
    frame++;
    pushSpark(dt);
    const fps = 1 / Math.max(1e-4, dt);
    fpsEMA += (fps - fpsEMA) * 0.08;
    if (frame % 8 === 0)
        updateHUD(fpsEMA);
    adaptPerf(dt);
    requestAnimationFrame(tick);
}
tick();
// expose for debugging
window.__sing = { params, lensing, camera, ship, cosmos, get mode() { return mode; }, get page() { return page; }, begin: beginJourney };
