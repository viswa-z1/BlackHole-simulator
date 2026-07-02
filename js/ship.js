// ===================================================================
//  SHIP — an ultra-detailed stealth "manta" explorer.
//  PBR hull with image-based reflections (scene.environment), panel-line
//  detail, a hex-panelled deck with clearcoat, engine nozzles + plumes,
//  greeble, and nav lights. Forward = -Z. Reads as a real craft, lit by
//  the disk and reflecting the environment.
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
// procedural panel-line roughness map for the hull (fine seams + grime)
function panelRoughnessTexture() {
    const s = 256, c = document.createElement("canvas");
    c.width = c.height = s;
    const x = c.getContext("2d");
    x.fillStyle = "#7a7a7a";
    x.fillRect(0, 0, s, s); // base roughness ~0.48
    x.strokeStyle = "rgba(255,255,255,0.55)";
    x.lineWidth = 1; // seams read rougher
    for (let i = 0; i < 14; i++) {
        const y = Math.random() * s;
        x.beginPath();
        x.moveTo(0, y);
        x.lineTo(s, y + (Math.random() - 0.5) * 30);
        x.stroke();
    }
    for (let i = 0; i < 10; i++) {
        const gx = Math.random() * s;
        x.beginPath();
        x.moveTo(gx, 0);
        x.lineTo(gx + (Math.random() - 0.5) * 30, s);
        x.stroke();
    }
    for (let i = 0; i < 2500; i++) {
        x.fillStyle = `rgba(${Math.random() > 0.5 ? 255 : 0},${0},${0},${Math.random() * 0.06})`;
        x.fillRect(Math.random() * s, Math.random() * s, 1, 1);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 3);
    return t;
}
function planform(pts) {
    const s = new THREE.Shape();
    s.moveTo(0, pts[0][1]);
    for (let i = 1; i < pts.length; i++)
        s.lineTo(pts[i][0], pts[i][1]);
    for (let i = pts.length - 1; i >= 0; i--)
        s.lineTo(-pts[i][0], pts[i][1]);
    return s;
}
export function createShip() {
    const group = new THREE.Group();
    const craft = new THREE.Group();
    group.add(craft);
    const rough = panelRoughnessTexture();
    const hullMat = new THREE.MeshStandardMaterial({
        color: 0x14161d, metalness: 0.92, roughness: 0.42, roughnessMap: rough,
        envMapIntensity: 1.25, emissive: 0x05060a, emissiveIntensity: 1,
    });
    const deckMat = new THREE.MeshPhysicalMaterial({
        map: hexPanelTexture(), color: 0xdfe3ec, metalness: 0.6, roughness: 0.42,
        clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 1.1,
    });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x39414f, metalness: 0.96, roughness: 0.22, envMapIntensity: 1.4 });
    const accentMat = new THREE.MeshBasicMaterial({ color: 0xff9d3c });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x7fb0ff, metalness: 0, roughness: 0.05, transmission: 0.4, thickness: 0.4, emissive: 0x1d3a66, emissiveIntensity: 0.5, envMapIntensity: 1.5 });
    const engineMat = new THREE.MeshBasicMaterial({ color: 0x9fdcff });
    // ---- dark flat hull ----
    const hullShape = planform([
        [0.00, 2.45], [0.42, 2.0], [1.05, 1.25], [1.7, 0.35],
        [1.96, -0.45], [1.78, -1.5], [1.82, -2.7], [0.9, -3.0],
    ]);
    const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: 0.34, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.12, bevelSegments: 3 }), hullMat);
    hull.rotation.x = -Math.PI / 2;
    hull.position.y = -0.17;
    craft.add(hull);
    // ---- hex-panelled top deck with clearcoat ----
    const deckShape = planform([
        [0.00, 2.05], [0.34, 1.7], [0.86, 1.05], [1.32, 0.3],
        [1.45, -0.4], [1.2, -1.2], [0.95, -1.7], [0.0, -1.85],
    ]);
    const deck = new THREE.Mesh(new THREE.ExtrudeGeometry(deckShape, { depth: 0.06, bevelEnabled: false }), deckMat);
    deck.rotation.x = -Math.PI / 2;
    deck.position.y = 0.19;
    craft.add(deck);
    // ---- panel-line grooves + a brand-orange spine accent ----
    for (const z of [-1.4, -0.6, 0.2, 1.0]) {
        const groove = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.012, 0.03), new THREE.MeshStandardMaterial({ color: 0x05060a, metalness: 0.8, roughness: 0.6 }));
        groove.position.set(0, 0.235, z);
        craft.add(groove);
    }
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 3.2), accentMat);
    spine.position.set(0, 0.245, -0.2);
    craft.add(spine);
    // ---- long flat rear deck plate ----
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.07, 1.7), trimMat);
    tail.position.set(0, 0.04, 2.05);
    craft.add(tail);
    // ---- greeble: intake vents + sensor pods ----
    for (const sx of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
            const vent = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.05), new THREE.MeshStandardMaterial({ color: 0x0a0b10, metalness: 0.6, roughness: 0.7 }));
            vent.position.set(sx * 0.7, 0.2, -0.9 + i * 0.22);
            craft.add(vent);
        }
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.5, 12), trimMat);
        pod.rotation.x = Math.PI / 2;
        pod.position.set(sx * 1.45, 0.05, -0.2);
        craft.add(pod);
    }
    // ---- cockpit canopy ----
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), glassMat);
    canopy.scale.set(1.0, 0.5, 1.9);
    canopy.position.set(0, 0.26, -1.2);
    craft.add(canopy);
    // ---- engines: nozzles + inner cores + additive plumes ----
    const engines = [], plumes = [];
    for (const sx of [-0.55, 0.55]) {
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.35, 18), trimMat);
        nozzle.rotation.x = Math.PI / 2;
        nozzle.position.set(sx, 0.04, 2.85);
        craft.add(nozzle);
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), engineMat);
        core.position.set(sx, 0.04, 2.95);
        craft.add(core);
        engines.push(core);
        const plume = new THREE.Mesh(new THREE.ConeGeometry(0.15, 2.4, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0x6fc4ff, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        plume.rotation.x = -Math.PI / 2;
        plume.position.set(sx, 0.04, 4.1);
        craft.add(plume);
        plumes.push(plume);
    }
    // ---- nav lights + strobe ----
    const navL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), new THREE.MeshBasicMaterial({ color: 0xff4d4d }));
    navL.position.set(-1.9, 0.02, -0.4);
    craft.add(navL);
    const navR = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), new THREE.MeshBasicMaterial({ color: 0x57ff8c }));
    navR.position.set(1.9, 0.02, -0.4);
    craft.add(navR);
    const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    strobe.position.set(0, 0.32, -1.7);
    craft.add(strobe);
    craft.scale.setScalar(0.5);
    group.visible = false;
    function update(time) {
        const pulse = 0.82 + 0.18 * Math.sin(time * 10.0);
        engines.forEach(e => e.scale.setScalar(pulse));
        plumes.forEach((p, i) => { p.scale.set(1, 0.85 + 0.35 * Math.sin(time * 14 + i), 1); p.material.opacity = 0.3 + 0.18 * Math.sin(time * 18 + i); });
        const blink = Math.sin(time * 4.5) > 0.3;
        navL.scale.setScalar(blink ? 1 : 0.3);
        navR.scale.setScalar(blink ? 1 : 0.3);
        strobe.scale.setScalar(Math.sin(time * 8.0) > 0.85 ? 1.9 : 0.3);
        craft.rotation.z = Math.sin(time * 0.45) * 0.03;
    }
    return {
        group, update,
        get visible() { return group.visible; },
        set visible(v) { group.visible = v; },
    };
}
