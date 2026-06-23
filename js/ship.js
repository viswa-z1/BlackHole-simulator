// ===================================================================
//  SHIP — a flat stealth "manta" explorer (matches the reference image):
//  a dark, low, swept hull with a pale hex-panelled top deck and a long
//  flat tail. Reads as a sleek silhouette rim-lit by the disk. Forward = -Z.
// ===================================================================
import * as THREE from "three";
// pale brushed top-deck panel with scattered dark hex cut-outs
function hexPanelTexture() {
    const s = 256, c = document.createElement("canvas");
    c.width = c.height = s;
    const x = c.getContext("2d");
    x.fillStyle = "#c6cbd7";
    x.fillRect(0, 0, s, s);
    for (let i = 0; i < 500; i++) {
        x.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
        x.fillRect(Math.random() * s, 0, 1, s);
    }
    x.fillStyle = "#14161d";
    const hex = (cx, cy, r) => { x.beginPath(); for (let i = 0; i < 6; i++) {
        const a = Math.PI / 3 * i + 0.35;
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
        i ? x.lineTo(px, py) : x.moveTo(px, py);
    } x.closePath(); x.fill(); };
    for (let i = 0; i < 50; i++)
        hex(20 + Math.random() * (s - 40), 20 + Math.random() * (s - 40), 4 + Math.random() * 9);
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
}
// top-down planform (x = half-width, y = length, nose at +y)
function planform(pts) {
    const s = new THREE.Shape();
    s.moveTo(0, pts[0][1]);
    for (let i = 1; i < pts.length; i++)
        s.lineTo(pts[i][0], pts[i][1]);
    for (let i = pts.length - 1; i >= 0; i--)
        s.lineTo(-pts[i][0], pts[i][1]); // mirror
    return s;
}
export function createShip() {
    const group = new THREE.Group();
    const craft = new THREE.Group();
    group.add(craft);
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x16181f, metalness: 0.7, roughness: 0.5, emissive: 0x070810, emissiveIntensity: 1 });
    const deckMat = new THREE.MeshStandardMaterial({ map: hexPanelTexture(), color: 0xdfe3ec, metalness: 0.55, roughness: 0.45 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x2c313c, metalness: 0.85, roughness: 0.35 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x8fb6ff, metalness: 0.2, roughness: 0.08, emissive: 0x213a66, emissiveIntensity: 0.7 });
    const engineMat = new THREE.MeshBasicMaterial({ color: 0x8fd4ff });
    // ---- dark flat hull (manta planform, extruded thin, soft bevel) ----
    const hullShape = planform([
        [0.00, 2.45], [0.42, 2.0], [1.05, 1.25], [1.7, 0.35],
        [1.96, -0.45], [1.78, -1.5], [1.82, -2.7], [0.9, -3.0],
    ]);
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: 0.34, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.12, bevelSegments: 3 });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.rotation.x = -Math.PI / 2; // lie flat; shape +y → world -Z (forward)
    hull.position.y = -0.17;
    craft.add(hull);
    // ---- pale hex-panelled top deck (front/mid), inset above the hull ----
    const deckShape = planform([
        [0.00, 2.05], [0.34, 1.7], [0.86, 1.05], [1.32, 0.3],
        [1.45, -0.4], [1.2, -1.2], [0.95, -1.7], [0.0, -1.85],
    ]);
    const deck = new THREE.Mesh(new THREE.ExtrudeGeometry(deckShape, { depth: 0.06, bevelEnabled: false }), deckMat);
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = 0.19;
    craft.add(deck);
    // ---- long flat rear deck plate (the wide tail in the image) ----
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.07, 1.7), trimMat);
    tail.position.set(0, 0.04, 2.05);
    craft.add(tail);
    // ---- raised cockpit canopy near the nose ----
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), glassMat);
    canopy.scale.set(1.0, 0.5, 1.9);
    canopy.position.set(0, 0.26, -1.2);
    craft.add(canopy);
    // ---- faint engine glow at the rear edge ----
    const engines = [];
    for (const sx of [-0.55, 0.55]) {
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 12), engineMat);
        glow.position.set(sx, 0.05, 2.85);
        glow.scale.set(1, 0.5, 1);
        craft.add(glow);
        engines.push(glow);
    }
    craft.scale.setScalar(0.5); // the manta planform is large; keep it ship-sized in frame
    group.visible = false;
    function update(time) {
        const pulse = 0.8 + 0.2 * Math.sin(time * 9.0);
        engines.forEach(e => e.scale.set(pulse, 0.5 * pulse, pulse));
        craft.rotation.z = Math.sin(time * 0.45) * 0.03; // subtle idle bank
    }
    return {
        group, update,
        get visible() { return group.visible; },
        set visible(v) { group.visible = v; },
    };
}
