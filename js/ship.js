// ===================================================================
//  SHIP — a sleek procedural exploration craft for the tracking shot.
//  Dark metallic silhouette, lit on its hole-facing side, with glowing
//  engines, swept wings, blinking nav lights and a strobe.  Forward = -Z.
// ===================================================================
import * as THREE from "three";

export function createShip() {
  const group = new THREE.Group();

  const hull = new THREE.MeshStandardMaterial({
    color: 0x262b36, metalness: 0.82, roughness: 0.34,
    emissive: 0x0a0d14, emissiveIntensity: 1.0,
  });
  const trim = new THREE.MeshStandardMaterial({ color: 0x4a5365, metalness: 0.9, roughness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({
    color: 0x9cc8ff, metalness: 0.1, roughness: 0.08,
    emissive: 0x2a5588, emissiveIntensity: 0.8,
  });
  const engineMat = new THREE.MeshBasicMaterial({ color: 0x9fdcff });
  const detail = new THREE.Group();

  // ---- fuselage: long sleek body + tapered nose + flared tail ----
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 2.0, 26), hull);
  body.rotation.x = Math.PI / 2; detail.add(body);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.9, 26), hull);
  nose.rotation.x = -Math.PI / 2; nose.position.z = -1.95; detail.add(nose);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.7, 26), trim);
  tail.rotation.x = Math.PI / 2; tail.position.z = 1.3; detail.add(tail);

  // hull spine / dorsal fin
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.42, 1.0), trim);
  fin.position.set(0, 0.28, 0.55); fin.rotation.x = 0.32; detail.add(fin);

  // ---- canopy ----
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), glass);
  canopy.scale.set(0.9, 0.62, 1.7); canopy.position.set(0, 0.17, -0.7); detail.add(canopy);

  // ---- swept delta wings (built from a profile so they taper) ----
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, -0.5); wingShape.lineTo(1.7, 0.35); wingShape.lineTo(1.7, 0.62); wingShape.lineTo(0, 0.55);
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.05, bevelEnabled: false });
  const navLights = [];
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeo, trim);
    wing.scale.x = s;
    wing.rotation.x = Math.PI / 2;
    wing.position.set(0, -0.04, 0.15);
    detail.add(wing);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10),
      new THREE.MeshBasicMaterial({ color: s < 0 ? 0xff4d4d : 0x57ff8c }));
    tip.position.set(s * 1.65, -0.02, 0.5); detail.add(tip); navLights.push(tip);
  }

  // ---- engines + exhaust ----
  const engines = [], trails = [];
  for (const s of [-0.4, 0.4]) {
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.19, 0.34, 16), trim);
    nozzle.rotation.x = Math.PI / 2; nozzle.position.set(s, -0.02, 1.36); detail.add(nozzle);

    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 14), engineMat);
    glow.position.set(s, -0.02, 1.5); detail.add(glow); engines.push(glow);

    const trail = new THREE.Mesh(
      new THREE.ConeGeometry(0.15, 3.4, 18, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x6fc4ff, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    trail.rotation.x = -Math.PI / 2; trail.position.set(s, -0.02, 3.1); detail.add(trail); trails.push(trail);
  }

  // ---- top strobe ----
  const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff }));
  strobe.position.set(0, 0.22, -0.2); detail.add(strobe);

  group.add(detail);
  group.visible = false;

  function update(time) {
    const pulse = 0.85 + 0.15 * Math.sin(time * 14.0);
    for (const e of engines) e.scale.setScalar(pulse);
    for (let i = 0; i < trails.length; i++) {
      trails[i].scale.set(1, 0.8 + 0.4 * Math.sin(time * 16 + i), 1);
      trails[i].material.opacity = 0.34 + 0.2 * Math.sin(time * 20 + i * 2.0);
    }
    // blinking nav lights + white strobe
    const blink = Math.sin(time * 5.0) > 0.4;
    navLights.forEach(n => n.scale.setScalar(blink ? 1 : 0.35));
    strobe.scale.setScalar((Math.sin(time * 8.0) > 0.8) ? 1.8 : 0.35);
  }

  return {
    group, update,
    get visible() { return group.visible; },
    set visible(v) { group.visible = v; },
  };
}
