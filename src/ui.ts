// ===================================================================
//  UI — panels, catalog rendering, navigation, toasts
// ===================================================================
import { BLACK_HOLES, PULSARS, FEATURES } from "./data.js";
import { portraitDataURL } from "./portraits.js";
import { buildAnatomy, setAnatomyActive, setFeatureFocus } from "./anatomy.js";
import { ANOMALIES } from "./cosmos-data.js";

// cross-link: catalog objects that also appear as a cosmos anomaly
function normalizeName(s: string): string {
  return (s || "").toLowerCase()
    .replace(/[‐‑‒–—−-]/g, "-")   // any dash variant -> hyphen
    .replace(/\s*\([^)]*\)\s*/g, " ")          // strip parenthetical suffixes
    .replace(/\s+remnant$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}
const COSMOS_INDEX_BY_NAME = new Map<string, number>();
ANOMALIES.forEach((a, i) => COSMOS_INDEX_BY_NAME.set(normalizeName(a.name), i));
function cosmosIndexFor(catalogName: string): number | null {
  const i = COSMOS_INDEX_BY_NAME.get(normalizeName(catalogName));
  return i === undefined ? null : i;
}
// reverse of the above: a cosmos entity's matching catalog object, if any
const CATALOG_BY_NORMALIZED_NAME = new Map<string, any>();
[...BLACK_HOLES, ...PULSARS].forEach(o => CATALOG_BY_NORMALIZED_NAME.set(normalizeName(o.name), o));
function catalogObjectForCosmosName(name: string): any {
  return CATALOG_BY_NORMALIZED_NAME.get(normalizeName(name)) || null;
}
export function cosmosEntityHasCatalogMatch(name: string): boolean {
  return !!catalogObjectForCosmosName(name);
}
export function getCosmosEntitySource(name: string): string | null {
  const o = catalogObjectForCosmosName(name);
  return o ? o.source : null;
}
export function compareCosmosEntity(name: string) {
  const o = catalogObjectForCosmosName(name);
  if (!o) { toast("No catalog match to compare."); return; }
  pickCompare(o.name);
}

export function buildUI(onStageJump) {
  buildFeatures();
  buildCatalog();
  wireNav();
  wireDetail();
  wireCompare();
  wireFeatureFocus();
  updateFavCount();
  wireAchievementFilterTabs();
  renderAchievements();
  renderCatBreakdown();
  wireTrivia();
  buildJourneyStops(onStageJump);
}

// category breakdown chart above the catalog tabs
function renderCatBreakdown() {
  const bar = document.getElementById("cat-breakdown-bar");
  const legend = document.getElementById("cat-breakdown-legend");
  if (!bar || !legend) return;
  const all = [...BLACK_HOLES, ...PULSARS];
  const cats: Array<[string, string, string]> = [
    ["blackhole", "Black Holes", "#ff9d3c"],
    ["quasar", "Quasars", "#9d6eff"],
    ["pulsar", "Pulsars", "#4db5ff"],
  ];
  const counts = cats.map(([key]) => all.filter(o => o.category === key).length);
  const total = all.length || 1;
  bar.innerHTML = cats.map(([, , color], i) =>
    `<span style="width:${(counts[i] / total * 100).toFixed(2)}%; background:${color}"></span>`).join("");
  legend.innerHTML = cats.map(([, label, color], i) =>
    `<div><span class="dot" style="background:${color}"></span>${label} <b>${counts[i]}</b></div>`).join("");
}

// name -> object registry for the detail modal
const REGISTRY = new Map([...BLACK_HOLES, ...PULSARS].map(o => [o.name, o]));

const STAT_LABELS = {
  type: "Type", mass: "Mass", distance: "Distance", diameter: "Ø Event Horizon",
  spin: "Spin (a)", constellation: "Constellation", discovered: "Discovered",
  period: "Spin Period", field: "Magnetic Field", age: "Age",
};
const STAT_EXPLANATIONS: Record<string, string> = {
  type: "The broad category or subtype this object belongs to.",
  mass: "How much matter the object contains, measured in solar masses (M☉) — one Sun's worth.",
  distance: "How far away the object is from Earth, in light-years.",
  diameter: "The width of the event horizon — the point of no return where nothing, not even light, can escape.",
  spin: "The object's spin parameter (a), from 0 (non-rotating) to just under 1 (spinning near the theoretical maximum).",
  constellation: "The constellation this object appears within, as seen from Earth.",
  discovered: "When this object was first identified or confirmed by astronomers.",
  period: "How long it takes the object to complete one full rotation.",
  field: "The strength of the object's magnetic field, measured in gauss (G).",
  age: "The estimated age of the object since it formed.",
};
const CATEGORY_GLOSSARY: Record<string, string> = {
  blackhole: "An object so dense that nothing, not even light, can escape its gravity once past the event horizon.",
  quasar: "A supermassive black hole actively feeding on surrounding gas, outshining every star in its galaxy combined.",
  pulsar: "A rapidly rotating neutron star that sweeps a beam of radiation past Earth like a lighthouse.",
};

// ---- achievements: small exploration milestones, persisted locally ----
const ACH_KEY = "singularity.achievements";
const ACHIEVEMENTS: Record<string, { label: string; desc: string; secret?: boolean }> = {
  "first-contact":   { label: "First Contact",     desc: "Viewed your first object" },
  "explorer":        { label: "Explorer",          desc: "Viewed 10 different objects" },
  "cataloger":       { label: "Master Cataloger",  desc: "Viewed all 40 catalog objects" },
  "collector":       { label: "Collector",         desc: "Favorited 5 objects" },
  "horizon-crosser": { label: "Horizon Crosser",   desc: "Reached the event horizon" },
  "time-traveler":   { label: "Time Traveler",     desc: "Explored for 5 minutes total" },
  "deep-diver":      { label: "Deep Diver",        desc: "Dove 2 billion light-years into the cosmos" },
  "note-taker":      { label: "Note Taker",        desc: "Wrote your first personal note" },
  "quiz-whiz":       { label: "Quiz Whiz",          desc: "Scored a perfect round in Cosmic Trivia" },
  "shutterbug":      { label: "Shutterbug",         desc: "Captured 5 frames of the simulation" },
  "cartographer":    { label: "Cosmic Cartographer", desc: "Viewed one entity of every kind in the Cosmos" },
  "konami":          { label: "Konami Cosmonaut",  desc: "Entered the classic cheat code", secret: true },
};
const unlockedAchievements = new Set<string>((() => { try { return JSON.parse(localStorage.getItem(ACH_KEY) || "[]"); } catch (e) { return []; } })());
const ACH_DATES_KEY = "singularity.achievementDates";
const achievementDates: Record<string, string> = (() => { try { return JSON.parse(localStorage.getItem(ACH_DATES_KEY) || "{}"); } catch (e) { return {}; } })();
// secret achievements stay entirely out of the list, counts, and exports until unlocked
function visibleAchievementEntries() {
  return Object.entries(ACHIEVEMENTS).filter(([id, a]) => !a.secret || unlockedAchievements.has(id));
}
// numeric progress toward the quantifiable, still-locked achievements
function achievementProgress(id: string): string | null {
  if (id === "explorer") return `${Math.min(viewedNames.size, 10)} / 10`;
  if (id === "cataloger") return `${Math.min(viewedNames.size, 40)} / 40`;
  if (id === "collector") return `${Math.min(favs.size, 5)} / 5`;
  if (id === "cartographer") return cartographerProgress;
  if (id === "time-traveler") return timeTravelerProgress;
  if (id === "deep-diver") return deepDiverProgress;
  if (id === "shutterbug") {
    const n = (() => { try { return parseInt(localStorage.getItem("singularity.captureCount") || "0", 10); } catch (e) { return 0; } })();
    return `${Math.min(n, 5)} / 5`;
  }
  return null;
}
// main.ts owns the relevant live state for these — it reports progress in here as it ticks,
// since ui.ts has no direct access to the cosmos scene or the session-time/depth counters
let cartographerProgress = "0 / 0";
export function setCartographerProgress(seen: number, total: number) { cartographerProgress = `${seen} / ${total}`; }
let timeTravelerProgress = "0s / 5m";
export function setTimeTravelerProgress(sec: number) { timeTravelerProgress = `${Math.min(Math.floor(sec), 300)}s / 5m`; }
let deepDiverProgress = "0.00 / 2 Bly";
export function setDeepDiverProgress(bly: number) { deepDiverProgress = `${Math.min(bly, 2).toFixed(2)} / 2 Bly`; }
// which achievements the Help modal list currently shows
let achFilter: "all" | "unlocked" | "locked" = "all";
export function renderAchievements() {
  const el = document.getElementById("help-achievements-list");
  if (!el) return;
  const entries = visibleAchievementEntries();
  const shown = entries.filter(([id]) => {
    const unlocked = unlockedAchievements.has(id);
    return achFilter === "unlocked" ? unlocked : achFilter === "locked" ? !unlocked : true;
  });
  el.innerHTML = shown.length ? shown.map(([id, a]) => {
    const unlocked = unlockedAchievements.has(id);
    const dateStr = unlocked && achievementDates[id]
      ? new Date(achievementDates[id]).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
      : "";
    const progress = !unlocked ? achievementProgress(id) : null;
    return `<div class="ach${unlocked ? " unlocked" : ""}" data-ach-desc="${a.desc}" data-ach-unlocked-date="${dateStr}" data-ach-progress="${progress || ""}">
      <span class="ach-icon">${unlocked ? "🏆" : "🔒"}</span><span class="ach-label">${a.label}</span>
    </div>`;
  }).join("") : `<span class="help-recent-empty">${achFilter === "unlocked" ? "No achievements unlocked yet." : "Nothing locked — you've unlocked them all!"}</span>`;
  const total = entries.length;
  const fill = document.getElementById("ach-progress-fill") as HTMLElement | null;
  const label = document.getElementById("ach-progress-label");
  if (fill) fill.style.width = (unlockedAchievements.size / total * 100).toFixed(1) + "%";
  if (label) label.textContent = `${unlockedAchievements.size} / ${total}`;
}
function wireAchievementFilterTabs() {
  const bar = document.getElementById("ach-filter-tabs");
  if (!bar) return;
  bar.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("button[data-ach-filter]") as HTMLElement | null;
    if (!btn) return;
    achFilter = (btn.dataset.achFilter as "all" | "unlocked" | "locked") || "all";
    bar.querySelectorAll("button").forEach(b => b.classList.toggle("active", b === btn));
    renderAchievements();
  });
}
// styled hover tooltip for achievement badges, replacing the plain native title
(function wireAchievementTooltip() {
  const list = document.getElementById("help-achievements-list");
  const tooltip = document.getElementById("cat-tooltip");
  if (!list || !tooltip) return;
  list.addEventListener("mouseover", (e) => {
    const badge = (e.target as HTMLElement).closest(".ach") as HTMLElement | null;
    if (!badge) return;
    const desc = badge.dataset.achDesc || "";
    const locked = !badge.classList.contains("unlocked");
    const dateStr = badge.dataset.achUnlockedDate || "";
    const progress = badge.dataset.achProgress || "";
    tooltip.textContent = locked
      ? `🔒 ${desc}${progress ? ` (${progress})` : ""}`
      : (dateStr ? `${desc} — Unlocked ${dateStr}` : desc) + " · Click to download";
  });
  list.addEventListener("mousemove", (e) => {
    const badge = (e.target as HTMLElement).closest(".ach") as HTMLElement | null;
    if (!badge) { tooltip.classList.remove("show"); return; }
    tooltip.style.left = (e as MouseEvent).clientX + "px";
    tooltip.style.top = (e as MouseEvent).clientY + "px";
    tooltip.classList.add("show");
  });
  list.addEventListener("mouseleave", () => tooltip.classList.remove("show"));
})();
export function unlockAchievement(id: string) {
  if (unlockedAchievements.has(id) || !ACHIEVEMENTS[id]) return;
  unlockedAchievements.add(id);
  try { localStorage.setItem(ACH_KEY, JSON.stringify([...unlockedAchievements])); } catch (e) {}
  achievementDates[id] = new Date().toISOString();
  try { localStorage.setItem(ACH_DATES_KEY, JSON.stringify(achievementDates)); } catch (e) {}
  toast(`🏆 Achievement unlocked: ${ACHIEVEMENTS[id].label}`);
  renderAchievements();
  window.dispatchEvent(new CustomEvent("singularity:achievement"));
  if (unlockedAchievements.size === Object.keys(ACHIEVEMENTS).length) {
    window.dispatchEvent(new CustomEvent("singularity:allachievements"));
  }
}
export function getAchievementCounts() { const entries = visibleAchievementEntries(); return { unlocked: unlockedAchievements.size, total: entries.length }; }
export function getAchievementsList(): Array<{ id: string; label: string; desc: string; unlocked: boolean }> {
  return visibleAchievementEntries().map(([id, a]) => ({ id, label: a.label, desc: a.desc, unlocked: unlockedAchievements.has(id) }));
}

// distinct-objects-viewed tracker, shared between the catalog and cosmos figures
const VIEWED_KEY = "singularity.stats.viewed";
const viewedNames = new Set<string>((() => { try { return JSON.parse(localStorage.getItem(VIEWED_KEY) || "[]"); } catch (e) { return []; } })());
const RECENT_KEY = "singularity.recent";
const MAX_RECENT = 5;
let recentViews: string[] = (() => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch (e) { return []; } })();
export function recordObjectView(name: string) {
  if (!name) return;
  if (!viewedNames.has(name)) {
    viewedNames.add(name);
    try { localStorage.setItem(VIEWED_KEY, JSON.stringify([...viewedNames])); } catch (e) {}
    if (viewedNames.size >= 1) unlockAchievement("first-contact");
    if (viewedNames.size >= 10) unlockAchievement("explorer");
    if (viewedNames.size >= 40) unlockAchievement("cataloger");
  }
  recentViews = [name, ...recentViews.filter(n => n !== name)].slice(0, MAX_RECENT);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentViews)); } catch (e) {}
  bumpDailyChallenge(name);
}
export function getViewedCount(): number { return viewedNames.size; }
// how many distinct objects have been viewed during just this page load (not lifetime)
const SESSION_START_VIEWED = viewedNames.size;
export function getSessionViewedCount(): number { return viewedNames.size - SESSION_START_VIEWED; }

// daily mini-challenge: view a handful of objects in the same calendar day
const DAILY_KEY = "singularity.dailyProgress";
export const DAILY_CHALLENGE_TARGET = 3;
function todayStr(): string { return new Date().toISOString().slice(0, 10); }
function loadDaily(): { date: string; viewed: string[] } {
  try {
    const d = JSON.parse(localStorage.getItem(DAILY_KEY) || "null");
    if (d && d.date === todayStr() && Array.isArray(d.viewed)) return d;
  } catch (e) { /* fall through to a fresh day */ }
  return { date: todayStr(), viewed: [] };
}
function bumpDailyChallenge(name: string) {
  const daily = loadDaily();
  if (daily.viewed.includes(name)) return;
  daily.viewed.push(name);
  try { localStorage.setItem(DAILY_KEY, JSON.stringify(daily)); } catch (e) {}
  if (daily.viewed.length === DAILY_CHALLENGE_TARGET) {
    toast(`🎯 Daily challenge complete — you viewed ${DAILY_CHALLENGE_TARGET} objects today!`);
  }
}
export function getDailyProgress(): number { return loadDaily().viewed.length; }
export function hasViewedObject(name: string): boolean { return viewedNames.has(name); }
export function getCatalogChecklist(): Array<{ name: string; category: string; viewed: boolean; favorited: boolean }> {
  return [...BLACK_HOLES, ...PULSARS].map(o => ({
    name: o.name, category: o.category, viewed: viewedNames.has(o.name), favorited: favs.has(o.name),
  }));
}
export function openNextUnviewed(): boolean {
  const next = [...BLACK_HOLES, ...PULSARS].find(o => !viewedNames.has(o.name));
  if (!next) return false;
  openDetail(next);
  return true;
}
export function getRecentlyViewed(): string[] { return recentViews; }
// jump back to a recently-viewed name, whether it's a catalog object or a cosmos-only entity
export function openRecentlyViewed(name: string) {
  if (openObjectByName(name)) return;
  const idx = cosmosIndexFor(name);
  if (idx !== null) location.hash = "cosmos/" + idx;
}

// personal notes on catalog objects, persisted locally, keyed by object name
const NOTES_KEY = "singularity.notes";
function loadNotes(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || "{}") || {}; } catch (e) { return {}; }
}
export function getAllNotes(): Record<string, string> { return loadNotes(); }
export function saveNote(name: string, text: string) {
  try {
    const notes = loadNotes();
    if (text.trim()) notes[name] = text; else delete notes[name];
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    if (text.trim()) unlockAchievement("note-taker");
  } catch (e) { /* storage unavailable */ }
}
export function updateNotesCount(countElId: string, len: number) {
  const el = document.getElementById(countElId);
  if (el) el.textContent = `${len} / 500`;
}

// word-wrap plain text onto a canvas, returning the y position after the last line
function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number): number {
  const words = text.split(/\s+/);
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else line = test;
  }
  if (line) { ctx.fillText(line, x, y); y += lineHeight; }
  return y;
}
// composite the open object's portrait + stats into a downloadable PNG card
function downloadObjectCard() {
  const name = document.getElementById("detail-name").textContent || "Object";
  const alias = document.getElementById("detail-alias").textContent || "";
  const desc = (document.getElementById("detail-desc").textContent || "").trim();
  const imgSrc = (document.getElementById("detail-img") as HTMLImageElement).src;
  const stats = [...document.querySelectorAll("#detail-stats .dstat")].slice(0, 5)
    .map(el => [el.querySelector(".lab")?.textContent || "", el.querySelector(".val")?.textContent || ""]);

  const W = 900, imgH = 500, H = 1180;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const render = () => {
    let y = imgH + 60;
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 44px sans-serif";
    ctx.fillText(name, 40, y); y += 40;
    if (alias) { ctx.fillStyle = "#ffb977"; ctx.font = "italic 22px sans-serif"; ctx.fillText(alias, 40, y); y += 44; }
    ctx.font = "18px monospace";
    stats.forEach(([lab, val]) => { ctx.fillStyle = "#7d8bb3"; ctx.fillText(lab + ":", 40, y); ctx.fillStyle = "#e8ecf7"; ctx.fillText(String(val), 220, y); y += 30; });
    y += 16;
    ctx.font = "17px sans-serif"; ctx.fillStyle = "#b9c2d9";
    wrapText(ctx, desc, 40, y, W - 80, 26);
    ctx.font = "13px sans-serif"; ctx.fillStyle = "#4a5578";
    ctx.fillText("SINGULARITY — a real-time black hole simulator", 40, H - 26);

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() + "-card.png";
    document.body.appendChild(a); a.click(); a.remove();
    toast("Card downloaded.");
  };

  ctx.fillStyle = "#070914"; ctx.fillRect(0, 0, W, H);
  const img = new Image();
  img.onload = () => {
    const scale = Math.max(W / img.width, imgH / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    ctx.drawImage(img, (W - dw) / 2, (imgH - dh) / 2, dw, dh);
    render();
  };
  img.onerror = render;
  img.src = imgSrc;
}

function downloadCompareCard() {
  const cols = [...document.querySelectorAll("#compare-grid .cmp-col")];
  if (cols.length < 2) return;
  const data = cols.map(col => ({
    name: col.querySelector("h3")?.textContent || "",
    img: (col.querySelector("img") as HTMLImageElement)?.src || "",
    rows: [...col.querySelectorAll(".cmp-row")].map(r =>
      [r.querySelector("span")?.textContent || "", r.querySelector("b")?.textContent || ""]),
  }));

  const colW = 460, imgH = 240, pad = 40, gap = 40;
  const W = colW * 2 + gap + pad * 2;
  const rowsMax = Math.max(...data.map(d => d.rows.length));
  const H = imgH + 70 + rowsMax * 28 + 90;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#070914"; ctx.fillRect(0, 0, W, H);

  const imgs: HTMLImageElement[] = [];
  const renderAll = () => {
    data.forEach((d, i) => {
      const x = pad + i * (colW + gap);
      const im = imgs[i];
      if (im) {
        const scale = Math.max(colW / im.width, imgH / im.height);
        const dw = im.width * scale, dh = im.height * scale;
        ctx.save();
        ctx.beginPath(); ctx.rect(x, 0, colW, imgH); ctx.clip();
        ctx.drawImage(im, x + (colW - dw) / 2, (imgH - dh) / 2, dw, dh);
        ctx.restore();
      }
      let y = imgH + 46;
      ctx.fillStyle = "#ffffff"; ctx.font = "bold 26px sans-serif";
      ctx.fillText(d.name, x, y); y += 34;
      ctx.font = "14px monospace";
      d.rows.forEach(([lab, val]) => {
        ctx.fillStyle = "#7d8bb3"; ctx.fillText(String(lab), x, y);
        ctx.fillStyle = "#e8ecf7"; ctx.fillText(String(val), x + 170, y);
        y += 28;
      });
    });
    ctx.strokeStyle = "rgba(120,150,220,0.25)";
    ctx.beginPath(); ctx.moveTo(pad + colW + gap / 2, 20); ctx.lineTo(pad + colW + gap / 2, H - 40); ctx.stroke();
    ctx.font = "13px sans-serif"; ctx.fillStyle = "#4a5578";
    ctx.fillText("SINGULARITY — side by side", pad, H - 20);

    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${data[0].name}-vs-${data[1].name}`.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() + ".png";
    document.body.appendChild(a); a.click(); a.remove();
    toast("Comparison card downloaded.");
  };
  let remaining = data.length;
  data.forEach((d, i) => {
    const im = new Image();
    im.onload = () => { imgs[i] = im; if (--remaining === 0) renderAll(); };
    im.onerror = () => { if (--remaining === 0) renderAll(); };
    im.src = d.img;
  });
}

// the 2-3 other catalog objects in the same category with the closest mass (or spin period, for pulsars)
function similarObjects(o: any): any[] {
  const isPulsar = o.category === "pulsar";
  const key = isPulsar ? "period" : "mass";
  const val = parseSci(o[key] || "");
  if (!val) return [];
  const pool = listFor(o.category).filter((x: any) => x.name !== o.name && parseSci(x[key] || "") > 0);
  return pool
    .map((x: any) => ({ x, diff: Math.abs(parseSci(x[key] || "") - val) }))
    .sort((a, b) => a.diff - b.diff)
    .slice(0, 3)
    .map(e => e.x);
}

function openDetail(o) {
  recordObjectView(o.name);
  const isPulsar = o.category === "pulsar";
  const keys = isPulsar
    ? ["type", "period", "distance", "field", "age", "discovered"]
    : ["type", "mass", "distance", "diameter", "spin", "constellation", "discovered"];

  const img = document.getElementById("detail-img") as HTMLImageElement;
  img.src = portraitDataURL(o, 1040, 660);
  img.alt = `Rendered portrait of ${o.name}`;

  const chip = document.getElementById("detail-chip");
  chip.textContent = chipLabel(o);
  chip.className = "detail-chip cat-" + o.category;

  document.getElementById("detail-name").textContent = o.name;
  document.getElementById("detail-alias").textContent = o.alias;
  document.getElementById("detail-stats").innerHTML = keys
    .filter(k => o[k])
    .map(k => `<div class="dstat"><span class="lab" data-stat-key="${k}">${STAT_LABELS[k]}</span><span class="val">${o[k]}</span></div>`)
    .join("");
  // mass scale bar (log₁₀ vs the Sun); hidden when the object has no mass
  const ms = document.getElementById("mass-scale");
  const massN = parseSci(o.mass || "");
  if (massN > 0) {
    ms.style.display = "";
    const exp = Math.log10(massN);
    (document.getElementById("ms-marker") as HTMLElement).style.left =
      (Math.max(0, Math.min(1, exp / 11)) * 100).toFixed(1) + "%";
    document.getElementById("ms-caption").textContent =
      exp < 0.05 ? "about the Sun's mass" : `≈ 10^${exp.toFixed(1)} × the Sun`;
  } else ms.style.display = "none";

  // distance in human terms: light-travel time + a relatable age comparison
  const scaleEl = document.getElementById("detail-scale");
  const ly = parseSci(o.distance || "");
  if (scaleEl && ly > 0) { scaleEl.innerHTML = distancePerspective(ly); scaleEl.style.display = ""; }
  else if (scaleEl) scaleEl.style.display = "none";

  document.getElementById("detail-desc").innerHTML = `<b>${o.tag}</b> ${o.fact}`;
  (document.getElementById("detail-source") as HTMLAnchorElement).href = o.source;

  const similarEl = document.getElementById("detail-similar");
  const similarWrap = document.getElementById("detail-similar-wrap");
  if (similarEl && similarWrap) {
    const similar = similarObjects(o);
    similarEl.innerHTML = similar.map(s => `<button class="detail-similar-item" data-similar-name="${encodeURIComponent(s.name)}">${s.name}</button>`).join("");
    similarWrap.style.display = similar.length ? "" : "none";
  }

  const favBtn = document.getElementById("detail-fav");
  if (favBtn) {
    favBtn.textContent = isFavorited(o.name) ? "★" : "☆";
    favBtn.classList.toggle("on", isFavorited(o.name));
  }
  const favNav = document.querySelector(".detail-nav-fav") as HTMLElement | null;
  if (favNav) favNav.style.display = favs.size ? "" : "none";

  const cosmosLink = document.getElementById("detail-cosmos-link") as HTMLButtonElement;
  const cosmosIdx = cosmosIndexFor(o.name);
  if (cosmosLink) {
    cosmosLink.style.display = cosmosIdx === null ? "none" : "";
    cosmosLink.dataset.cosmosIndex = cosmosIdx === null ? "" : String(cosmosIdx);
  }

  const notesEl = document.getElementById("detail-notes") as HTMLTextAreaElement;
  if (notesEl) notesEl.value = loadNotes()[o.name] || "";
  updateNotesCount("detail-notes-count", notesEl?.value.length || 0);

  document.getElementById("detail-modal").classList.add("open");
  try { history.replaceState(null, "", "#object/" + encodeURIComponent(o.name)); } catch (e) {}
  window.dispatchEvent(new CustomEvent("singularity:detailopen", { detail: { name: o.name, spin: o.spin } }));
}

// open an object's detail modal by name (used by the #object/<name> deep link)
export function openObjectByName(name: string): boolean {
  const o = REGISTRY.get(name);
  if (o) openDetail(o);
  return !!o;
}

function wireDetail() {
  const modal = document.getElementById("detail-modal");
  const close = () => {
    modal.classList.remove("open");
    if (location.hash.startsWith("#object/")) { try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {} }
    window.speechSynthesis?.cancel();
    const readBtn = document.getElementById("detail-read-aloud");
    if (readBtn) readBtn.textContent = "🔊 Read aloud";
    stopAutoplay();
  };

  // star icon (and S key) favorites the object currently open in the detail modal
  const toggleDetailFav = () => {
    const name = document.getElementById("detail-name").textContent;
    if (!name) return;
    toggleFav(name);
    const favBtn = document.getElementById("detail-fav");
    if (favBtn) {
      favBtn.textContent = isFavorited(name) ? "★" : "☆";
      favBtn.classList.toggle("on", isFavorited(name));
    }
    const favNav = document.querySelector(".detail-nav-fav") as HTMLElement | null;
    if (favNav) favNav.style.display = favs.size ? "" : "none";
    toast(isFavorited(name) ? `${name} added to favorites` : `${name} removed from favorites`);
  };
  document.getElementById("detail-fav")?.addEventListener("click", toggleDetailFav);
  window.addEventListener("keydown", (e) => {
    if ((e.key === "s" || e.key === "S") && !e.metaKey && !e.ctrlKey
      && modal.classList.contains("open")
      && !document.querySelector("input:focus, textarea:focus")) toggleDetailFav();
  });

  // click a portrait to see it larger in a lightbox
  const lightbox = document.getElementById("portrait-lightbox");
  const lightboxImg = document.getElementById("portrait-lightbox-img") as HTMLImageElement | null;
  document.getElementById("detail-img")?.addEventListener("click", () => {
    const src = (document.getElementById("detail-img") as HTMLImageElement)?.src;
    if (!src || !lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxImg.alt = (document.getElementById("detail-img") as HTMLImageElement).alt;
    lightbox.classList.add("open");
  });
  lightbox?.addEventListener("click", () => lightbox.classList.remove("open"));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") lightbox?.classList.remove("open"); });

  document.getElementById("cat-grid").addEventListener("click", (e) => {
    const card = (e.target as HTMLElement).closest(".obj-card") as HTMLElement | null;
    if (!card) return;
    const o = REGISTRY.get(decodeURIComponent(card.dataset.name));
    if (o) openDetail(o);
  });

  modal.querySelector("[data-detail-close]").addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  // hover a stat label to see a plain-English explanation, reusing the catalog card tooltip
  const statTooltip = document.getElementById("cat-tooltip");
  const statsEl = document.getElementById("detail-stats");
  statsEl?.addEventListener("mouseover", (e) => {
    const lab = (e.target as HTMLElement).closest(".lab") as HTMLElement | null;
    if (!statTooltip || !lab) return;
    const explain = STAT_EXPLANATIONS[lab.dataset.statKey || ""];
    if (explain) statTooltip.textContent = explain;
  });
  statsEl?.addEventListener("mousemove", (e) => {
    const lab = (e.target as HTMLElement).closest(".lab");
    if (!statTooltip) return;
    if (!lab) { statTooltip.classList.remove("show"); return; }
    statTooltip.style.left = (e as MouseEvent).clientX + "px";
    statTooltip.style.top = (e as MouseEvent).clientY + "px";
    statTooltip.classList.add("show");
  });
  statsEl?.addEventListener("mouseleave", () => statTooltip?.classList.remove("show"));

  // step through the currently rendered list from inside the modal
  const stepDetail = (dir: number) => {
    const name = document.getElementById("detail-name").textContent;
    if (!currentList.length) return;
    let i = currentList.findIndex(o => o.name === name);
    i = ((i + dir) % currentList.length + currentList.length) % currentList.length;
    window.speechSynthesis?.cancel();
    const readBtn = document.getElementById("detail-read-aloud");
    if (readBtn) readBtn.textContent = "🔊 Read aloud";
    openDetail(currentList[i]);
  };
  // Home/End: jump straight to the first or last object in the currently rendered list
  const jumpToEdge = (edge: "first" | "last") => {
    if (!currentList.length) return;
    window.speechSynthesis?.cancel();
    const readBtn = document.getElementById("detail-read-aloud");
    if (readBtn) readBtn.textContent = "🔊 Read aloud";
    openDetail(edge === "first" ? currentList[0] : currentList[currentList.length - 1]);
  };
  // auto-advance through the currently rendered list every few seconds, until paused
  // or interrupted by any manual navigation
  const AUTOPLAY_MS = 4000;
  const autoplayBtn = document.getElementById("dn-autoplay");
  let autoplayTimer: ReturnType<typeof setInterval> | null = null;
  const stopAutoplay = () => {
    if (!autoplayTimer) return;
    clearInterval(autoplayTimer);
    autoplayTimer = null;
    if (autoplayBtn) { autoplayBtn.textContent = "▶ Slideshow"; autoplayBtn.classList.remove("active"); }
  };
  const startAutoplay = () => {
    if (!currentList.length) return;
    autoplayTimer = setInterval(() => stepDetail(1), AUTOPLAY_MS);
    if (autoplayBtn) { autoplayBtn.textContent = "⏸ Slideshow"; autoplayBtn.classList.add("active"); }
  };
  autoplayBtn?.addEventListener("click", () => { autoplayTimer ? stopAutoplay() : startAutoplay(); });

  document.getElementById("dn-prev")?.addEventListener("click", () => { stopAutoplay(); stepDetail(-1); });
  document.getElementById("dn-next")?.addEventListener("click", () => { stopAutoplay(); stepDetail(1); });

  // step through only favorited objects, wherever the currently open object falls in that list
  const stepFavorite = (dir: number) => {
    const favorites = getCatalogFavorites();
    if (!favorites.length) return;
    const name = document.getElementById("detail-name").textContent;
    let i = favorites.findIndex(o => o.name === name);
    i = i === -1 ? (dir > 0 ? 0 : favorites.length - 1) : ((i + dir) % favorites.length + favorites.length) % favorites.length;
    window.speechSynthesis?.cancel();
    const readBtn = document.getElementById("detail-read-aloud");
    if (readBtn) readBtn.textContent = "🔊 Read aloud";
    openDetail(favorites[i]);
  };
  document.getElementById("dn-fav-prev")?.addEventListener("click", () => { stopAutoplay(); stepFavorite(-1); });
  document.getElementById("dn-fav-next")?.addEventListener("click", () => { stopAutoplay(); stepFavorite(1); });

  document.getElementById("detail-similar")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("button[data-similar-name]") as HTMLElement | null;
    if (!btn) return;
    stopAutoplay();
    const o = REGISTRY.get(decodeURIComponent(btn.dataset.similarName));
    if (o) openDetail(o);
  });

  // personal notes: save as the user types
  document.getElementById("detail-notes")?.addEventListener("input", (e) => {
    const val = (e.target as HTMLTextAreaElement).value;
    const name = document.getElementById("detail-name").textContent;
    if (name) saveNote(name, val);
    updateNotesCount("detail-notes-count", val.length);
  });

  document.getElementById("detail-print")?.addEventListener("click", () => window.print());

  document.getElementById("detail-read-aloud")?.addEventListener("click", () => {
    const btn = document.getElementById("detail-read-aloud");
    if (!window.speechSynthesis) { toast("Speech isn't supported in this browser."); return; }
    if (window.speechSynthesis.speaking) { window.speechSynthesis.cancel(); btn.textContent = "🔊 Read aloud"; return; }
    const name = document.getElementById("detail-name").textContent || "";
    const desc = (document.getElementById("detail-desc").textContent || "").trim();
    const utter = new SpeechSynthesisUtterance(`${name}. ${desc}`);
    utter.onend = () => { btn.textContent = "🔊 Read aloud"; };
    utter.onerror = () => { btn.textContent = "🔊 Read aloud"; };
    btn.textContent = "⏹ Stop reading";
    window.speechSynthesis.speak(utter);
  });

  document.getElementById("detail-download-card")?.addEventListener("click", () => downloadObjectCard());

  document.getElementById("detail-share-text")?.addEventListener("click", () => {
    const name = document.getElementById("detail-name").textContent || "";
    const alias = document.getElementById("detail-alias").textContent || "";
    const stats = [...document.querySelectorAll("#detail-stats .dstat")]
      .map(el => `${el.querySelector(".lab")?.textContent}: ${el.querySelector(".val")?.textContent}`)
      .join("\n");
    const desc = (document.getElementById("detail-desc").textContent || "").trim();
    const text = `${name} — ${alias}\n${stats}\n\n${desc}`;
    navigator.clipboard?.writeText(text).then(
      () => toast("Object details copied to clipboard."),
      () => toast(text),
    );
  });

  document.getElementById("detail-native-share")?.addEventListener("click", async () => {
    const name = document.getElementById("detail-name").textContent || "";
    const alias = document.getElementById("detail-alias").textContent || "";
    const url = `${location.origin}${location.pathname}#object/${encodeURIComponent(name)}`;
    const shareData = { title: name, text: alias ? `${name} — ${alias}` : name, url };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch (e) { /* user cancelled */ }
    } else {
      navigator.clipboard?.writeText(url).then(
        () => toast("Link copied — your browser doesn't support the native share sheet."),
        () => toast(url),
      );
    }
  });

  document.getElementById("detail-copy-citation")?.addEventListener("click", () => {
    const name = document.getElementById("detail-name").textContent || "";
    const source = (document.getElementById("detail-source") as HTMLAnchorElement)?.href || "";
    const accessed = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    const citation = `"${name}." SINGULARITY: A Real-Time Black Hole Simulator. Source: ${source}. Accessed ${accessed}.`;
    navigator.clipboard?.writeText(citation).then(
      () => toast("Citation copied to clipboard."),
      () => toast(citation),
    );
  });

  // cross-link into the cosmos: close everything here, then hand off via the hash router
  document.getElementById("detail-cosmos-link")?.addEventListener("click", (e) => {
    const idx = (e.currentTarget as HTMLElement).dataset.cosmosIndex;
    if (idx === undefined || idx === "") return;
    close();
    document.querySelectorAll(".panel.open").forEach(p => p.classList.remove("open"));
    document.querySelectorAll(".nav-pills button[data-view]").forEach(b =>
      b.classList.toggle("active", (b as HTMLElement).dataset.view === "sim"));
    // setting location.hash fires "hashchange" naturally, except when the hash is
    // already this exact value — cover that edge case with an explicit re-dispatch.
    if (location.hash === "#cosmos/" + idx) window.dispatchEvent(new HashChangeEvent("hashchange"));
    else location.hash = "cosmos/" + idx;
  });
  document.addEventListener("keydown", (e) => {
    if (!modal.classList.contains("open")) return;
    if ((e.target as HTMLElement)?.id === "detail-notes") return;   // let arrow keys move the cursor while typing a note
    if (e.key === "ArrowLeft" && e.shiftKey) { e.stopPropagation(); stopAutoplay(); stepFavorite(-1); }
    else if (e.key === "ArrowRight" && e.shiftKey) { e.stopPropagation(); stopAutoplay(); stepFavorite(1); }
    else if (e.key === "ArrowLeft") { e.stopPropagation(); stopAutoplay(); stepDetail(-1); }
    else if (e.key === "ArrowRight") { e.stopPropagation(); stopAutoplay(); stepDetail(1); }
    else if (e.key === "Home") { e.stopPropagation(); e.preventDefault(); stopAutoplay(); jumpToEdge("first"); }
    else if (e.key === "End") { e.stopPropagation(); e.preventDefault(); stopAutoplay(); jumpToEdge("last"); }
  }, true);   // capture: runs before the journey's arrow-key handler
}

function buildFeatures() {
  buildAnatomy(document.getElementById("feature-grid"));
  renderFeaturesExploredBadge();
}

// tracks which of the 10 Anatomy feature cards the user has opened for a full read
const FEATURES_EXPLORED_KEY = "singularity.featuresExplored";
function loadFeaturesExplored(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(FEATURES_EXPLORED_KEY) || "[]")); } catch (e) { return new Set(); }
}
function renderFeaturesExploredBadge() {
  const el = document.getElementById("features-explored-badge");
  if (!el) return;
  const explored = loadFeaturesExplored();
  el.textContent = `${explored.size} / ${FEATURES.length} explored`;
}

function chipLabel(o) {
  return o.category === "quasar" ? "Quasar" : o.category === "pulsar" ? "Pulsar" : "Black Hole";
}

// ---- favorites (persisted) ----
const FAV_KEY = "singularity.favs";
const favs = new Set<string>(JSON.parse((() => { try { return localStorage.getItem(FAV_KEY) || "[]"; } catch (e) { return "[]"; } })()));
function updateFavCount() {
  const el = document.getElementById("fav-count");
  if (el) el.textContent = favs.size ? String(favs.size) : "";
}
export function getCatalogFavorites(): any[] {
  return [...favs].map(name => REGISTRY.get(name)).filter(Boolean);
}
const RECENT_FAV_KEY = "singularity.recentFavs";
let recentFavs: string[] = (() => { try { return JSON.parse(localStorage.getItem(RECENT_FAV_KEY) || "[]"); } catch (e) { return []; } })();
export function getRecentlyFavorited(): string[] { return recentFavs; }
export function clearCatalogFavorites() {
  favs.clear();
  try { localStorage.setItem(FAV_KEY, JSON.stringify([])); } catch (e) {}
  updateFavCount();
}
export function toggleFav(name: string) {
  const adding = !favs.has(name);
  favs.has(name) ? favs.delete(name) : favs.add(name);
  try { localStorage.setItem(FAV_KEY, JSON.stringify([...favs])); } catch (e) {}
  if (adding) {
    recentFavs = [name, ...recentFavs.filter(n => n !== name)].slice(0, MAX_RECENT);
    try { localStorage.setItem(RECENT_FAV_KEY, JSON.stringify(recentFavs)); } catch (e) {}
  }
  updateFavCount();
  if (favs.size >= 5) unlockAchievement("collector");
  window.dispatchEvent(new CustomEvent("singularity:favtoggle"));
}
function isFavorited(name: string): boolean { return favs.has(name); }

// the ordered list currently rendered in the grid (drives modal prev/next)
let currentList: any[] = [];
// the active search query (drives match highlighting on cards)
let currentQuery = "";
function hi(s: string) {
  if (!currentQuery || !s) return s;
  const i = s.toLowerCase().indexOf(currentQuery);
  if (i < 0) return s;
  return s.slice(0, i) + "<mark>" + s.slice(i, i + currentQuery.length) + "</mark>" + s.slice(i + currentQuery.length);
}

// ---- compare mode: pin one object, pick another, view side by side ----
let comparePin: string | null = null;
const CMP_ROWS: Array<[string, string]> = [
  ["alias", "Alias"], ["type", "Type"], ["mass", "Mass"], ["period", "Spin Period"],
  ["distance", "Distance"], ["diameter", "Ø Event Horizon"], ["spin", "Spin (a)"],
  ["field", "Magnetic Field"], ["age", "Age"], ["discovered", "Discovered"],
];
function updateComparePin() {
  const chip = document.getElementById("cmp-pin");
  if (!chip) return;
  chip.innerHTML = comparePin ? `⇄ Comparing: <b>${comparePin}</b><button aria-label="Clear compare pin">✕</button>` : "";
  chip.classList.toggle("show", !!comparePin);
  chip.querySelector("button")?.addEventListener("click", () => { comparePin = null; updateComparePin(); toast("Compare pin cleared."); });
}
function pickCompare(name: string) {
  if (!comparePin) {
    comparePin = name;
    updateComparePin();
    toast(`Pinned ${name} — tap ⇄ on another object to compare.`);
    return;
  }
  if (comparePin === name) { comparePin = null; updateComparePin(); toast("Compare pin cleared."); return; }
  openCompare(REGISTRY.get(comparePin), REGISTRY.get(name));
  comparePin = null;
  updateComparePin();
}
// remembers the last few compared pairs so they can be reopened with one click
const COMPARE_HISTORY_KEY = "singularity.compareHistory";
const MAX_COMPARE_HISTORY = 5;
function loadCompareHistory(): [string, string][] {
  try { return JSON.parse(localStorage.getItem(COMPARE_HISTORY_KEY) || "[]"); } catch (e) { return []; }
}
function renderCompareHistory() {
  const list = document.getElementById("compare-history-list");
  const wrap = document.getElementById("compare-history");
  if (!list || !wrap) return;
  const hist = loadCompareHistory();
  list.innerHTML = hist.map(([a, b]) =>
    `<button class="compare-history-item" data-a="${encodeURIComponent(a)}" data-b="${encodeURIComponent(b)}">${a} vs ${b}</button>`).join("");
  wrap.style.display = hist.length ? "block" : "none";
}
function recordCompareHistory(nameA: string, nameB: string) {
  let hist = loadCompareHistory().filter(([a, b]) => !(a === nameA && b === nameB) && !(a === nameB && b === nameA));
  hist = [[nameA, nameB] as [string, string], ...hist].slice(0, MAX_COMPARE_HISTORY);
  try { localStorage.setItem(COMPARE_HISTORY_KEY, JSON.stringify(hist)); } catch (e) {}
  bumpCompareCount(nameA, nameB);
  renderCompareHistory();
}
// tallies how many times each unordered pair has been compared, to surface the most-compared pair
const COMPARE_COUNTS_KEY = "singularity.compareCounts";
function loadCompareCounts(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(COMPARE_COUNTS_KEY) || "{}") || {}; } catch (e) { return {}; }
}
function pairKey(a: string, b: string): string { return [a, b].sort().join("␟"); }
function bumpCompareCount(a: string, b: string) {
  const counts = loadCompareCounts();
  const key = pairKey(a, b);
  counts[key] = (counts[key] || 0) + 1;
  try { localStorage.setItem(COMPARE_COUNTS_KEY, JSON.stringify(counts)); } catch (e) {}
  renderMostCompared();
}
function renderMostCompared() {
  const el = document.getElementById("compare-most");
  if (!el) return;
  const counts = loadCompareCounts();
  let bestKey = "", bestN = 0;
  for (const [k, n] of Object.entries(counts)) if (n > bestN) { bestN = n; bestKey = k; }
  if (bestN < 2) { el.style.display = "none"; return; }
  const [a, b] = bestKey.split("␟");
  el.innerHTML = `Most compared: <b>${a}</b> vs <b>${b}</b> — ${bestN}×`;
  el.style.display = "block";
}
let currentCompareA: any = null, currentCompareB: any = null;
function openCompare(a, b) {
  if (!a || !b) return;
  currentCompareA = a; currentCompareB = b;
  const grid = document.getElementById("compare-grid");
  const col = (o) => `
    <div class="cmp-col">
      <img src="${portraitDataURL(o, 460, 240)}" alt="Rendered portrait of ${o.name}">
      <h3>${o.name}</h3>
      ${CMP_ROWS.filter(([k]) => a[k] || b[k]).map(([k, lab]) =>
        `<div class="cmp-row"><span>${lab}</span><b>${o[k] || "—"}</b></div>`).join("")}
    </div>`;
  grid.innerHTML = col(a) + col(b);
  renderCompareRadar(a, b);
  document.getElementById("compare-modal").classList.add("open");
  recordCompareHistory(a.name, b.name);
}
// axes with clean, reliably-parseable magnitudes; "field" and "discovered" are excluded
// since they use unicode-superscript exponents / years rather than plain numbers
const RADAR_AXES: Array<[string, string]> = [
  ["mass", "Mass"], ["distance", "Distance"], ["diameter", "Horizon Ø"], ["spin", "Spin"], ["period", "Spin Period"], ["age", "Age"],
];
function renderCompareRadar(a: any, b: any) {
  const wrap = document.getElementById("compare-radar-wrap");
  const svg = document.getElementById("compare-radar");
  const legend = document.getElementById("compare-radar-legend");
  if (!wrap || !svg || !legend) return;
  const axes = RADAR_AXES.filter(([k]) => parseSci(a[k]) > 0 && parseSci(b[k]) > 0).slice(0, 5);
  if (axes.length < 3) { wrap.classList.remove("show"); svg.innerHTML = ""; legend.innerHTML = ""; return; }
  wrap.classList.add("show");
  const cx = 130, cy = 130, maxR = 96;
  const angleFor = (i: number) => -Math.PI / 2 + i * (2 * Math.PI / axes.length);
  const polygon = (o: any) => axes.map(([k], i) => {
    const va = parseSci(a[k]), vb = parseSci(b[k]);
    const la = Math.log10(va + 1), lb = Math.log10(vb + 1);
    const total = la + lb || 1;
    const share = 0.12 + 0.88 * (Math.log10(parseSci(o[k]) + 1) / total);
    const ang = angleFor(i);
    return [cx + Math.cos(ang) * maxR * share, cy + Math.sin(ang) * maxR * share];
  });
  const toPath = (pts: number[][]) => pts.map(p => p.join(",")).join(" ");
  const rings = [0.25, 0.5, 0.75, 1].map(f =>
    `<polygon points="${toPath(axes.map((_, i) => { const ang = angleFor(i); return [cx + Math.cos(ang) * maxR * f, cy + Math.sin(ang) * maxR * f]; }))}" class="radar-ring" />`).join("");
  const spokes = axes.map((_, i) => {
    const ang = angleFor(i);
    return `<line x1="${cx}" y1="${cy}" x2="${cx + Math.cos(ang) * maxR}" y2="${cy + Math.sin(ang) * maxR}" class="radar-spoke" />`;
  }).join("");
  const labels = axes.map(([, lab], i) => {
    const ang = angleFor(i);
    const lx = cx + Math.cos(ang) * (maxR + 20), ly = cy + Math.sin(ang) * (maxR + 20);
    return `<text x="${lx}" y="${ly}" class="radar-label" text-anchor="middle" dominant-baseline="middle">${lab}</text>`;
  }).join("");
  svg.innerHTML = `${rings}${spokes}
    <polygon points="${toPath(polygon(a))}" class="radar-poly radar-poly-a" />
    <polygon points="${toPath(polygon(b))}" class="radar-poly radar-poly-b" />
    ${labels}`;
  legend.innerHTML = `<span class="radar-legend-a">■ ${a.name}</span><span class="radar-legend-b">■ ${b.name}</span>`;
}
function wireCompare() {
  const modal = document.getElementById("compare-modal");
  modal.querySelector("[data-compare-close]").addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") modal.classList.remove("open"); });
  document.getElementById("compare-download-btn")?.addEventListener("click", () => downloadCompareCard());
  document.getElementById("compare-swap-btn")?.addEventListener("click", () => {
    if (currentCompareA && currentCompareB) openCompare(currentCompareB, currentCompareA);
  });
  document.getElementById("compare-history-clear")?.addEventListener("click", () => {
    try { localStorage.removeItem(COMPARE_HISTORY_KEY); localStorage.removeItem(COMPARE_COUNTS_KEY); } catch (e) {}
    renderCompareHistory();
    renderMostCompared();
    toast("Comparison history cleared.");
  });
  document.getElementById("compare-history-list")?.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("[data-a]") as HTMLElement | null;
    if (!btn) return;
    const a = REGISTRY.get(decodeURIComponent(btn.dataset.a));
    const b = REGISTRY.get(decodeURIComponent(btn.dataset.b));
    if (a && b) openCompare(a, b);
  });
  renderCompareHistory();
  renderMostCompared();
}

// ---------- cosmic trivia mini-quiz ----------
const TRIVIA = [
  { q: "Which object was the first black hole ever directly imaged?", options: ["Sagittarius A*", "M87* (Pōwehi)", "TON 618"], correct: 1 },
  { q: "Which famous physicist lost a wager over Cygnus X-1, conceding in 1990?", options: ["Einstein", "Feynman", "Hawking"], correct: 2 },
  { q: "Roughly how many times the Sun's mass is TON 618?", options: ["40 thousand", "40 million", "40 billion"], correct: 2 },
  { q: "About how many times per second does the Crab Pulsar spin?", options: ["3", "30", "300"], correct: 1 },
  { q: "In what year did the Event Horizon Telescope image Sagittarius A*?", options: ["2019", "2022", "2025"], correct: 1 },
];
// best trivia score + total games played, persisted locally
const TRIVIA_KEY = "singularity.trivia";
function loadTriviaStats(): { best: number; plays: number } {
  try {
    const s = JSON.parse(localStorage.getItem(TRIVIA_KEY) || "null");
    return s && typeof s === "object" ? { best: s.best || 0, plays: s.plays || 0 } : { best: 0, plays: 0 };
  } catch (e) { return { best: 0, plays: 0 }; }
}
function saveTriviaStats(s: { best: number; plays: number }) {
  try { localStorage.setItem(TRIVIA_KEY, JSON.stringify(s)); } catch (e) {}
}
function wireTrivia() {
  const modal = document.getElementById("trivia-modal");
  if (!modal) return;
  let qi = 0, score = 0, finished = false;
  const progressEl = document.getElementById("trivia-progress");
  const qEl = document.getElementById("trivia-question");
  const optsEl = document.getElementById("trivia-options");
  const resultEl = document.getElementById("trivia-result");
  const nextBtn = document.getElementById("trivia-next");
  const bestSuffix = () => {
    const { best, plays } = loadTriviaStats();
    return plays ? ` · Best ${best} / ${TRIVIA.length} (${plays} play${plays === 1 ? "" : "s"})` : "";
  };
  const showQuestion = () => {
    const t = TRIVIA[qi];
    progressEl.textContent = `Question ${qi + 1} of ${TRIVIA.length} · Score ${score}${bestSuffix()}`;
    qEl.textContent = t.q;
    resultEl.textContent = "";
    nextBtn.classList.remove("show");
    shareBtn?.classList.remove("show");
    optsEl.innerHTML = t.options.map((o, i) => `<button data-i="${i}">${o}</button>`).join("");
  };
  const start = () => { qi = 0; score = 0; finished = false; showQuestion(); modal.classList.add("open"); };
  optsEl.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest("button[data-i]") as HTMLElement | null;
    if (!btn || btn.hasAttribute("disabled")) return;
    const t = TRIVIA[qi];
    const chosen = parseInt(btn.dataset.i, 10);
    optsEl.querySelectorAll("button").forEach(b => b.setAttribute("disabled", "true"));
    btn.classList.add(chosen === t.correct ? "correct" : "wrong");
    if (chosen === t.correct) { score++; resultEl.textContent = "Correct!"; }
    else {
      optsEl.querySelector(`button[data-i="${t.correct}"]`)?.classList.add("correct");
      resultEl.textContent = `Not quite — it's "${t.options[t.correct]}".`;
    }
    progressEl.textContent = `Question ${qi + 1} of ${TRIVIA.length} · Score ${score}${bestSuffix()}`;
    nextBtn.classList.add("show");
    nextBtn.textContent = qi < TRIVIA.length - 1 ? "Next ›" : "See result";
  });
  nextBtn.addEventListener("click", () => {
    if (finished) { start(); return; }
    qi++;
    if (qi >= TRIVIA.length) {
      finished = true;
      const stats = loadTriviaStats();
      stats.plays++;
      const isNewBest = score > stats.best;
      if (isNewBest) stats.best = score;
      saveTriviaStats(stats);
      if (score === TRIVIA.length) unlockAchievement("quiz-whiz");
      progressEl.textContent = "Finished!";
      qEl.textContent = `You scored ${score} / ${TRIVIA.length}.` + (isNewBest && stats.plays > 1 ? " New best!" : "");
      optsEl.innerHTML = "";
      resultEl.textContent = `Best: ${stats.best} / ${TRIVIA.length} across ${stats.plays} play${stats.plays === 1 ? "" : "s"}.`;
      nextBtn.textContent = "Play again";
      nextBtn.classList.add("show");
      shareBtn?.classList.add("show");
    } else showQuestion();
  });
  const shareBtn = document.getElementById("trivia-share");
  shareBtn?.addEventListener("click", () => {
    const text = `I scored ${score} / ${TRIVIA.length} on SINGULARITY's Cosmic Trivia! 🎯`;
    navigator.clipboard?.writeText(text).then(
      () => toast("Score copied to clipboard."),
      () => toast(text),
    );
  });
  document.getElementById("help-trivia")?.addEventListener("click", start);
  modal.querySelector("[data-trivia-close]")?.addEventListener("click", () => modal.classList.remove("open"));
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });
}

// ---- anatomy card focus: click a card to read it full-size ----
const FEATURE_BY_ID = new Map(FEATURES.map(f => [f.id, f]));
function wireFeatureFocus() {
  const modal = document.getElementById("feature-focus-modal");
  if (!modal) return;
  const close = () => { modal.classList.remove("open"); setFeatureFocus(null); };
  document.getElementById("feature-grid")?.addEventListener("click", (e) => {
    const card = (e.target as HTMLElement).closest(".feature-card") as HTMLElement | null;
    if (!card) return;
    const f = FEATURE_BY_ID.get(card.dataset.featureId);
    if (!f) return;
    document.getElementById("ff-icon").textContent = f.icon;
    document.getElementById("ff-name").textContent = f.name;
    document.getElementById("ff-text").textContent = f.text;
    modal.classList.add("open");
    setFeatureFocus(f.id, document.getElementById("feature-focus-canvas") as HTMLCanvasElement);
    const explored = loadFeaturesExplored();
    if (!explored.has(f.id)) {
      explored.add(f.id);
      try { localStorage.setItem(FEATURES_EXPLORED_KEY, JSON.stringify([...explored])); } catch (err) {}
      renderFeaturesExploredBadge();
      if (explored.size === FEATURES.length) toast("🔭 You've explored every part of a black hole's anatomy!");
    }
  });
  modal.querySelector("[data-feature-focus-close]")?.addEventListener("click", close);
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("open")) close(); });
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
  if (cat === "pulsar") return PULSARS;
  if (cat === "quasar") return BLACK_HOLES.filter(o => o.category === "quasar");
  if (cat === "blackhole") return BLACK_HOLES.filter(o => o.category === "blackhole");
  if (cat === "fav") return [...BLACK_HOLES, ...PULSARS].filter(o => favs.has(o.name));
  return [...BLACK_HOLES, ...PULSARS];
}

// parse "53.5 million ly" / "6.5 billion M☉" / "7,200 ly" → comparable number
export function parseSci(s: string): number {
  if (!s) return 0;
  const m = s.replace(/,/g, "").match(/([\d.]+)/);
  let n = m ? parseFloat(m[1]) : 0;
  if (/billion|Bly/i.test(s)) n *= 1e9;
  else if (/million|Mly/i.test(s)) n *= 1e6;
  return n;
}
// distance in human terms: light-travel time + a relatable age comparison
export function distancePerspective(ly: number): string {
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  let analogy: string;
  if (ly < 100) analogy = "light left there within a human lifetime.";
  else if (ly < 5000) analogy = "about as long ago as the Great Pyramid of Giza was built (~4,500 years).";
  else if (ly < 300000) analogy = "longer than Homo sapiens has existed as a species (~300,000 years).";
  else if (ly < 66000000) analogy = "longer ago than the dinosaurs went extinct (~66 million years).";
  else if (ly < 4600000000) analogy = "a meaningful fraction of Earth's entire age (~4.6 billion years).";
  else analogy = "close to the age of the universe itself (~13.8 billion years).";
  return `Light takes <b>${fmt(ly)} years</b> to reach us from here — ${analogy}`;
}
// pull a sortable 4-digit year out of free-text discovery notes ("1967 by Jocelyn Bell Burnell")
function parseYear(s: string): number {
  const m = (s || "").match(/\d{4}/);
  return m ? parseInt(m[0], 10) : 9999;
}
function shuffledCopy<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// bucket a distance-in-light-years value into a coarse proximity zone
function distBucketFor(ly: number): string {
  if (ly < 1e6) return "local";       // within the Milky Way
  if (ly < 1e9) return "galactic";    // other nearby galaxies
  return "deep";                      // billions of light-years out
}
function buildCatalog() {
  const grid = document.getElementById("cat-grid");
  const search = document.getElementById("cat-search") as HTMLInputElement;
  const sort = document.getElementById("cat-sort") as HTMLSelectElement;
  let cat = "all";
  let distBucket = "all";
  let constellationFilter = "all";
  let shuffleSeed: string[] | null = null;
  const render = () => {
    const q = (search?.value || "").trim().toLowerCase();
    currentQuery = q;
    let list = listFor(cat).filter(o => !q || o.name.toLowerCase().includes(q) || (o.alias || "").toLowerCase().includes(q));
    if (distBucket !== "all") list = list.filter(o => distBucketFor(parseSci(o.distance)) === distBucket);
    if (constellationFilter !== "all") list = list.filter(o => o.constellation === constellationFilter);
    const by = sort?.value || "rank";
    if (by === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else if (by === "distance") list = [...list].sort((a, b) => parseSci(a.distance) - parseSci(b.distance));
    else if (by === "mass") list = [...list].sort((a, b) => parseSci(a.mass || a.period || "") - parseSci(b.mass || b.period || ""));
    else if (by === "discovered") list = [...list].sort((a, b) => parseYear(a.discovered) - parseYear(b.discovered));
    else if (by === "favfirst") list = [...list].sort((a, b) => (favs.has(b.name) ? 1 : 0) - (favs.has(a.name) ? 1 : 0));
    else if (by === "shuffle" && shuffleSeed) {
      const order = new Map(shuffleSeed.map((n, i) => [n, i]));
      list = [...list].sort((a, b) => (order.get(a.name) ?? 0) - (order.get(b.name) ?? 0));
    }
    currentList = list;
    grid.innerHTML = list.length
      ? list.map((o, i) => objCard(o, i + 1)).join("")
      : `<p class="cat-empty">${cat === "fav" && !q ? "No favorites yet — tap ☆ on any object to save it here." : q ? `No objects match “${q}”.` : "No objects in this range."}</p>`;
  };
  render();
  window.addEventListener("singularity:favtoggle", render);
  // star toggles favorite (registered before the detail handler; stops it)
  grid.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const f = t.closest(".fav-btn") as HTMLElement | null;
    if (f) {
      e.stopImmediatePropagation();
      toggleFav(decodeURIComponent(f.dataset.favname));
      render();
      return;
    }
    const c = t.closest(".cmp-btn") as HTMLElement | null;
    if (c) {
      e.stopImmediatePropagation();
      pickCompare(decodeURIComponent(c.dataset.cmpname));
    }
  });
  // hover a card to preview its fact in a floating tooltip
  const tooltip = document.getElementById("cat-tooltip");
  grid.addEventListener("mouseover", (e) => {
    const card = (e.target as HTMLElement).closest(".obj-card") as HTMLElement | null;
    if (!tooltip || !card) return;
    const o = REGISTRY.get(decodeURIComponent(card.dataset.name));
    if (o) tooltip.innerHTML = `<b>${o.tag}</b> ${o.fact}`;
  });
  grid.addEventListener("mousemove", (e) => {
    const card = (e.target as HTMLElement).closest(".obj-card");
    if (!tooltip) return;
    if (!card) { tooltip.classList.remove("show"); return; }
    tooltip.style.left = (e as MouseEvent).clientX + "px";
    tooltip.style.top = (e as MouseEvent).clientY + "px";
    tooltip.classList.add("show");
  });
  grid.addEventListener("mouseleave", () => tooltip?.classList.remove("show"));
  document.querySelectorAll(".cat-tabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".cat-tabs button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      cat = (btn as HTMLElement).dataset.cat;
      render();
      document.querySelector("#panel-catalog .panel-inner")?.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
  // hover a category tab to see a plain-English explanation of the term
  const catTabsEl = document.querySelector(".cat-tabs");
  catTabsEl?.addEventListener("mouseover", (e) => {
    const btn = (e.target as HTMLElement).closest("button[data-cat]") as HTMLElement | null;
    if (!tooltip || !btn) return;
    const explain = CATEGORY_GLOSSARY[btn.dataset.cat || ""];
    if (explain) tooltip.textContent = explain;
  });
  catTabsEl?.addEventListener("mousemove", (e) => {
    const btn = (e.target as HTMLElement).closest("button[data-cat]") as HTMLElement | null;
    if (!tooltip) return;
    if (!btn || !CATEGORY_GLOSSARY[btn.dataset.cat || ""]) { tooltip.classList.remove("show"); return; }
    tooltip.style.left = (e as MouseEvent).clientX + "px";
    tooltip.style.top = (e as MouseEvent).clientY + "px";
    tooltip.classList.add("show");
  });
  catTabsEl?.addEventListener("mouseleave", () => tooltip?.classList.remove("show"));
  document.querySelectorAll(".cat-dist-tabs button").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".cat-dist-tabs button").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      distBucket = (btn as HTMLElement).dataset.dist;
      render();
    });
  });
  const constellationSelect = document.getElementById("cat-constellation") as HTMLSelectElement | null;
  if (constellationSelect) {
    const constellations = [...new Set(listFor("all").map(o => o.constellation).filter(Boolean))].sort();
    constellationSelect.innerHTML = `<option value="all">All Constellations</option>` +
      constellations.map(c => `<option value="${c}">${c}</option>`).join("");
    constellationSelect.addEventListener("change", () => {
      constellationFilter = constellationSelect.value;
      render();
    });
  }
  search?.addEventListener("input", render);
  sort?.addEventListener("change", () => {
    if (sort.value === "shuffle") {
      shuffleSeed = shuffledCopy([...BLACK_HOLES, ...PULSARS]).map(o => o.name);
    }
    render();
  });
  // open a random object from the active tab
  document.getElementById("cat-random")?.addEventListener("click", () => {
    const list = listFor(cat === "fav" && !listFor("fav").length ? "all" : cat);
    if (list.length) openDetail(list[Math.floor(Math.random() * list.length)]);
  });
  // compact list view: a denser row layout for scanning many objects at once, persisted locally
  const CAT_VIEW_KEY = "singularity.catalogView";
  const viewToggleBtn = document.getElementById("cat-view-toggle");
  const applyCatView = (compact: boolean) => {
    grid.classList.toggle("compact", compact);
    if (viewToggleBtn) viewToggleBtn.textContent = compact ? "▦ Card view" : "☰ List view";
  };
  applyCatView(localStorage.getItem(CAT_VIEW_KEY) === "compact");
  viewToggleBtn?.addEventListener("click", () => {
    const compact = !grid.classList.contains("compact");
    applyCatView(compact);
    try { localStorage.setItem(CAT_VIEW_KEY, compact ? "compact" : "card"); } catch (e) {}
  });
  document.getElementById("cat-export-csv")?.addEventListener("click", exportCatalogCSV);
  document.getElementById("cat-export-fav-csv")?.addEventListener("click", exportFavoritesCSV);
  document.getElementById("cat-random-fav")?.addEventListener("click", () => {
    const favorites = getCatalogFavorites();
    if (!favorites.length) { toast("No catalog favorites yet — star an object first."); return; }
    openDetail(favorites[Math.floor(Math.random() * favorites.length)]);
  });
  document.getElementById("cat-next-unviewed")?.addEventListener("click", () => {
    if (!openNextUnviewed()) toast("You've viewed every object in the catalog! 🎉");
  });
  document.getElementById("cat-print-checklist")?.addEventListener("click", () => {
    const items = getCatalogChecklist();
    const sheet = document.getElementById("cat-print-sheet");
    if (!sheet) return;
    const viewedN = items.filter(i => i.viewed).length;
    sheet.innerHTML = `
      <div class="cps-title">The Cosmic Catalog — Field Checklist</div>
      <div class="cps-sub">${viewedN} / ${items.length} viewed · printed ${new Date().toLocaleDateString()}</div>
      ${items.map(i => `
        <div class="cps-row${i.viewed ? " cps-viewed" : ""}">
          <span class="cps-check"></span>
          <span class="cps-name">${i.name}</span>
          <span class="cps-cat">${i.category}</span>
          ${i.favorited ? `<span class="cps-star">★</span>` : ""}
        </div>`).join("")}`;
    const notesSheet = document.getElementById("notes-print-sheet");
    if (notesSheet) notesSheet.innerHTML = "";
    document.body.classList.add("printing-catalog");
    window.print();
  });
  window.addEventListener("afterprint", () => document.body.classList.remove("printing-catalog"));
  document.getElementById("cmp-random")?.addEventListener("click", () => {
    const pool = listFor(cat === "fav" && !listFor("fav").length ? "all" : cat);
    if (pool.length < 2) { toast("Not enough objects to compare."); return; }
    const i = Math.floor(Math.random() * pool.length);
    let j = Math.floor(Math.random() * (pool.length - 1));
    if (j >= i) j++;
    openCompare(pool[i], pool[j]);
  });
}

// ---- export the full 40-object catalog as a downloadable CSV ----
const CSV_COLUMNS = ["name", "alias", "category", "type", "mass", "distance", "period", "diameter", "spin", "field", "age", "discovered", "tag"];
function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function exportCatalogCSV() {
  const rows = [CSV_COLUMNS.join(",")].concat(
    [...BLACK_HOLES, ...PULSARS].map(o => CSV_COLUMNS.map(c => csvEscape(o[c])).join(","))
  );
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "singularity-catalog.csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Catalog exported as CSV.");
}
function exportFavoritesCSV() {
  const favorites = getCatalogFavorites();
  if (!favorites.length) { toast("No catalog favorites yet — star an object first."); return; }
  const rows = [CSV_COLUMNS.join(",")].concat(
    favorites.map(o => CSV_COLUMNS.map(c => csvEscape(o[c])).join(","))
  );
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "singularity-favorites.csv";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`Exported ${favorites.length} favorite${favorites.length === 1 ? "" : "s"} as CSV.`);
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
      const v = (btn as HTMLElement).dataset.view;
      pills.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      closeAll();
      if ((panels as any)[v]) (panels as any)[v].classList.add("open");
      if (v === "features") setAnatomyActive(true);
    });
  });
  document.querySelectorAll("[data-close]").forEach(b =>
    b.addEventListener("click", () => {
      closeAll();
      pills.forEach(p => p.classList.toggle("active", (p as HTMLElement).dataset.view === "sim"));
    }));
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    // layered dismissal: when a modal is above the panel, this press closes
    // only the modal (its own handler runs next); the panel needs a second Esc.
    if (document.querySelector(".detail-modal.open, .help-modal.open")) return;
    closeAll();
    pills.forEach(p => p.classList.toggle("active", (p as HTMLElement).dataset.view === "sim"));
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
  wrap.innerHTML = STAGES.map((s, i) =>
    `<button data-stage="${i}">${s.label}</button>`).join("");
  wrap.querySelectorAll("button").forEach(b =>
    b.addEventListener("click", () => onJump(STAGES[+(b as HTMLElement).dataset.stage].t)));
  // tick marks on the track itself, one per stage, clickable
  const track = document.querySelector(".journey-track");
  if (track) {
    STAGES.forEach((s) => {
      const tick = document.createElement("i");
      tick.className = "jtick";
      tick.style.left = (s.t * 100) + "%";
      tick.title = s.name;
      tick.addEventListener("click", (e) => { e.stopPropagation(); onJump(s.t); });
      track.appendChild(tick);
    });
  }
}

export function toast(msg) {
  const wrap = document.getElementById("toast");
  if (!wrap) return;
  wrap.classList.add("stack");
  // drop the oldest when three are already showing
  while (wrap.children.length >= 3) wrap.firstElementChild.remove();
  const item = document.createElement("div");
  item.className = "toast-item";
  item.textContent = msg;
  wrap.appendChild(item);
  requestAnimationFrame(() => item.classList.add("show"));
  setTimeout(() => {
    item.classList.remove("show");
    setTimeout(() => item.remove(), 400);
  }, 2600);
}
