// ===================================================================
//  UI — panels, catalog rendering, navigation, toasts
// ===================================================================
import { BLACK_HOLES, PULSARS, FEATURES } from "./data.js";

export function buildUI(onStageJump) {
  buildFeatures();
  buildCatalog();
  wireNav();
  buildJourneyStops(onStageJump);
}

function buildFeatures() {
  const grid = document.getElementById("feature-grid");
  grid.innerHTML = FEATURES.map(f => `
    <div class="feature-card">
      <div class="ic">${f.icon}</div>
      <h4>${f.name}</h4>
      <p>${f.text}</p>
    </div>`).join("");
}

function objCard(o, i, kind) {
  const stats = kind === "bh"
    ? [["Type", o.type], ["Mass", o.mass], ["Distance", o.distance], ["Ø Horizon", o.diameter], ["Spin", o.spin], ["Found", o.discovered]]
    : [["Type", o.type], ["Spin period", o.period], ["Distance", o.distance], ["Mag. field", o.field], ["Age", o.age], ["Found", o.discovered]];
  return `
    <div class="obj-card">
      <div class="obj-rank">${String(i + 1).padStart(2, "0")}</div>
      <span class="type-chip">${o.type}</span>
      <h4>${o.name}</h4>
      <div class="alias">${o.alias}</div>
      <div class="obj-stats">
        ${stats.map(s => `<div class="stat"><span class="lab">${s[0]}</span><span class="val">${s[1]}</span></div>`).join("")}
      </div>
      <div class="fact"><b>${o.tag}</b><br>${o.fact}</div>
    </div>`;
}

function buildCatalog() {
  const grid = document.getElementById("cat-grid");
  const render = (cat) => {
    const list = cat === "bh" ? BLACK_HOLES : PULSARS;
    grid.innerHTML = list.map((o, i) => objCard(o, i, cat)).join("");
  };
  render("bh");
  document.querySelectorAll(".cat-tabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".cat-tabs button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      render(btn.dataset.cat);
      grid.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function wireNav() {
  const pills = document.querySelectorAll(".nav-pills button[data-view]");
  const panels = {
    features: document.getElementById("panel-features"),
    catalog: document.getElementById("panel-catalog"),
  };
  const closeAll = () => Object.values(panels).forEach(p => p.classList.remove("open"));

  pills.forEach(btn => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.view;
      pills.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      closeAll();
      if (panels[v]) panels[v].classList.add("open");
    });
  });
  document.querySelectorAll("[data-close]").forEach(b =>
    b.addEventListener("click", () => {
      closeAll();
      pills.forEach(p => p.classList.toggle("active", p.dataset.view === "sim"));
    }));
  document.addEventListener("keydown", e => { if (e.key === "Escape") { closeAll(); pills.forEach(p => p.classList.toggle("active", p.dataset.view === "sim")); } });
}

export const STAGES = [
  { id: "approach", label: "Approach", t: 0.0,
    name: "Approach", desc: "You drift toward a stellar-mass black hole. Its accretion disk burns at millions of degrees, and already the starfield behind it begins to warp." },
  { id: "lensing", label: "Lensing", t: 0.28,
    name: "Gravitational Lensing", desc: "Light bends around the hole. You can now see the underside of the disk arcing over the top — light that should be hidden, wrapped around to meet your eye." },
  { id: "photon", label: "Photon Ring", t: 0.52,
    name: "The Photon Ring", desc: "At 1.5 Schwarzschild radii, photons themselves orbit. A razor-thin, blindingly bright ring traces the silhouette of the event horizon." },
  { id: "isco", label: "ISCO", t: 0.74,
    name: "Crossing the ISCO", desc: "The Innermost Stable Circular Orbit. Inside this line no orbit survives — matter, and now you, can only spiral inward toward the horizon." },
  { id: "horizon", label: "Horizon", t: 0.92,
    name: "The Event Horizon", desc: "The point of no return. Time dilation stretches toward infinity; the universe behind you blueshifts and folds into a brilliant ring." },
  { id: "interior", label: "Beyond", t: 1.0,
    name: "Beyond the Veil", desc: "Past the horizon, all paths lead inward. Here our physics ends — and the simulation lets you fall, weightless, through the unknown." },
];

function buildJourneyStops(onJump) {
  const wrap = document.getElementById("journey-stops");
  wrap.innerHTML = STAGES.map((s, i) =>
    `<button data-stage="${i}">${s.label}</button>`).join("");
  wrap.querySelectorAll("button").forEach(b =>
    b.addEventListener("click", () => onJump(STAGES[+b.dataset.stage].t)));
}

let toastTimer;
export function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}
