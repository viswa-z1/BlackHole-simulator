// ===================================================================
//  COSMOS — a separate, explorable universe you zoom into.
//  Deep parallax starfield + (added in later commits) nebulae, drifting
//  dust, and interactive astrophysical anomalies with a space map.
//  Rendered by the shared renderer/composer via a swapped RenderPass.
// ===================================================================
import * as THREE from "three";

export function createCosmos(renderer) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05070f, 0.00025);
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 8000);
  camera.position.set(0, 0, 0);

  let active = false;
  const pointer = new THREE.Vector2(0, 0);   // -1..1, for parallax (later)

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
      size, vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, sizeAttenuation: true,
    });
    const p = new THREE.Points(g, m);
    scene.add(p);
    return p;
  }

  const stars = starLayer(6000, 2600, 3.0);

  return {
    scene, camera,
    get active() { return active; },
    enter() { active = true; camera.position.set(0, 0, 0); camera.rotation.set(0, 0, 0); },
    leave() { active = false; },
    resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); },
    setPointer(x, y) { pointer.set(x, y); },
    update(dt) {
      scene.rotation.y += dt * 0.004;          // slow ambient drift
      scene.rotation.x = Math.sin(performance.now() * 0.00004) * 0.04;
    },
  };
}
