// ===================================================================
//  GPGPU ACCRETION DISK — up to ~1,000,000 particles
//  Each particle integrates a GR-corrected orbit with RK4 entirely on
//  the GPU (ping-pong float textures). Particles that cross the ISCO
//  lose stability and spiral into the horizon, then respawn at the
//  outer disk — a continuously churning accretion flow.
//  Units match the lensing pass: Rs = 1, M = 0.5.
// ===================================================================
import * as THREE from "three";
import { GPUComputationRenderer } from "three/addons/misc/GPUComputationRenderer.js";

// Shared GLSL: GR-corrected acceleration (precession + ISCO instability)
const GLSL_ACCEL = /* glsl */`
const float M = 0.5;            // Rs = 1 -> M = 0.5
vec3 accel(vec3 p, vec3 v){
  float r = length(p);
  vec3 L = cross(p, v);
  float L2 = dot(L, L);
  // Newtonian + relativistic 3M h^2 / r^2 correction term
  float corr = 1.0 + 3.0 * L2 / (r*r);
  return -M * p / (r*r*r) * corr;
}
// deterministic per-particle hash for respawning
float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }
`;

const POS_SHADER = /* glsl */`
uniform float uDt;
uniform float uTime;
uniform float uInner;   // ISCO
uniform float uOuter;
${GLSL_ACCEL}

void respawn(inout vec3 pos, inout vec3 vel, float seed){
  float a = hash11(seed)*6.2831853;
  float R = mix(uInner*1.05, uOuter, pow(hash11(seed+1.3), 0.7));
  float h = (hash11(seed+2.1)-0.5) * R * 0.04;     // thin disk
  pos = vec3(cos(a)*R, h, sin(a)*R);
  float vc = sqrt(M / R) * (0.985 + hash11(seed+5.0)*0.03);
  vel = vec3(-sin(a), 0.0, cos(a)) * vc;
  vel += (vec3(hash11(seed+7.0),hash11(seed+8.0),hash11(seed+9.0))-0.5)*0.01;
}

void main(){
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 P = texture2D(texturePosition, uv);
  vec4 V = texture2D(textureVelocity, uv);
  vec3 pos = P.xyz;
  vec3 vel = V.xyz;
  float dt = uDt;

  // RK4 (must mirror velocity shader)
  vec3 k1p = vel;                 vec3 k1v = accel(pos, vel);
  vec3 k2p = vel + 0.5*dt*k1v;    vec3 k2v = accel(pos + 0.5*dt*k1p, vel + 0.5*dt*k1v);
  vec3 k3p = vel + 0.5*dt*k2v;    vec3 k3v = accel(pos + 0.5*dt*k2p, vel + 0.5*dt*k2v);
  vec3 k4p = vel + dt*k3v;        vec3 k4v = accel(pos + dt*k3p, vel + dt*k3v);

  pos += (dt/6.0)*(k1p + 2.0*k2p + 2.0*k3p + k4p);

  float r = length(pos);
  float seed = uv.x*1731.7 + uv.y*977.3 + uTime*0.37;
  if(r < uInner*0.55 || r > uOuter*1.6){
    vec3 nv;
    respawn(pos, nv, seed);
  }
  // store speed in .w for coloring
  gl_FragColor = vec4(pos, length(vel));
}`;

const VEL_SHADER = /* glsl */`
uniform float uDt;
uniform float uTime;
uniform float uInner;
uniform float uOuter;
${GLSL_ACCEL}

void respawnV(float seed, out vec3 vel, out vec3 pos){
  float a = hash11(seed)*6.2831853;
  float R = mix(uInner*1.05, uOuter, pow(hash11(seed+1.3), 0.7));
  pos = vec3(cos(a)*R, 0.0, sin(a)*R);
  float vc = sqrt(M / R) * (0.985 + hash11(seed+5.0)*0.03);
  vel = vec3(-sin(a), 0.0, cos(a)) * vc;
}

void main(){
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec3 pos = texture2D(texturePosition, uv).xyz;
  vec3 vel = texture2D(textureVelocity, uv).xyz;
  float dt = uDt;

  vec3 k1v = accel(pos, vel);
  vec3 k2v = accel(pos + 0.5*dt*vel, vel + 0.5*dt*k1v);
  vec3 k3v = accel(pos + 0.5*dt*(vel+0.5*dt*k1v), vel + 0.5*dt*k2v);
  vec3 k4v = accel(pos + dt*(vel+0.5*dt*k2v), vel + dt*k3v);

  vel += (dt/6.0)*(k1v + 2.0*k2v + 2.0*k3v + k4v);

  float r = length(pos);
  float seed = uv.x*1731.7 + uv.y*977.3 + uTime*0.37;
  if(r < uInner*0.55 || r > uOuter*1.6){
    vec3 nv, np; respawnV(seed, nv, np); vel = nv;
  }
  gl_FragColor = vec4(vel, 1.0);
}`;

const RENDER_VERT = /* glsl */`
uniform sampler2D texturePosition;
uniform float uInner;
uniform float uPointSize;
uniform float uPixelRatio;
varying float vSpeed;
varying float vRad;
void main(){
  vec4 P = texture2D(texturePosition, uv);
  vec3 pos = P.xyz;
  vSpeed = P.w;
  vRad = length(pos);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  float sz = uPointSize * uPixelRatio * (300.0 / max(0.1, -mv.z));
  gl_PointSize = clamp(sz, 0.8, 11.0);
}`;

const RENDER_FRAG = /* glsl */`
precision highp float;
uniform float uInner;
uniform float uOuter;
uniform float uBright;
varying float vSpeed;
varying float vRad;
vec3 bb(float t){
  vec3 cool=vec3(1.0,0.32,0.05), mid=vec3(1.0,0.72,0.34), hot=vec3(0.78,0.86,1.0);
  vec3 c=mix(cool,mid,smoothstep(0.0,0.55,t));
  return mix(c,hot,smoothstep(0.55,1.0,t));
}
void main(){
  vec2 d = gl_PointCoord - 0.5;
  float r2 = dot(d, d);
  float a = exp(-7.0 * r2);                     // smooth gaussian sprite
  float t = clamp((vSpeed-0.12)/0.5, 0.0, 1.0);
  t = mix(t, clamp(uInner/vRad,0.0,1.0), 0.5);  // hotter inward
  vec3 col = bb(t) * (0.05 + t*0.34) * uBright;
  gl_FragColor = vec4(col * a, a);
}`;

export const PARTICLE_PRESETS = [0, 128, 256, 512, 1024]; // texture side -> N = side^2 (0 = off)

export function createParticles(renderer, sideIndex = 2) {
  let side = PARTICLE_PRESETS[sideIndex] || 256;
  let count = side * side;

  const gpu = new GPUComputationRenderer(side, side, renderer);
  const dtPos = gpu.createTexture();
  const dtVel = gpu.createTexture();
  seed(dtPos, dtVel, side);

  const posVar = gpu.addVariable("texturePosition", POS_SHADER, dtPos);
  const velVar = gpu.addVariable("textureVelocity", VEL_SHADER, dtVel);
  gpu.setVariableDependencies(posVar, [posVar, velVar]);
  gpu.setVariableDependencies(velVar, [posVar, velVar]);

  const common = { uDt: { value: 0.0 }, uTime: { value: 0 }, uInner: { value: 3.0 }, uOuter: { value: 14.0 } };
  for (const k in common) { posVar.material.uniforms[k] = common[k]; velVar.material.uniforms[k] = { value: common[k].value }; }
  // keep them linked
  function syncUniform(name, val){ posVar.material.uniforms[name].value = val; velVar.material.uniforms[name].value = val; }

  const err = gpu.init();
  if (err) console.error("GPUComputationRenderer:", err);

  // render geometry (one vertex per particle, uv -> texture lookup)
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    uvs[i * 2] = (i % side) / side;
    uvs[i * 2 + 1] = Math.floor(i / side) / side;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

  const mat = new THREE.ShaderMaterial({
    vertexShader: RENDER_VERT,
    fragmentShader: RENDER_FRAG,
    uniforms: {
      texturePosition: { value: null },
      uInner: { value: 3.0 },
      uOuter: { value: 14.0 },
      uBright: { value: 1.0 },
      uPointSize: { value: 1.7 },
      uPixelRatio: { value: renderer.getPixelRatio() },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  function step(dt, time) {
    syncUniform("uDt", Math.min(dt, 0.05));
    syncUniform("uTime", time);
    gpu.compute();
    mat.uniforms.texturePosition.value = gpu.getCurrentRenderTarget(posVar).texture;
  }

  function setDisk(inner, outer) {
    syncUniform("uInner", inner); syncUniform("uOuter", outer);
    mat.uniforms.uInner.value = inner; mat.uniforms.uOuter.value = outer;
  }
  function setBright(b) { mat.uniforms.uBright.value = b; }

  return {
    points, count, side, step, setDisk, setBright,
    get visible() { return points.visible; },
    set visible(v) { points.visible = v; },
  };
}

// seed initial circular-orbit disk into the two textures
function seed(posTex, velTex, side) {
  const P = posTex.image.data;
  const V = velTex.image.data;
  const M = 0.5, inner = 3.2, outer = 14.0;
  for (let i = 0; i < side * side; i++) {
    const a = Math.random() * Math.PI * 2;
    const R = inner + (outer - inner) * Math.pow(Math.random(), 0.7);
    const h = (Math.random() - 0.5) * R * 0.04;
    const x = Math.cos(a) * R, z = Math.sin(a) * R;
    const vc = Math.sqrt(M / R) * (0.985 + Math.random() * 0.03);
    const j = i * 4;
    P[j] = x; P[j + 1] = h; P[j + 2] = z; P[j + 3] = vc;
    V[j] = -Math.sin(a) * vc; V[j + 1] = (Math.random() - 0.5) * 0.01; V[j + 2] = Math.cos(a) * vc; V[j + 3] = 1;
  }
}
