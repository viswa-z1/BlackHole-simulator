// ===================================================================
//  ANATOMY — looping animated visualizations ("videos") for each
//  black-hole region, drawn live on a 2D canvas per feature card.
// ===================================================================
import { FEATURES } from "./data.js";

const OR = "#ff9d3c", BL = "#5bb8ff", HOT = "#ffe6b0", WH = "#ffffff";

let canvases = [];     // { canvas, ctx, id, w, h }
let running = false;
let raf = 0;

export function buildAnatomy(gridEl) {
  gridEl.innerHTML = FEATURES.map(f => `
    <div class="feature-card" data-feature-id="${f.id}" tabindex="0">
      <div class="feature-media"><canvas data-anim="${f.id}"></canvas><span class="feature-badge">live</span></div>
      <div class="feature-body">
        <div class="ic">${f.icon}</div>
        <h4>${f.name}</h4>
        <p>${f.text}</p>
      </div>
    </div>`).join("");

  canvases = [...gridEl.querySelectorAll("canvas[data-anim]")].map(c => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = c.getBoundingClientRect();
    const w = c.clientWidth || 320, h = c.clientHeight || 150;
    c.width = w * dpr; c.height = h * dpr;
    const ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    return { canvas: c, ctx, id: c.dataset.anim, w, h };
  });
}

export function setAnatomyActive(on) {
  if (on && !running) { running = true; loop(); }
  else if (!on) { running = false; cancelAnimationFrame(raf); }
}

// a single extra canvas can be registered to mirror one region's animation
// at a larger size (used by the anatomy card's expanded/focus view)
let focusEntry: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; id: string; w: number; h: number } | null = null;
export function setFeatureFocus(id: string | null, canvasEl?: HTMLCanvasElement) {
  if (focusEntry) { canvases = canvases.filter(c => c !== focusEntry); focusEntry = null; }
  if (!id || !canvasEl) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvasEl.clientWidth || 480, h = canvasEl.clientHeight || 260;
  canvasEl.width = w * dpr; canvasEl.height = h * dpr;
  const ctx = canvasEl.getContext("2d");
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  focusEntry = { canvas: canvasEl, ctx, id, w, h };
  canvases.push(focusEntry);
}

let t0 = performance.now();
function loop() {
  if (!running) return;
  const t = (performance.now() - t0) / 1000;
  for (const c of canvases) {
    // only draw cards currently in view (cheap visibility check)
    if (c.canvas.getBoundingClientRect().bottom < -50) continue;
    draw(c.ctx, c.id, c.w, c.h, t);
  }
  raf = requestAnimationFrame(loop);
}

function bg(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#0b0f1e"); g.addColorStop(1, "#05060f");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}
function blackHole(ctx, cx, cy, r) {
  const g = ctx.createRadialGradient(cx, cy, r * 0.6, cx, cy, r * 1.5);
  g.addColorStop(0, "#000"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 1.5, 0, 7); ctx.fill();
  ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
}
function dot(ctx, x, y, r, col, a = 1) {
  ctx.globalAlpha = a; ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
}

function draw(ctx, id, w, h, t) {
  bg(ctx, w, h);
  const cx = w / 2, cy = h / 2;
  ctx.save();
  switch (id) {
    case "singularity": {
      for (let i = 0; i < 70; i++) {
        const p = ((i / 70) + t * 0.22) % 1;
        const rad = (h * 0.46) * (1 - p);
        const a = i * 2.4 + (1 - p) * 8;
        dot(ctx, cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 0.62, 1.3, i % 3 ? OR : HOT, 0.3 + p * 0.7);
      }
      dot(ctx, cx, cy, 2 + Math.sin(t * 6) * 1.5, WH, 1);
      dot(ctx, cx, cy, 8 + Math.sin(t * 6) * 4, HOT, 0.25);
      break;
    }
    case "horizon": {
      const R = h * 0.26;
      for (let i = 0; i < 26; i++) {
        const a = i * 0.62 + t * 0.2, p = (i / 26 + t * 0.5) % 1;
        const rad = R + (h * 0.5) * p;
        dot(ctx, cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 0.78, 1.4, OR, (1 - p) * 0.9);
      }
      blackHole(ctx, cx, cy, R);
      ctx.strokeStyle = `rgba(255,200,130,${0.5 + 0.3 * Math.sin(t * 3)})`;
      ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
      break;
    }
    case "photon": {
      const R = h * 0.22, ps = R * 1.5;
      blackHole(ctx, cx, cy, R);
      ctx.setLineDash([3, 5]); ctx.strokeStyle = "rgba(120,180,255,0.4)";
      ctx.beginPath(); ctx.arc(cx, cy, ps, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      for (let i = 0; i < 14; i++) {
        const a = t * 2.4 - i * 0.18;
        dot(ctx, cx + Math.cos(a) * ps, cy + Math.sin(a) * ps, 2.2 - i * 0.12, i ? HOT : WH, 1 - i / 16);
      }
      break;
    }
    case "isco": {
      const R = h * 0.16, isco = h * 0.4;
      ctx.setLineDash([2, 5]); ctx.strokeStyle = "rgba(255,157,60,0.45)";
      ctx.beginPath(); ctx.arc(cx, cy, isco, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      const p = (t * 0.25) % 1;
      const rad = isco * 1.35 * (1 - p * 0.92) + R;
      const a = t * (1.5 + (1 - rad / isco) * 6);
      for (let i = 0; i < 16; i++)
        dot(ctx, cx + Math.cos(a - i * 0.12) * rad, cy + Math.sin(a - i * 0.12) * rad * 0.92, 2 - i * 0.1, OR, 1 - i / 18);
      blackHole(ctx, cx, cy, R);
      break;
    }
    case "disk": {
      const R = h * 0.14;
      for (let ring = 0; ring < 26; ring++) {
        const rr = R + ring * (h * 0.016);
        const tnorm = 1 - ring / 26;
        ctx.strokeStyle = `rgba(${255},${150 + tnorm * 90},${60 + tnorm * 130},${0.5})`;
        ctx.lineWidth = 2.2;
        const off = t * (2.5 - ring * 0.05);
        ctx.beginPath();
        for (let s = 0; s <= 24; s++) {
          const a = (s / 24) * 7 + off;
          const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.42;
          s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.globalAlpha = 0.5 + 0.5 * tnorm; ctx.stroke(); ctx.globalAlpha = 1;
      }
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(cx, cy, R, R * 0.42, 0, 0, 7); ctx.fill();
      break;
    }
    case "lensing": {
      const lens = (x, y) => {
        const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) + 1;
        const pull = 900 / (d * d);
        return [x - (dx / d) * pull * 14, y - (dy / d) * pull * 14];
      };
      ctx.strokeStyle = "rgba(91,184,255,0.28)"; ctx.lineWidth = 1;
      for (let gx = 0; gx <= w; gx += 22) {
        ctx.beginPath();
        for (let gy = 0; gy <= h; gy += 6) { const [x, y] = lens(gx, gy); gy ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      }
      for (let gy = 0; gy <= h; gy += 22) {
        ctx.beginPath();
        for (let gx = 0; gx <= w; gx += 6) { const [x, y] = lens(gx, gy); gx ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.stroke();
      }
      const px = ((t * 0.3) % 1) * w;
      const [lx, ly] = lens(px, cy - h * 0.3);
      dot(ctx, lx, ly, 2.5, HOT, 1);
      blackHole(ctx, cx, cy, h * 0.12);
      break;
    }
    case "ergosphere": {
      const R = h * 0.18;
      ctx.strokeStyle = "rgba(150,110,255,0.5)"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.7, R * 1.25, 0, 0, 7); ctx.stroke();
      for (let i = 0; i < 22; i++) {
        const a = i * 0.55 + t * 1.6, rad = R * 1.45;
        dot(ctx, cx + Math.cos(a) * rad * 1.18, cy + Math.sin(a) * rad * 0.85, 1.6, BL, 0.8);
      }
      blackHole(ctx, cx, cy, R);
      break;
    }
    case "jets": {
      const R = h * 0.16;
      for (const dir of [-1, 1]) {
        const len = h * 0.46 * (0.8 + 0.2 * Math.sin(t * 4 + dir));
        const g = ctx.createLinearGradient(cx, cy, cx, cy + dir * len);
        g.addColorStop(0, "rgba(180,220,255,0.9)"); g.addColorStop(1, "rgba(90,140,255,0)");
        ctx.strokeStyle = g; ctx.lineWidth = 6; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.sin(t * 2) * 4, cy + dir * len); ctx.stroke();
      }
      // thin disk line
      ctx.strokeStyle = "rgba(255,157,60,0.7)"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx - w * 0.4, cy); ctx.lineTo(cx + w * 0.4, cy); ctx.stroke();
      blackHole(ctx, cx, cy, R);
      break;
    }
    case "doppler": {
      const R = h * 0.32;
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * 7 + t * 1.6;
        const x = cx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 0.35;
        const approaching = Math.cos(a) < 0;   // left side toward viewer
        dot(ctx, x, y, approaching ? 3 : 2, approaching ? "#bfe0ff" : "#ff7a4a", approaching ? 1 : 0.5);
      }
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.ellipse(cx, cy, R * 0.5, R * 0.18, 0, 0, 7); ctx.fill();
      break;
    }
    case "redshift": {
      // a photon climbing out of a gravity well, wavelength stretching
      ctx.strokeStyle = "rgba(120,140,180,0.4)"; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) { const y = h * 0.78 + Math.exp(-Math.pow((x - cx) / 40, 2)) * h * 0.5; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
      const climb = (t * 0.35) % 1;
      const baseY = h * 0.85 - climb * h * 0.7;
      const wl = 6 + climb * 22;
      for (let i = 0; i < 5; i++) {
        const seg = i / 5;
        const col = `rgb(255,${Math.round(180 - climb * 140)},${Math.round(120 - climb * 110)})`;
        const x = cx - 30 + Math.sin((seg * 6) ) * 0;
        dot(ctx, cx + Math.sin((i + t * 6) ) * wl, baseY - i * 8, 2.4, col, 1 - seg * 0.4);
      }
      dot(ctx, cx, baseY, 3, climb > 0.6 ? "#ff5a4a" : "#ffd98a", 1);
      break;
    }
    default:
      blackHole(ctx, cx, cy, h * 0.2);
  }
  ctx.restore();
}
