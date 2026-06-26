// ===================================================================
//  GRAVITATIONAL LENSING — full-screen photon geodesic ray marcher
//  Units: Schwarzschild radius Rs = 1, so M = 0.5, horizon at r = 1.
//  Each fragment integrates a null geodesic with RK4 and samples:
//    - a procedural lensed starfield (background)
//    - the accretion disk in the equatorial plane (with Doppler + redshift)
//  This is the "shader that runs on every pixel and bends light." 
//  Scwarzchild equations
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
uniform float uDiskThick;    // disk thickness multiplier
uniform float uStarBright;   // background starfield brightness
uniform float uSteps;
uniform float uBright;
uniform float uDoppler;      // 0 or 1
uniform float uSpin;         // 0..1, visual tilt of beaming
uniform float uPlunge;       // 0..1 how far through the horizon we are
uniform float uPalette;      // 0..4 accretion-disk spectrum
uniform float uRipple;       // 0..1 gravitational-wave ripple near the horizon

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
  for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.02; a*=0.5; }
  return v;
}

// ---- distant galaxy: a soft, tilted elliptical glow with a core ----
vec3 galaxy(vec3 dir, vec3 center, float size, vec3 tint){
  vec3 d = dir - center;
  // squash along one axis to look like an inclined disk
  d.x *= 2.4;
  float r = length(d) / size;
  float halo = exp(-r*r*5.0);
  float core = exp(-r*r*48.0);
  return tint * (halo*0.5 + core*1.4);
}

// ---- procedural deep-space backdrop sampled in a 3D direction ----
vec3 starfield(vec3 dir){
  // deep-space navy base (the backdrop is dark blue, not black)
  vec3 col = vec3(0.010, 0.016, 0.038);

  // ---- multi-temperature stars (5 density/size layers) ----
  for(int k=0;k<5;k++){
    float scale = 180.0 + float(k)*360.0;
    vec3 p = dir * scale;
    vec3 id = floor(p);
    float h = hash(id + float(k)*13.7);
    float thresh = 0.978 - float(k)*0.004;     // brighter layers are rarer
    if(h > thresh){
      vec3 f = fract(p) - 0.5;
      float d = length(f);
      float star = smoothstep(0.16, 0.0, d);
      float tw = 0.7 + 0.3*sin(uTime*1.6 + h*60.0);
      float temp = hash(id+7.0);
      // O/B blue, G white-yellow, K/M orange-red
      vec3 tint = temp < 0.5 ? mix(vec3(0.6,0.75,1.0), vec3(1.0,0.98,0.92), temp*2.0)
                             : mix(vec3(1.0,0.98,0.92), vec3(1.0,0.72,0.5), (temp-0.5)*2.0);
      float mag = (h - thresh) / (1.0 - thresh);
      col += star * tw * tint * (0.4 + mag*mag*4.0);
    }
  }

  // ---- the Milky Way band: glowing lane + dark dust lanes ----
  float lat = dir.y * 1.7 + 0.25*fbm(dir*2.0);     // wavy galactic plane
  float band = exp(-lat*lat*5.0);
  float dust = fbm(dir*6.0 + 4.0);
  float clump = fbm(dir*2.5 + 20.0);
  vec3 bandCol = mix(vec3(0.10,0.14,0.30), vec3(0.55,0.45,0.40), clump);
  col += band * (0.10 + 0.22*clump) * bandCol;
  col *= 1.0 - band * smoothstep(0.45, 0.75, dust) * 0.7;   // dark dust lanes
  // dense star haze inside the band
  col += band * pow(clump, 3.0) * 0.05 * vec3(0.9,0.85,0.8);

  // ---- colored nebulae scattered across the sky ----
  float n1 = fbm(dir*3.0 + 11.0);
  float n2 = fbm(dir*4.5 - 7.0);
  col += pow(n1, 3.0) * 0.06 * vec3(0.55,0.25,0.65);   // magenta emission
  col += pow(n2, 3.0) * 0.05 * vec3(0.20,0.45,0.75);   // teal reflection

  // ---- a few distant galaxies ----
  col += galaxy(dir, normalize(vec3( 0.6, 0.35, 0.7)), 0.05, vec3(0.8,0.85,1.0));
  col += galaxy(dir, normalize(vec3(-0.7,-0.2, 0.4)), 0.035, vec3(1.0,0.9,0.75));
  col += galaxy(dir, normalize(vec3( 0.1,-0.6,-0.8)), 0.03, vec3(0.85,0.8,1.0));

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

// ---- accretion-disk spectra: blackbody-keyed gradients you can switch ----
vec3 grad(vec3 c0, vec3 c1, vec3 c2, vec3 c3, float t){
  vec3 c = mix(c0, c1, smoothstep(0.0, 0.35, t));
  c = mix(c, c2, smoothstep(0.35, 0.7, t));
  c = mix(c, c3, smoothstep(0.7, 1.0, t));
  return c;
}
vec3 diskColor(float t){
  int p = int(uPalette + 0.5);
  if(p == 1) return grad(vec3(0.05,0.18,0.55), vec3(0.16,0.46,0.96), vec3(0.55,0.80,1.00), vec3(0.93,0.97,1.00), t); // Cygnus Blue
  if(p == 2) return grad(vec3(0.42,0.07,0.50), vec3(0.85,0.20,0.72), vec3(1.00,0.55,0.92), vec3(1.00,0.93,1.00), t); // Quasar Violet
  if(p == 3) return grad(vec3(0.42,0.56,0.72), vec3(0.72,0.84,0.97), vec3(0.93,0.97,1.00), vec3(1.00,1.00,1.00), t); // Magnetar Ice
  if(p == 4) return grad(vec3(0.40,0.04,0.04), vec3(0.86,0.13,0.10), vec3(1.00,0.42,0.20), vec3(1.00,0.86,0.62), t); // Crimson Redshift
  return grad(vec3(0.72,0.26,0.07), vec3(1.00,0.55,0.20), vec3(1.00,0.81,0.48), vec3(1.00,0.95,0.86), t);             // Sagittarius Gold
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
  float horizon = 1.0;        // event horizon at r = Rs = 1
  float rmin = 1e9;           // closest approach (for the photon ring)

  int steps = int(uSteps);
  for(int i=0;i<400;i++){
    if(i >= steps) break;

    float r = length(pos);
    rmin = min(rmin, r);

    // adaptive step: small near the hole, large far away
    float dt = clamp(r*0.10, 0.012, 0.55);
    // refine the step inside the disk slab for smooth volumetric sampling
    float rdNow = length(pos.xz);
    if(abs(pos.y) < 0.7 && rdNow > uDiskInner*0.7 && rdNow < uDiskOuter*1.15)
      dt = min(dt, 0.11);

    // ---- RK4 for second-order geodesic (pos, vel) ----
    vec3 k1p = vel;                  vec3 k1v = accel(pos, h2);
    vec3 k2p = vel + 0.5*dt*k1v;     vec3 k2v = accel(pos + 0.5*dt*k1p, h2);
    vec3 k3p = vel + 0.5*dt*k2v;     vec3 k3v = accel(pos + 0.5*dt*k2p, h2);
    vec3 k4p = vel + dt*k3v;         vec3 k4v = accel(pos + dt*k3p, h2);

    vec3 newPos = pos + (dt/6.0)*(k1p + 2.0*k2p + 2.0*k3p + k4p);
    vec3 newVel = vel + (dt/6.0)*(k1v + 2.0*k2v + 2.0*k3v + k4v);

    float newR = length(newPos);
    if(newR < horizon){ captured = true; break; }

    // ---- volumetric accretion disk: smooth, glassy, gently flaring ----
    vec3 mid = 0.5*(pos + newPos);
    float rd = length(mid.xz);
    if(rd > uDiskInner && rd < uDiskOuter){
      float H  = (0.03 + 0.025*rd) * uDiskThick;            // thin, gently flaring slab
      float vg = exp(-0.5*(mid.y*mid.y)/(H*H));             // vertical falloff
      if(vg > 0.002){
        float radial = smoothstep(uDiskInner, uDiskInner*1.14, rd)
                     * smoothstep(uDiskOuter, uDiskOuter*0.72, rd);
        float ang   = atan(mid.z, mid.x);
        float omega = 0.9 / pow(rd, 1.5);                   // keplerian shear
        float swirl = ang + omega*uTime;                    // material winds in
        vec3 sp = vec3(swirl*4.0, rd*1.3, 11.0);
        float streak = noise(sp)*0.6 + noise(sp*2.3 + 5.0)*0.4;         // wispy 2-octave bands
        float fine   = 0.5 + 0.5*sin(swirl*22.0 + rd*7.0 - uTime*0.6);  // fine filaments
        float dens   = radial * (0.42 + 1.05*streak) * (0.55 + 0.8*fine); // higher contrast

        float tnorm = clamp(pow(uDiskInner/rd, 0.82), 0.0, 1.0);
        vec3 col = diskColor(tnorm);
        col = mix(col, vec3(1.4,1.38,1.32), smoothstep(0.7,1.0,tnorm));  // white-hot inner (neutral across spectra)
        vec3 emission = col * (1.15 + tnorm*3.0);

        if(uDoppler > 0.5){                                 // gentle relativistic beaming
          vec3 vorb = normalize(vec3(-mid.z, 0.0, mid.x));
          float speed = clamp(0.62/sqrt(rd), 0.0, 0.85);
          vec3 toCam = normalize(uCamPos - mid);
          float beta = dot(vorb, -toCam) * speed;
          float g = 1.0/(1.0 - beta);
          emission *= pow(clamp(g, 0.4, 2.2), 1.6);
          emission *= mix(vec3(1.0), vec3(0.93,0.96,1.06), clamp(beta,0.0,1.0));  // subtle cool approach
          emission *= mix(vec3(1.0), vec3(1.08,0.93,0.78), clamp(-beta,0.0,1.0)); // subtle warm recede
        }
        float grav = sqrt(max(0.0, 1.0 - 1.0/rd));          // gravitational redshift
        emission *= mix(0.5, 1.0, grav);

        float d = dens * vg;
        color    += transmit * emission * d * dt * uBright;
        transmit *= exp(-d * dt * 2.2);                     // absorption (self-occlusion)
      }
    }

    pos = newPos; vel = newVel;
    if(newR > 60.0) break;
    if(transmit < 0.02) break;     // fully absorbed — stop early
  }

  // ---- photon ring: rays grazing the photon sphere at 1.5 Rs ----
  float ring = exp(-pow((rmin - 1.5) / 0.055, 2.0));      // razor-thin
  color += vec3(1.0, 0.91, 0.74) * ring * 3.2 * uBright * transmit;

  if(captured){
    color += transmit * vec3(0.008, 0.013, 0.030);        // dark navy shadow interior
  } else {
    color += transmit * starfield(normalize(vel)) * uStarBright;
  }

  // Output LINEAR HDR — bloom + ACES tone mapping happen downstream.
  color *= 1.1;

  // gravitational-wave ripple: concentric waves of spacetime as you near the horizon
  if(uRipple > 0.001){
    float rr = length(vUv * 2.0 - 1.0);
    float wave = sin(rr * 42.0 - uTime * 18.0) * exp(-rr * 2.0);
    color += vec3(0.55, 0.72, 1.0) * wave * uRipple * 0.35;
  }

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
    uDiskThick: { value: 1.0 },
    uStarBright: { value: 1.0 },
    uSteps: { value: 150 },
    uBright: { value: 1.0 },
    uDoppler: { value: 1.0 },
    uSpin: { value: 0.9 },
    uPlunge: { value: 0.0 },
    uPalette: { value: 0.0 },
    uRipple: { value: 0.0 },
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
