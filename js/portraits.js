// ===================================================================
//  PORTRAITS — procedural, telescope-style "reference images"
//  Renders a unique HD portrait per catalog object onto a 2D canvas,
//  themed to its physical kind. Deterministic per object (seeded), so
//  every black hole / quasar / pulsar gets its own consistent look.
//  Results are cached as data URLs and reused by cards and the modal.
// ===================================================================

const cache = new Map();

// ---- seeded RNG (mulberry32) so each object looks consistent ----
function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function rngFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- shared drawing helpers ----
function background(ctx, w, h, rng) {
  const g = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, w * 0.8);
  g.addColorStop(0, "#05060f");
  g.addColorStop(0.6, "#02030a");
  g.addColorStop(1, "#000005");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function starfield(ctx, w, h, rng, count) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < count; i++) {
    const x = rng() * w, y = rng() * h;
    const r = rng() * rng() * 1.6 + 0.2;
    const b = 0.3 + rng() * 0.7;
    const tint = rng();
    const col = tint < 0.7 ? `rgba(255,255,255,${b})`
      : tint < 0.85 ? `rgba(170,200,255,${b})`
      : `rgba(255,210,170,${b})`;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    if (r > 1.4) { // bright star + tiny cross flare
      ctx.strokeStyle = `rgba(255,255,255,${b * 0.4})`;
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x - r * 3, y); ctx.lineTo(x + r * 3, y);
      ctx.moveTo(x, y - r * 3); ctx.lineTo(x, y + r * 3);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function nebula(ctx, w, h, rng, colors) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) {
    const x = rng() * w, y = rng() * h, r = (0.25 + rng() * 0.5) * w;
    const c = colors[i % colors.length];
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c.replace("A", "0.10"));
    g.addColorStop(0.5, c.replace("A", "0.04"));
    g.addColorStop(1, c.replace("A", "0"));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

function softGlow(ctx, x, y, r, color, alpha) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color.replace("A", String(alpha)));
  g.addColorStop(0.4, color.replace("A", String(alpha * 0.4)));
  g.addColorStop(1, color.replace("A", "0"));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.restore();
}

function diskColor(t) { // t 0(outer/cool) -> 1(inner/hot)
  const stops = [
    [0.0, [255, 92, 26]], [0.4, [255, 150, 60]],
    [0.7, [255, 224, 150]], [1.0, [210, 230, 255]],
  ];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const f = (t - a[0]) / Math.max(1e-4, b[0] - a[0]);
  const c = a[1].map((v, i) => Math.round(v + (b[1][i] - v) * f));
  return c;
}

// the signature lensed accretion disk + black hole silhouette
// silhouette will reflect light
function accretionDisk(ctx, cx, cy, R, opts = {}) {
  const ky = opts.tilt ?? 0.34;          // vertical squash (viewing angle)
  const inner = opts.inner ?? 1.7;
  const outer = opts.outer ?? 4.6;
  const doppler = opts.doppler ?? 1.0;
  const warm = opts.warm ?? 0.0;         // shift palette warmer for big BHs

  // outer glow halo
  softGlow(ctx, cx, cy, R * outer * 1.3, "rgba(255,150,70,A)", 0.5);

  // full disk (concentric ellipse rings), additive
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const rings = 130;
  for (let i = rings; i >= 0; i--) {
    const f = i / rings;                          // 0 inner .. 1 outer
    const rr = R * (inner + (outer - inner) * f);
    const t = Math.pow(1 - f, 0.85);              // temperature
    let [r, g, b] = diskColor(Math.min(1, t + warm * 0.15));
    const baseA = (0.05 + 0.12 * t) * (0.7 + 0.3 * Math.sin(f * 40 + cx));
    ctx.lineWidth = R * (outer - inner) / rings * 1.6;
    // draw as two arcs to apply Doppler brightening on one side
    for (const side of [-1, 1]) {
      const bright = side < 0 ? (1 + 0.9 * doppler) : (1 - 0.5 * doppler);
      const bb = side < 0 ? Math.min(255, b * 1.25) : b * 0.7;
      const rrr = side > 0 ? Math.min(255, r * 1.15) : r;
      ctx.strokeStyle = `rgba(${rrr | 0},${g | 0},${bb | 0},${Math.min(0.5, baseA * bright)})`;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rr, rr * ky, 0, side < 0 ? Math.PI : 0, side < 0 ? 2 * Math.PI : Math.PI);
      ctx.stroke();
    }
  }
  ctx.restore();

  // event horizon silhouette
  ctx.save();
  ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
  ctx.restore();

  // photon ring (thin bright rim)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = "rgba(255,240,210,0.95)";
  ctx.lineWidth = R * 0.05;
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.04, 0, 7); ctx.stroke();
  ctx.restore();

  // lensed top arc (far side of disk wrapped over the hole)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const grad = ctx.createLinearGradient(cx - R, cy - R * 1.6, cx + R, cy - R * 1.6);
  grad.addColorStop(0, "rgba(255,140,60,0)");
  grad.addColorStop(0.5, "rgba(255,230,180,0.9)");
  grad.addColorStop(1, "rgba(120,180,255,0)");
  ctx.strokeStyle = grad;
  ctx.lineWidth = R * 0.16;
  ctx.beginPath();
  ctx.ellipse(cx, cy, R * 1.5, R * 0.9, 0, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  ctx.restore();
}

function relativisticJet(ctx, cx, cy, len, width, color, rng) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const dir of [-1, 1]) {
    const g = ctx.createLinearGradient(cx, cy, cx, cy + dir * len);
    g.addColorStop(0, color.replace("A", "0.0"));
    g.addColorStop(0.06, color.replace("A", "0.8"));
    g.addColorStop(0.5, color.replace("A", "0.4"));
    g.addColorStop(1, color.replace("A", "0.0"));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - width * 0.18, cy);
    ctx.lineTo(cx + width * 0.18, cy);
    ctx.lineTo(cx + width, cy + dir * len);
    ctx.lineTo(cx - width, cy + dir * len);
    ctx.closePath();
    ctx.fill();
    // helical knots
    for (let i = 0; i < 7; i++) {
      const f = (i + 1) / 8;
      const y = cy + dir * len * f;
      const x = cx + Math.sin(f * 9 + rng() * 6) * width * f * 0.7;
      softGlow(ctx, x, y, width * (0.4 + f * 0.6), color, 0.5 * (1 - f));
    }
  }
  ctx.restore();
}

function companionStar(ctx, x, y, r, color) {
  softGlow(ctx, x, y, r * 4, color, 0.8);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, "#fff");
  g.addColorStop(0.5, color.replace("A", "1"));
  g.addColorStop(1, color.replace("A", "0"));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.restore();
}

function neutronStar(ctx, cx, cy, r, color) {
  softGlow(ctx, cx, cy, r * 6, color, 0.7);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.6, color.replace("A", "1"));
  g.addColorStop(1, color.replace("A", "0"));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  ctx.restore();
}

function pulsarBeams(ctx, cx, cy, len, angle, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.globalCompositeOperation = "lighter";
  for (const dir of [-1, 1]) {
    const g = ctx.createLinearGradient(0, 0, 0, dir * len);
    g.addColorStop(0, color.replace("A", "0.9"));
    g.addColorStop(1, color.replace("A", "0"));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-2, 0); ctx.lineTo(2, 0);
    ctx.lineTo(len * 0.22, dir * len); ctx.lineTo(-len * 0.22, dir * len);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function magneticLoops(ctx, cx, cy, r, color, rng) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = color.replace("A", "0.5");
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * Math.PI * 2 + rng() * 0.3;
    const span = r * (2 + rng() * 3);
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    const ex = cx + Math.cos(ang) * r, ey = cy + Math.sin(ang) * r;
    const ex2 = cx + Math.cos(ang + 0.6) * r, ey2 = cy + Math.sin(ang + 0.6) * r;
    ctx.moveTo(ex, ey);
    ctx.bezierCurveTo(
      cx + Math.cos(ang + 0.3) * span, cy + Math.sin(ang + 0.3) * span,
      cx + Math.cos(ang + 0.3) * span, cy + Math.sin(ang + 0.3) * span,
      ex2, ey2);
    ctx.stroke();
  }
  ctx.restore();
}

function vignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.8);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// ---- the per-kind composition ----
function compose(ctx, w, h, obj) {
  const rng = rngFrom(hashStr(obj.name));
  const cx = w * (0.42 + rng() * 0.16);
  const cy = h * (0.46 + rng() * 0.12);
  const S = Math.min(w, h);

  background(ctx, w, h, rng);
  starfield(ctx, w, h, rng, Math.round(S * 0.9));

  switch (obj.kind) {
    case "quasar": {
      nebula(ctx, w, h, rng, ["rgba(70,40,120,A)", "rgba(40,90,160,A)"]);
      // distant host galaxy
      softGlow(ctx, cx, cy, S * 0.42, "rgba(120,140,255,A)", 0.25);
      relativisticJet(ctx, cx, cy, S * 0.55, S * 0.05, "rgba(140,190,255,A)", rng);
      accretionDisk(ctx, cx, cy, S * 0.055, { inner: 1.6, outer: 4.0, doppler: 1.1, warm: 0.1, tilt: 0.3 });
      softGlow(ctx, cx, cy, S * 0.12, "rgba(255,255,255,A)", 0.9); // blazing core
      break;
    }
    case "ultramassive":
    case "supermassive": {
      nebula(ctx, w, h, rng, ["rgba(120,60,40,A)", "rgba(60,40,90,A)"]);
      accretionDisk(ctx, cx, cy, S * 0.085, {
        inner: 1.6, outer: obj.kind === "ultramassive" ? 5.2 : 4.6,
        doppler: 0.9, warm: obj.kind === "ultramassive" ? 0.25 : 0.12, tilt: 0.3,
      });
      if (rng() > 0.4) relativisticJet(ctx, cx, cy, S * 0.4, S * 0.03, "rgba(170,200,255,A)", rng);
      break;
    }
    case "intermediate": {
      accretionDisk(ctx, cx, cy, S * 0.06, { inner: 1.7, outer: 4.2, doppler: 0.8, tilt: 0.36 });
      break;
    }
    case "binary":
    case "stellar": {
      nebula(ctx, w, h, rng, ["rgba(40,70,140,A)"]);
      // companion donor star + accretion stream into a compact disk
      const sx = cx - S * 0.26, sy = cy - S * 0.12;
      const starCol = rng() > 0.5 ? "rgba(150,190,255,A)" : "rgba(255,210,150,A)";
      companionStar(ctx, sx, sy, S * 0.05, starCol);
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const g = ctx.createLinearGradient(sx, sy, cx, cy);
      g.addColorStop(0, "rgba(255,220,180,0.8)");
      g.addColorStop(1, "rgba(255,140,70,0.1)");
      ctx.strokeStyle = g; ctx.lineWidth = S * 0.02;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(cx - S * 0.02, cy - S * 0.18, cx, cy);
      ctx.stroke(); ctx.restore();
      accretionDisk(ctx, cx, cy, S * 0.05, { inner: 1.6, outer: 3.6, doppler: 1.0, tilt: 0.32 });
      break;
    }
    case "magnetar": {
      nebula(ctx, w, h, rng, ["rgba(150,40,90,A)", "rgba(90,40,140,A)"]);
      magneticLoops(ctx, cx, cy, S * 0.045, "rgba(255,120,200,A)", rng);
      neutronStar(ctx, cx, cy, S * 0.04, "rgba(200,150,255,A)");
      // magnetar flare
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "rgba(255,180,220,0.6)"; ctx.lineWidth = 1.4;
      for (let i = 0; i < 10; i++) {
        const a = rng() * 7, l = S * (0.06 + rng() * 0.2);
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); ctx.stroke();
      }
      ctx.restore();
      break;
    }
    case "millisecond":
    case "young pulsar":
    case "pulsar":
    case "neutron":
    default: {
      // supernova-remnant ring for young ones
      if (obj.kind === "pulsar" || obj.kind === "neutron") {
        softGlow(ctx, cx, cy, S * 0.4, "rgba(80,160,255,A)", 0.2);
        ctx.save(); ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = "rgba(120,180,255,0.25)"; ctx.lineWidth = S * 0.02;
        ctx.beginPath(); ctx.ellipse(cx, cy, S * 0.34, S * 0.26, 0.3, 0, 7); ctx.stroke();
        ctx.restore();
      }
      const ang = rng() * Math.PI;
      pulsarBeams(ctx, cx, cy, S * 0.5, ang, "rgba(150,200,255,A)");
      neutronStar(ctx, cx, cy, S * 0.035, "rgba(180,220,255,A)");
      break;
    }
  }

  nebula(ctx, w, h, rng, ["rgba(60,60,120,A)"]);
  vignette(ctx, w, h);
}

// ---- public API ----
export function portraitDataURL(obj, w = 480, h = 300) {
  const key = `${obj.name}@${w}x${h}`;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  compose(ctx, w, h, obj);
  const url = c.toDataURL("image/jpeg", 0.86);
  cache.set(key, url);
  return url;
}

export function renderPortraitInto(canvas, obj) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth * dpr, h = canvas.clientHeight * dpr;
  canvas.width = w; canvas.height = h;
  compose(canvas.getContext("2d"), w, h, obj);
}
