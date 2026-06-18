// ===================================================================
//  SHIP — a refined deep-space explorer for the tracking shot.
//  Smooth lathe-turned hull, swept wings, a brand-orange running strip,
//  a glowing canopy and twin engines with volumetric exhaust.
//  Reads as a dark silhouette, rim-lit by the disk.  Forward = -Z.
// ===================================================================
import * as THREE from "three";

export function createShip() {
  const group = new THREE.Group();
  const craft = new THREE.Group();   // the model (kept separate from journey transforms)
  group.add(craft);

  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x222734, metalness: 0.86, roughness: 0.32, emissive: 0x090b12, emissiveIntensity: 1.0,
  });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0x39414f, metalness: 0.92, roughness: 0.28 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x9cc8ff, metalness: 0.1, roughness: 0.06, emissive: 0x2f6bd0, emissiveIntensity: 0.9,
  });
  const accentMat = new THREE.MeshBasicMaterial({ color: 0xff9d3c });    // brand strip (blooms)
  const engineMat = new THREE.MeshBasicMaterial({ color: 0x9fdcff });    // engine glow (blooms)

  // ---- aerodynamic lathe-turned fuselage (axis along Z, nose at -Z) ----
  const profile = [
    [0.26, -1.60], [0.40, -1.50], [0.43, -0.80], [0.42, 0.00],
    [0.38, 0.70], [0.28, 1.20], [0.12, 1.50], [0.015, 1.62],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 40), hullMat);
  body.rotation.x = -Math.PI / 2;   // lathe Y → -Z (nose forward)
  craft.add(body);

  // brand-orange running strip around the hull
  const strip = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.018, 8, 48), accentMat);
  strip.position.z = 0.1;
  craft.add(strip);

  // dorsal spine
  const spine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.34, 1.5), plateMat);
  spine.position.set(0, 0.28, 0.3); spine.rotation.x = 0.18;
  craft.add(spine);

  // ---- canopy ----
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), glassMat);
  canopy.scale.set(0.85, 0.6, 1.7); canopy.position.set(0, 0.18, -0.62);
  craft.add(canopy);

  // ---- swept delta wings ----
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -0.55); wingShape.lineTo(1.75, 0.34);
  wingShape.lineTo(1.75, 0.6); wingShape.lineTo(0, 0.58);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.05, bevelEnabled: false });
  const navLights = [];
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeo, plateMat);
    wing.scale.x = s; wing.rotation.x = Math.PI / 2; wing.position.set(0, -0.05, 0.2);
    craft.add(wing);
    // leading-edge accent
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1.0), accentMat);
    edge.position.set(s * 0.9, -0.03, 0.0); edge.rotation.y = s * 0.46;
    craft.add(edge);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10),
      new THREE.MeshBasicMaterial({ color: s < 0 ? 0xff4d4d : 0x57ff8c }));
    tip.position.set(s * 1.7, -0.02, 0.5); craft.add(tip); navLights.push(tip);
  }

  // ---- twin engines + volumetric exhaust ----
  const engines = [], trails = [];
  for (const s of [-0.4, 0.4]) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.32, 16), plateMat);
    nozzle.rotation.x = Math.PI / 2; nozzle.position.set(s, -0.02, 1.42); craft.add(nozzle);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 14), engineMat);
    glow.position.set(s, -0.02, 1.56); craft.add(glow); engines.push(glow);
    const trail = new THREE.Mesh(
      new THREE.ConeGeometry(0.14, 3.6, 18, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x6fc4ff, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    trail.rotation.x = -Math.PI / 2; trail.position.set(s, -0.02, 3.2); craft.add(trail); trails.push(trail);
  }

  // ---- top strobe ----
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  strobe.position.set(0, 0.24, -0.1); craft.add(strobe);

  group.visible = false;

  function update(time) {
    const pulse = 0.85 + 0.15 * Math.sin(time * 14.0);
    engines.forEach(e => e.scale.setScalar(pulse));
    for (let i = 0; i < trails.length; i++) {
      trails[i].scale.set(1, 0.8 + 0.4 * Math.sin(time * 16 + i), 1);
      trails[i].material.opacity = 0.34 + 0.2 * Math.sin(time * 20 + i * 2.0);
    }
    const blink = Math.sin(time * 5.0) > 0.4;
    navLights.forEach(n => n.scale.setScalar(blink ? 1 : 0.35));
    strobe.scale.setScalar(Math.sin(time * 8.0) > 0.8 ? 1.8 : 0.35);
    craft.rotation.z = Math.sin(time * 0.5) * 0.04;   // idle roll within the model
  }

  return {
    group, update,
    get visible() { return group.visible; },
    set visible(v) { group.visible = v; },
  };
}
