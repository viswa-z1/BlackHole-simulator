// ===================================================================
//  EXTRAS — relativistic polar jets + Kerr ergosphere
//  Units match the rest of the engine: Rs = 1, M = 0.5.
// ===================================================================
import * as THREE from "three";

const NOISE = /* glsl */`
float h31(vec3 p){ p=fract(p*0.3183+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float n3(vec3 x){ vec3 i=floor(x),f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(h31(i+vec3(0,0,0)),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm3(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<4;i++){ v+=a*n3(p); p*=2.03; a*=0.5; } return v; }
`;

// ---------------- Relativistic jets ----------------
const JET_VERT = /* glsl */`
varying vec2 vUv;
varying float vY;
void main(){
  vUv = uv;
  vY = position.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const JET_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
varying float vY;
uniform float uTime;
uniform float uSpin;
uniform float uBright;
${NOISE}
void main(){
  float along = vUv.y;                      // 0 base -> 1 tip
  float ang   = vUv.x * 6.2831853;
  // twin helical strands spun up by frame dragging
  float helix = 0.5 + 0.5*sin(ang*2.0 + along*26.0 - uTime*7.0);
  float turb  = fbm3(vec3(vUv.x*7.0, along*9.0 - uTime*1.8, uSpin*3.0));
  float fade  = pow(clamp(1.0 - along, 0.0, 1.0), 0.55) * smoothstep(0.0, 0.06, along);
  float a = uSpin * uBright * fade * (0.28 + 0.72*helix) * (0.35 + turb);
  vec3 core = vec3(0.75, 0.88, 1.0);        // blue-white shock
  vec3 edge = vec3(0.25, 0.45, 1.0);        // synchrotron blue
  vec3 col  = mix(core, edge, along*0.85 + (1.0-helix)*0.2);
  a *= 0.5;
  gl_FragColor = vec4(col * a, a);          // additive
}`;

export function createJets() {
  const geo = new THREE.CylinderGeometry(3.6, 0.22, 34, 80, 1, true);
  const uniforms = {
    uTime: { value: 0 }, uSpin: { value: 0.9 }, uBright: { value: 1.0 },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: JET_VERT, fragmentShader: JET_FRAG, uniforms,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  const group = new THREE.Group();
  const up = new THREE.Mesh(geo, mat); up.position.y = 17;
  const down = new THREE.Mesh(geo, mat); down.position.y = -17; down.rotation.x = Math.PI;
  group.add(up, down);

  return {
    group, uniforms,
    update(time, spin) { uniforms.uTime.value = time; uniforms.uSpin.value = spin; },
    setBright(b) { uniforms.uBright.value = b; },
    set visible(v) { group.visible = v; },
    get visible() { return group.visible; },
  };
}

// ---------------- Kerr ergosphere ----------------
// Outer ergosurface r_E(θ)/Rs = (1 + sqrt(1 - a² cos²θ)) / 2
// which will fix the ergosurface outer surface
const ERGO_VERT = /* glsl */`
uniform float uA;          // dimensionless spin 0..1
varying vec3 vN;
varying vec3 vPos;
void main(){
  vec3 dir = normalize(position);
  float cosT = dir.y;
  float r = (1.0 + sqrt(max(0.0, 1.0 - uA*uA*cosT*cosT))) * 0.5;  // Rs units
  vec3 p = dir * r;
  vPos = p;
  vN = normalize(normalMatrix * dir);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const ERGO_FRAG = /* glsl */`
precision highp float;
uniform float uTime;
varying vec3 vN;
varying vec3 vPos;
void main(){
  vec3 V = normalize(cameraPosition - vPos);
  float fres = pow(1.0 - abs(dot(normalize(vN), V)), 2.2);
  // swirling streaks suggest frame dragging
  float ang = atan(vPos.z, vPos.x);
  float swirl = 0.5 + 0.5*sin(ang*9.0 - uTime*3.2);
  vec3 col = mix(vec3(0.35,0.15,0.7), vec3(0.2,0.8,1.0), fres);
  float a = (0.06 + 0.5*fres) * (0.55 + 0.45*swirl);
  gl_FragColor = vec4(col, a);
}`;

export function createErgosphere() {
  const geo = new THREE.SphereGeometry(1, 96, 64);
  const uniforms = { uA: { value: 0.9 }, uTime: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    vertexShader: ERGO_VERT, fragmentShader: ERGO_FRAG, uniforms,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.visible = false;   // off by default — it's a study aid
  return {
    mesh, uniforms,
    update(time, spin) { uniforms.uTime.value = time; uniforms.uA.value = spin; },
    set visible(v) { mesh.visible = v; },
    get visible() { return mesh.visible; },
  };
}
