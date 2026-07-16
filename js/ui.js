// ===================================================================
//  UI — panels, catalog rendering, navigation, toasts
// ===================================================================
import { BLACK_HOLES, PULSARS } from "./data.js";
import { portraitDataURL } from "./portraits.js";
import { buildAnatomy, setAnatomyActive } from "./anatomy.js";
export function buildUI(onStageJump) {
    buildFeatures();
    buildCatalog();
    wireNav();
    wireDetail();
    wireCompare();
    updateFavCount();
    buildJourneyStops(onStageJump);
}
// name -> object registry for the detail modal
const REGISTRY = new Map([...BLACK_HOLES, ...PULSARS].map(o => [o.name, o]));
const STAT_LABELS = {
    type: "Type", mass: "Mass", distance: "Distance", diameter: "Ø Event Horizon",
    spin: "Spin (a)", constellation: "Constellation", discovered: "Discovered",
    period: "Spin Period", field: "Magnetic Field", age: "Age",
};
function openDetail(o) {
    const isPulsar = o.category === "pulsar";
    const keys = isPulsar
        ? ["type", "period", "distance", "field", "age", "discovered"]
        : ["type", "mass", "distance", "diameter", "spin", "constellation", "discovered"];
    const img = document.getElementById("detail-img");
    img.src = portraitDataURL(o, 1040, 660);
    img.alt = `Rendered portrait of ${o.name}`;
    const chip = document.getElementById("detail-chip");
    chip.textContent = chipLabel(o);
    chip.className = "detail-chip cat-" + o.category;
    document.getElementById("detail-name").textContent = o.name;
    document.getElementById("detail-alias").textContent = o.alias;
    document.getElementById("detail-stats").innerHTML = keys
        .filter(k => o[k])
        .map(k => `<div class="dstat"><span class="lab">${STAT_LABELS[k]}</span><span class="val">${o[k]}</span></div>`)
        .join("");
    // mass scale bar (log₁₀ vs the Sun); hidden when the object has no mass
    const ms = document.getElementById("mass-scale");
    const massN = parseSci(o.mass || "");
    if (massN > 0) {
        ms.style.display = "";
        const exp = Math.log10(massN);
        document.getElementById("ms-marker").style.left =
            (Math.max(0, Math.min(1, exp / 11)) * 100).toFixed(1) + "%";
        document.getElementById("ms-caption").textContent =
            exp < 0.05 ? "about the Sun's mass" : `≈ 10^${exp.toFixed(1)} × the Sun`;
    }
    else
        ms.style.display = "none";
    document.getElementById("detail-desc").innerHTML = `<b>${o.tag}</b> ${o.fact}`;
    document.getElementById("detail-source").href = o.source;
    document.getElementById("detail-modal").classList.add("open");
}
function wireDetail() {
    const modal = document.getElementById("detail-modal");
    const close = () => modal.classList.remove("open");
    document.getElementById("cat-grid").addEventListener("click", (e) => {
        const card = e.target.closest(".obj-card");
        if (!card)
            return;
        const o = REGISTRY.get(decodeURIComponent(card.dataset.name));
        if (o)
            openDetail(o);
    });
    modal.querySelector("[data-detail-close]").addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal)
        close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape")
        close(); });
    // step through the currently rendered list from inside the modal
    const stepDetail = (dir) => {
        const name = document.getElementById("detail-name").textContent;
        if (!currentList.length)
            return;
        let i = currentList.findIndex(o => o.name === name);
        i = ((i + dir) % currentList.length + currentList.length) % currentList.length;
        openDetail(currentList[i]);
    };
    document.getElementById("dn-prev")?.addEventListener("click", () => stepDetail(-1));
    document.getElementById("dn-next")?.addEventListener("click", () => stepDetail(1));
    document.addEventListener("keydown", (e) => {
        if (!modal.classList.contains("open"))
            return;
        if (e.key === "ArrowLeft") {
            e.stopPropagation();
            stepDetail(-1);
        }
        else if (e.key === "ArrowRight") {
            e.stopPropagation();
            stepDetail(1);
        }
    }, true); // capture: runs before the journey's arrow-key handler
}
function buildFeatures() {
    buildAnatomy(document.getElementById("feature-grid"));
}
function chipLabel(o) {
    return o.category === "quasar" ? "Quasar" : o.category === "pulsar" ? "Pulsar" : "Black Hole";
}
// ---- favorites (persisted) ----
const FAV_KEY = "singularity.favs";
const favs = new Set(JSON.parse((() => { try {
    return localStorage.getItem(FAV_KEY) || "[]";
}
catch (e) {
    return "[]";
} })()));
function updateFavCount() {
    const el = document.getElementById("fav-count");
    if (el)
        el.textContent = favs.size ? String(favs.size) : "";
}
function toggleFav(name) {
    favs.has(name) ? favs.delete(name) : favs.add(name);
    try {
        localStorage.setItem(FAV_KEY, JSON.stringify([...favs]));
    }
    catch (e) { }
    updateFavCount();
}
// the ordered list currently rendered in the grid (drives modal prev/next)
let currentList = [];
// the active search query (drives match highlighting on cards)
let currentQuery = "";
function hi(s) {
    if (!currentQuery || !s)
        return s;
    const i = s.toLowerCase().indexOf(currentQuery);
    if (i < 0)
        return s;
    return s.slice(0, i) + "<mark>" + s.slice(i, i + currentQuery.length) + "</mark>" + s.slice(i + currentQuery.length);
}
// ---- compare mode: pin one object, pick another, view side by side ----
let comparePin = null;
const CMP_ROWS = [
    ["alias", "Alias"], ["type", "Type"], ["mass", "Mass"], ["period", "Spin Period"],
    ["distance", "Distance"], ["diameter", "Ø Event Horizon"], ["spin", "Spin (a)"],
    ["field", "Magnetic Field"], ["age", "Age"], ["discovered", "Discovered"],
];
function updateComparePin() {
    const chip = document.getElementById("cmp-pin");
    if (!chip)
        return;
    chip.innerHTML = comparePin ? `⇄ Comparing: <b>${comparePin}</b><button aria-label="Clear compare pin">✕</button>` : "";
    chip.classList.toggle("show", !!comparePin);
    chip.querySelector("button")?.addEventListener("click", () => { comparePin = null; updateComparePin(); toast("Compare pin cleared."); });
}
function pickCompare(name) {
    if (!comparePin) {
        comparePin = name;
        updateComparePin();
        toast(`Pinned ${name} — tap ⇄ on another object to compare.`);
        return;
    }
    if (comparePin === name) {
        comparePin = null;
        updateComparePin();
        toast("Compare pin cleared.");
        return;
    }
    openCompare(REGISTRY.get(comparePin), REGISTRY.get(name));
    comparePin = null;
    updateComparePin();
}
function openCompare(a, b) {
    if (!a || !b)
        return;
    const grid = document.getElementById("compare-grid");
    const col = (o) => `
    <div class="cmp-col">
      <img src="${portraitDataURL(o, 460, 240)}" alt="Rendered portrait of ${o.name}">
      <h3>${o.name}</h3>
      ${CMP_ROWS.filter(([k]) => a[k] || b[k]).map(([k, lab]) => `<div class="cmp-row"><span>${lab}</span><b>${o[k] || "—"}</b></div>`).join("")}
    </div>`;
    grid.innerHTML = col(a) + col(b);
    document.getElementById("compare-modal").classList.add("open");
}
function wireCompare() {
    const modal = document.getElementById("compare-modal");
    modal.querySelector("[data-compare-close]").addEventListener("click", () => modal.classList.remove("open"));
    modal.addEventListener("click", (e) => { if (e.target === modal)
        modal.classList.remove("open"); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape")
        modal.classList.remove("open"); });
}
function objCard(o, rank) {
    const isPulsar = o.category === "pulsar";
    const stats = isPulsar
        ? [["Type", o.type], ["Spin period", o.period], ["Distance", o.distance], ["Mag. field", o.field]]
        : [["Type", o.type], ["Mass", o.mass], ["Distance", o.distance], ["Spin", o.spin]];
    return `
    <button class="obj-card" data-name="${encodeURIComponent(o.name)}">
      <div class="obj-thumb">
        <img loading="lazy" src="${portraitDataURL(o, 460, 280)}" alt="Rendered portrait of ${o.name}">
        <span class="obj-rank">${String(rank).padStart(2, "0")}</span>
        <span class="type-chip cat-${o.category}">${chipLabel(o)}</span>
        <span class="fav-btn${favs.has(o.name) ? " on" : ""}" data-favname="${encodeURIComponent(o.name)}" title="Favorite">${favs.has(o.name) ? "★" : "☆"}</span>
        <span class="cmp-btn" data-cmpname="${encodeURIComponent(o.name)}" title="Compare">⇄</span>
      </div>
      <div class="obj-body">
        <h4>${hi(o.name)}</h4>
        <div class="alias">${hi(o.alias)}</div>
        <div class="obj-stats">
          ${stats.map(s => `<div class="stat"><span class="lab">${s[0]}</span><span class="val">${s[1]}</span></div>`).join("")}
        </div>
        <div class="fact"><b>${o.tag}</b></div>
        <span class="obj-more">View details →</span>
      </div>
    </button>`;
}
function listFor(cat) {
    if (cat === "pulsar")
        return PULSARS;
    if (cat === "quasar")
        return BLACK_HOLES.filter(o => o.category === "quasar");
    if (cat === "blackhole")
        return BLACK_HOLES.filter(o => o.category === "blackhole");
    if (cat === "fav")
        return [...BLACK_HOLES, ...PULSARS].filter(o => favs.has(o.name));
    return [...BLACK_HOLES, ...PULSARS];
}
// parse "53.5 million ly" / "6.5 billion M☉" / "7,200 ly" → comparable number
function parseSci(s) {
    if (!s)
        return 0;
    const m = s.replace(/,/g, "").match(/([\d.]+)/);
    let n = m ? parseFloat(m[1]) : 0;
    if (/billion|Bly/i.test(s))
        n *= 1e9;
    else if (/million|Mly/i.test(s))
        n *= 1e6;
    return n;
}
function buildCatalog() {
    const grid = document.getElementById("cat-grid");
    const search = document.getElementById("cat-search");
    const sort = document.getElementById("cat-sort");
    let cat = "all";
    const render = () => {
        const q = (search?.value || "").trim().toLowerCase();
        currentQuery = q;
        let list = listFor(cat).filter(o => !q || o.name.toLowerCase().includes(q) || (o.alias || "").toLowerCase().includes(q));
        const by = sort?.value || "rank";
        if (by === "name")
            list = [...list].sort((a, b) => a.name.localeCompare(b.name));
        else if (by === "distance")
            list = [...list].sort((a, b) => parseSci(a.distance) - parseSci(b.distance));
        else if (by === "mass")
            list = [...list].sort((a, b) => parseSci(a.mass || a.period || "") - parseSci(b.mass || b.period || ""));
        currentList = list;
        grid.innerHTML = list.length
            ? list.map((o, i) => objCard(o, i + 1)).join("")
            : `<p class="cat-empty">${cat === "fav" && !q ? "No favorites yet — tap ☆ on any object to save it here." : `No objects match “${q}”.`}</p>`;
    };
    render();
    // star toggles favorite (registered before the detail handler; stops it)
    grid.addEventListener("click", (e) => {
        const t = e.target;
        const f = t.closest(".fav-btn");
        if (f) {
            e.stopImmediatePropagation();
            toggleFav(decodeURIComponent(f.dataset.favname));
            render();
            return;
        }
        const c = t.closest(".cmp-btn");
        if (c) {
            e.stopImmediatePropagation();
            pickCompare(decodeURIComponent(c.dataset.cmpname));
        }
    });
    document.querySelectorAll(".cat-tabs button").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".cat-tabs button").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            cat = btn.dataset.cat;
            render();
            document.querySelector("#panel-catalog .panel-inner")?.scrollTo({ top: 0, behavior: "smooth" });
        });
    });
    search?.addEventListener("input", render);
    sort?.addEventListener("change", render);
    // open a random object from the active tab
    document.getElementById("cat-random")?.addEventListener("click", () => {
        const list = listFor(cat === "fav" && !listFor("fav").length ? "all" : cat);
        if (list.length)
            openDetail(list[Math.floor(Math.random() * list.length)]);
    });
}
function wireNav() {
    const pills = document.querySelectorAll(".nav-pills button[data-view]");
    const panels = {
        features: document.getElementById("panel-features"),
        catalog: document.getElementById("panel-catalog"),
    };
    const closeAll = () => { Object.values(panels).forEach(p => p.classList.remove("open")); setAnatomyActive(false); };
    pills.forEach(btn => {
        btn.addEventListener("click", () => {
            const v = btn.dataset.view;
            pills.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            closeAll();
            if (panels[v])
                panels[v].classList.add("open");
            if (v === "features")
                setAnatomyActive(true);
        });
    });
    document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", () => {
        closeAll();
        pills.forEach(p => p.classList.toggle("active", p.dataset.view === "sim"));
    }));
    document.addEventListener("keydown", e => {
        if (e.key !== "Escape")
            return;
        // layered dismissal: when a modal is above the panel, this press closes
        // only the modal (its own handler runs next); the panel needs a second Esc.
        if (document.querySelector(".detail-modal.open, .help-modal.open"))
            return;
        closeAll();
        pills.forEach(p => p.classList.toggle("active", p.dataset.view === "sim"));
    });
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
    wrap.innerHTML = STAGES.map((s, i) => `<button data-stage="${i}">${s.label}</button>`).join("");
    wrap.querySelectorAll("button").forEach(b => b.addEventListener("click", () => onJump(STAGES[+b.dataset.stage].t)));
}
let toastTimer;
export function toast(msg) {
    const el = document.getElementById("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}
