// ===================================================================
//  COSMOS — a separate, explorable universe you zoom into.
//  Deep parallax starfield + (added in later commits) nebulae, drifting
//  dust, and interactive astrophysical anomalies with a space map.
//  Rendered by the shared renderer/composer via a swapped RenderPass.
// ===================================================================
import * as THREE from "three";
import { ANOMALIES } from "./cosmos-data.js";

export function createCosmos(renderer) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070f, 0.00025);
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 8000);
  camera.position.set(0, 0, 0);

  let active = false;
  const pointer = new THREE.Vector2(0, 0);   // -1..1, for parallax (later)

  // soft round sprite for stars/dust (so points aren't hard squares)
  function circleTexture() {
    const s = 64, c = document.createElement("canvas"); c.width = c.height = s;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.4, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
  }
  const pointTex = circleTexture();

  // ---------- deep starfield ----------
  function starLayer(count, spread, size) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * spread;
      pos[i * 3 + 1] = (Math.random() * 2 - 1) * spread;
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * spread;
      // stellar temperature: O/B blue → G white → K/M warm
      const t = Math.random();
      if (t < 0.5) c.setRGB(0.6 + t * 0.7, 0.7 + t * 0.5, 1.0);
      else c.setRGB(1.0, 0.95 - (t - 0.5) * 0.5, 0.85 - (t - 0.5) * 0.9);
      const b = 0.5 + Math.random() * 0.5;
      col[i * 3] = c.r * b; col[i * 3 + 1] = c.g * b; col[i * 3 + 2] = c.b * b;
    }
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({
      size, map: pointTex, vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    const p = new THREE.Points(g, m);
    scene.add(p);
    return p;
  }

  // three depth layers — near stars parallax more than far ones
  const layers = [
    starLayer(7000, 3200, 2.0),   // far
    starLayer(5200, 1500, 2.6),   // deep-mid (density through the dive)
    starLayer(3500, 1900, 3.4),   // mid
    starLayer(1400, 1000, 5.2),   // near
  ];

  // ---------- procedural nebulae (fluffy additive clouds) ----------
  function nebulaTexture() {
    const s = 256, c = document.createElement("canvas"); c.width = c.height = s;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, s, s);
    ctx.globalCompositeOperation = "lighter";
    // keep blobs toward the centre so the radial vignette can erase the seams
    for (let i = 0; i < 46; i++) {
      const x = s * 0.5 + (Math.random() * 2 - 1) * s * 0.26;
      const y = s * 0.5 + (Math.random() * 2 - 1) * s * 0.26;
      const r = 18 + Math.random() * 70;
      const a = 0.04 + Math.random() * 0.10;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    // multiply by a soft radial vignette → fades RGB to black at the edges
    // (additive blending then shows nothing there, killing the square seam)
    ctx.globalCompositeOperation = "multiply";
    const vg = ctx.createRadialGradient(s / 2, s / 2, s * 0.08, s / 2, s / 2, s * 0.5);
    vg.addColorStop(0, "#ffffff"); vg.addColorStop(0.7, "#9a9a9a"); vg.addColorStop(1, "#000000");
    ctx.fillStyle = vg; ctx.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
  }
  const nebTex = nebulaTexture();
  const NEB_COLORS = [0xff5a8a, 0x4db5ff, 0xb79cff, 0xffae5a, 0x5affc4];
  for (let i = 0; i < 9; i++) {
    const mat = new THREE.SpriteMaterial({
      map: nebTex, color: NEB_COLORS[i % NEB_COLORS.length],
      transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const sp = new THREE.Sprite(mat);
    const sc = 460 + Math.random() * 950;
    sp.scale.set(sc, sc * (0.55 + Math.random() * 0.55), 1);
    sp.position.set((Math.random() * 2 - 1) * 2400, (Math.random() * 2 - 1) * 1500, -150 - Math.random() * 2700);
    sp.material.rotation = Math.random() * 6.283;
    scene.add(sp);
  }

  // ---------- drifting cosmic dust ----------
  function dustField(count, spread) {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) pos[i] = (Math.random() * 2 - 1) * spread;
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      color: 0x9fb6e0, size: 1.4, map: pointTex, transparent: true, opacity: 0.45,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    const p = new THREE.Points(g, m); scene.add(p); return p;
  }
  const dust = dustField(2400, 1300);

  // ---------- astrophysical anomaly nodes ----------
  function glowTexture() {
    const s = 128, c = document.createElement("canvas"); c.width = c.height = s;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.22, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(c);
  }
  const glowTex = glowTexture();
  const anomalies = ANOMALIES.map((d, i) => {
    const group = new THREE.Group();
    const ang = (i / ANOMALIES.length) * Math.PI * 2 + 0.6;
    const rad = 200 + (i % 4) * 210 + Math.random() * 110;
    const z = -240 - i * 95 - Math.random() * 60;     // all within dive range (~-1500)
    group.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.68, z);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: d.color, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    glow.scale.set(64, 64, 1);
    const core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex, color: 0xffffff, transparent: true, opacity: 1,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    core.scale.set(16, 16, 1);
    group.add(glow, core);
    scene.add(group);
    return { data: d, group, glow, core, phase: Math.random() * 6.28 };
  });

  // ---------- constellation lines (link anomalies of the same kind) ----------
  const byKind: Record<string, any[]> = {};
  for (const a of anomalies) (byKind[a.data.kind] ||= []).push(a);
  for (const kind in byKind) {
    const group = byKind[kind];
    if (group.length < 2) continue;
    const pts = group.map(a => a.group.position.clone());
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: group[0].data.color, transparent: true, opacity: 0.16,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    scene.add(line);
  }

  // ---------- shooting stars ----------
  const streaks = [];
  for (let i = 0; i < 4; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0xcfe0ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    scene.add(line);
    streaks.push({ line, t: -(0.5 + Math.random() * 5), dur: 0, head: new THREE.Vector3(), vel: new THREE.Vector3() });
  }
  function spawnStreak(s) {
    s.head.set((Math.random() * 2 - 1) * 900, (Math.random() * 2 - 1) * 580, camera.position.z - 300 - Math.random() * 700);
    s.vel.set(Math.random() * 2 - 1, Math.random() * 2 - 1, 0.25).normalize().multiplyScalar(800 + Math.random() * 700);
    s.t = 0; s.dur = 0.45 + Math.random() * 0.5;
  }
  function updateStreaks(dt) {
    for (const s of streaks) {
      if (s.dur <= 0) { s.t += dt; if (s.t > 0) spawnStreak(s); continue; }
      s.t += dt;
      const k = s.t / s.dur;
      if (k >= 1) { s.dur = 0; s.t = -(1 + Math.random() * 5); s.line.material.opacity = 0; continue; }
      const hx = s.head.x + s.vel.x * s.t, hy = s.head.y + s.vel.y * s.t, hz = s.head.z + s.vel.z * s.t;
      const a = s.line.geometry.attributes.position.array;
      a[0] = hx; a[1] = hy; a[2] = hz;
      a[3] = hx - s.vel.x * 0.12; a[4] = hy - s.vel.y * 0.12; a[5] = hz - s.vel.z * 0.12;
      s.line.geometry.attributes.position.needsUpdate = true;
      s.line.material.opacity = Math.sin(k * Math.PI) * 0.9;
    }
  }

  const target = new THREE.Vector3();
  const pan = new THREE.Vector2(0, 0);  // keyboard strafe offset
  let zoom = 0, zoomTarget = 0;        // 0 = far out, 1 = deep dive

  // ---------- picking (hover / click) ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pick(ndcX, ndcY) {           // NDC with y already pointing up
    ndc.set(ndcX, ndcY);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(anomalies.map(a => a.glow), false);
    if (hits.length) return anomalies.find(a => a.glow === hits[0].object);
    return null;
  }

  return {
    scene, camera, layers, anomalies, pick,
    get active() { return active; },
    get zoom() { return zoom; },
    enter() { active = true; zoom = 0; zoomTarget = 0; pan.set(0, 0); camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0); },
    leave() { active = false; },
    resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); },
    setPointer(x, y) { pointer.set(x, y); },
    panBy(dx, dy) { pan.x = Math.max(-1.6, Math.min(1.6, pan.x + dx)); pan.y = Math.max(-1.6, Math.min(1.6, pan.y + dy)); },
    addZoom(d) { zoomTarget = Math.max(0, Math.min(1, zoomTarget + d)); },
    flyToZ(z) { zoomTarget = Math.max(0, Math.min(1, -z / 1500)); },   // dive toward a depth
    update(dt, time = 0) {
      zoom += (zoomTarget - zoom) * Math.min(1, dt * 2.2);
      scene.rotation.y += dt * 0.003;                          // slow ambient drift
      dust.rotation.y += dt * 0.02; dust.rotation.x += dt * 0.012;   // churning dust
      updateStreaks(dt);                                             // shooting stars
      // anomalies breathe: cores pulse, halos shimmer + slowly spin
      for (const a of anomalies) {
        const p = 0.8 + 0.2 * Math.sin(time * 2.0 + a.phase);
        a.core.scale.setScalar(16 * p);
        a.glow.scale.setScalar(64 * (0.94 + 0.1 * Math.sin(time * 1.3 + a.phase)));
        a.glow.material.rotation += dt * 0.15;
      }
      const z = -zoom * 1500;                                  // dive forward (-Z), bounded to the populated region
      // lateral mouse parallax: sliding the camera makes near layers shift more
      target.set((pointer.x + pan.x) * 70, -(pointer.y + pan.y) * 45, z);
      camera.position.lerp(target, Math.min(1, dt * 2.5));
      camera.lookAt(camera.position.x, camera.position.y, camera.position.z - 800);
      const fov = 60 + zoom * 10;                              // subtle warp on the dive
      if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    },
  };
}
