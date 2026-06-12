// ===================================================================
//  GRAVITATIONAL LENSING — full-screen photon geodesic ray marcher
//  Units: Schwarzschild radius Rs = 1, so M = 0.5, horizon at r = 1.
//  Each fragment integrates a null geodesic with RK4 and samples:
//    - a procedural lensed starfield (background)
//    - the accretion disk in the equatorial plane (with Doppler + redshift)
//  This is the "shader that runs on every pixel and bends light."
// ===================================================================
import * as THREE from "three";

const vert = /* glsl */`
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const frag = /* glsl */`
precision highp float;
varying vec2 vUv;

uniform vec2  uResolution;
uniform vec3  uCamPos;
uniform vec3  uCamRight;
uniform vec3  uCamUp;
uniform vec3  uCamFwd;
uniform float uTanFov;       // tan(fov/2)
uniform float uTime;
uniform float uDiskInner;    // ISCO radius (in Rs units)
uniform float uDiskOuter;
uniform float uSteps;
uniform float uBright;
uniform float uDoppler;      // 0 or 1
uniform float uSpin;         // 0..1, visual tilt of beaming
uniform float uPlunge;       // 0..1 how far through the horizon we are

// ---- hash / noise ----
float hash(vec3 p){
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x);
  f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i+vec3(0,0,0)),hash(i+vec3(1,0,0)),f.x),
                 mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                 mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){
  float v=0.0, a=0.5;
  for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.02; a*=0.5; }
  return v;
}

// ---- procedural starfield sampled in a 3D direction ----
vec3 starfield(vec3 dir){
  vec3 col = vec3(0.0);
  // three octaves of star layers
  for(int k=0;k<3;k++){
    float scale = 240.0 + float(k)*420.0;
    vec3 p = dir * scale;
    vec3 id = floor(p);
    float h = hash(id + float(k)*13.7);
    if(h > 0.972){
      vec3 f = fract(p) - 0.5;
      float d = length(f);
      float star = smoothstep(0.18, 0.0, d);
      float tw = 0.6 + 0.4*sin(uTime*2.0 + h*40.0);
      vec3 tint = mix(vec3(0.7,0.8,1.0), vec3(1.0,0.85,0.6), hash(id+7.0));
      col += star * tw * tint * (0.6 + (h-0.972)*30.0);
    }
  }
  // faint milky-way band + nebular dust
  float band = pow(max(0.0, 1.0 - abs(dir.y)*2.2), 3.0);
  float neb = fbm(dir*3.0 + 11.0);
  col += band * 0.05 * mix(vec3(0.25,0.35,0.6), vec3(0.6,0.4,0.55), neb);
  col += neb*neb * 0.02 * vec3(0.3,0.2,0.4);
  return col;
}

// ---- blackbody-ish temperature -> RGB (approx, normalized) ----
vec3 blackbody(float t){ // t in 0..1 (cool->hot)
  vec3 cool = vec3(1.0, 0.34, 0.05);   // deep orange
  vec3 mid  = vec3(1.0, 0.75, 0.35);   // amber
  vec3 hot  = vec3(0.75, 0.85, 1.0);   // blue-white
  vec3 c = mix(cool, mid, smoothstep(0.0,0.55,t));
  c = mix(c, hot, smoothstep(0.55,1.0,t));
  return c;
}

// acceleration of photon (conserved h2 passed in). Rs=1 -> coeff 1.5
vec3 accel(vec3 p, float h2){
  float r2 = dot(p,p);
  float r = sqrt(r2);
  return -1.5 * h2 * p / (r2*r2*r);   // -1.5 h2 p / r^5
}

void main(){
  vec2 ndc = (vUv * 2.0 - 1.0);
  ndc.x *= uResolution.x / uResolution.y;

  vec3 dir = normalize(ndc.x*uTanFov*uCamRight + ndc.y*uTanFov*uCamUp + uCamFwd);

  vec3 pos = uCamPos;
  vec3 vel = dir;

  // conserved specific angular momentum (|L|^2) of the photon
  float h2 = dot(cross(pos, vel), cross(pos, vel));

  vec3 color = vec3(0.0);
  float transmit = 1.0;       // how much background light still gets through
  bool captured = false;
  float prevY = pos.y;
  float horizon = 1.0;        // event horizon at r = Rs = 1

  int steps = int(uSteps);
  for(int i=0;i<400;i++){
    if(i >= steps) break;

    float r = length(pos);
    // adaptive step: small near the hole, large far away
    float dt = clamp(r*0.10, 0.012, 0.55);

    // ---- RK4 for second-order geodesic (pos, vel) ----
    vec3 k1p = vel;
    vec3 k1v = accel(pos, h2);
    vec3 k2p = vel + 0.5*dt*k1v;
    vec3 k2v = accel(pos + 0.5*dt*k1p, h2);
    vec3 k3p = vel + 0.5*dt*k2v;
    vec3 k3v = accel(pos + 0.5*dt*k2p, h2);
    vec3 k4p = vel + dt*k3v;
    vec3 k4v = accel(pos + dt*k3p, h2);

    vec3 newPos = pos + (dt/6.0)*(k1p + 2.0*k2p + 2.0*k3p + k4p);
    vec3 newVel = vel + (dt/6.0)*(k1v + 2.0*k2v + 2.0*k3v + k4v);

    float newR = length(newPos);

    // captured by horizon
    if(newR < horizon){ captured = true; break; }

    // ---- accretion-disk crossing in equatorial plane (y = 0) ----
    if(prevY * newPos.y < 0.0){
      float t = prevY / (prevY - newPos.y);            // lerp factor to plane
      vec3 hit = mix(pos, newPos, t);
      float rd = length(hit.xz);
      if(rd > uDiskInner && rd < uDiskOuter){
        // radial temperature ~ r^-0.75 (Shakura–Sunyaev like)
        float tnorm = clamp(pow(uDiskInner/rd, 0.9), 0.0, 1.0);
        vec3 base = blackbody(tnorm);

        // turbulent spiral structure
        float ang = atan(hit.z, hit.x);
        float spiral = fbm(vec3(rd*1.4 - uTime*1.1, ang*3.0, rd*0.6));
        float turb = 0.55 + 0.75*spiral;

        // keplerian orbital velocity direction (for Doppler beaming)
        vec3 vorb = normalize(vec3(-hit.z, 0.0, hit.x));
        float speed = clamp(0.62 / sqrt(rd), 0.0, 0.85);   // ~sqrt(M/r)
        vec3 toCam = normalize(uCamPos - hit);
        float beta = dot(vorb, -toCam) * speed;            // approaching = +
        float doppler = 1.0;
        if(uDoppler > 0.5){
          float g = 1.0 / (1.0 - beta);                    // simple beaming
          doppler = pow(clamp(g,0.2,3.0), 3.0);
          // gravitational redshift dimming near the hole
          float grav = sqrt(max(0.0, 1.0 - 1.0/rd));
          doppler *= mix(0.6, 1.0, grav);
          // shift hue blue (approach) / red (recede)
          base = mix(base, base*vec3(0.7,0.85,1.3), clamp(beta*1.4,0.0,1.0));
          base = mix(base, base*vec3(1.3,0.7,0.45), clamp(-beta*1.4,0.0,1.0));
        }

        // edge falloff
        float edge = smoothstep(uDiskOuter, uDiskOuter*0.6, rd)
                   * smoothstep(uDiskInner, uDiskInner*1.25, rd);

        float intensity = turb * edge * doppler * uBright * (1.1 + tnorm*1.7);
        color += transmit * base * intensity * 0.7;
        transmit *= mix(1.0, 0.5, edge);    // disk is semi-opaque
      }
    }

    pos = newPos; vel = newVel; prevY = newPos.y;

    // escaped to infinity
    if(newR > 60.0) break;
  }

  if(captured){
    // a faint hot rim leaking from just outside the horizon
    color += vec3(0.02,0.01,0.0);
  } else {
    color += transmit * starfield(normalize(vel));
  }

  // Output LINEAR HDR — bloom + ACES tone mapping happen downstream in the
  // post pipeline. Bright regions (photon ring, beamed disk) exceed 1.0 so
  // they bloom naturally instead of being clamped here.
  color *= 1.1;

  // plunge whiteout as we cross the horizon
  color = mix(color, vec3(4.0), smoothstep(0.85, 1.0, uPlunge)*uPlunge);

  gl_FragColor = vec4(max(color, 0.0), 1.0);
}`;

export function createLensing(renderer) {
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();

  const uniforms = {
    uResolution: { value: new THREE.Vector2(1, 1) },
    uCamPos: { value: new THREE.Vector3() },
    uCamRight: { value: new THREE.Vector3() },
    uCamUp: { value: new THREE.Vector3() },
    uCamFwd: { value: new THREE.Vector3() },
    uTanFov: { value: Math.tan(THREE.MathUtils.degToRad(55) * 0.5) },
    uTime: { value: 0 },
    uDiskInner: { value: 3.0 },
    uDiskOuter: { value: 14.0 },
    uSteps: { value: 260 },
    uBright: { value: 1.0 },
    uDoppler: { value: 1.0 },
    uSpin: { value: 0.9 },
    uPlunge: { value: 0.0 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms,
    depthWrite: false,
    depthTest: false,
  });

  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  quad.renderOrder = -1;   // always drawn first, behind the particles
  scene.add(quad);

  return { scene, camera, uniforms, material, mesh: quad };
}
