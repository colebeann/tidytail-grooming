// Hero centrepiece: real-time 3D soap bubbles (three.js) with a custom thin-film
// shader tinted in the Tidytail palette (mint → lilac → peach). Bubbles rise and
// wobble, drift away from the cursor, and pop into droplets when clicked.
// Pauses when off-screen or in a background tab; DPR is capped to save battery.
import {
  WebGLRenderer, Scene, PerspectiveCamera, IcosahedronGeometry, ShaderMaterial,
  InstancedMesh, InstancedBufferAttribute, Object3D, Color, DynamicDrawUsage,
} from 'three';

const COUNT = 26;
const DROPS = 60;

const vertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  varying vec3 vN;
  varying vec3 vV;
  varying float vSeed;
  void main() {
    vSeed = aSeed;
    vec3 p = position;
    // Soap-film wobble: a slow, seed-shifted ripple across the surface.
    float w = sin(p.y * 3.0 + uTime * 2.2 + aSeed * 6.28) * cos(p.x * 2.5 + uTime * 1.7);
    p += normal * w * 0.035;
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uA;
  uniform vec3 uB;
  uniform vec3 uC;
  uniform vec3 uD;
  varying vec3 vN;
  varying vec3 vV;
  varying float vSeed;
  vec3 film(float t) {
    t = fract(t);
    if (t < 0.33) return mix(uA, uB, t / 0.33);
    if (t < 0.66) return mix(uB, uC, (t - 0.33) / 0.33);
    return mix(uC, uD, (t - 0.66) / 0.34);
  }
  void main() {
    vec3 n = normalize(vN);
    float ndv = clamp(dot(n, normalize(vV)), 0.0, 1.0);
    float fres = pow(1.0 - ndv, 2.4);
    // Thin-film colour bands shift with viewing angle and swirl over time.
    vec3 col = film(fres * 1.6 + vSeed + uTime * 0.05 + n.y * 0.25);
    // Two highlights: a window glint and a soft rim.
    vec3 l = normalize(vec3(-0.5, 0.7, 0.6));
    float spec = pow(max(dot(reflect(-l, n), normalize(vV)), 0.0), 60.0);
    float alpha = clamp(fres * 0.9 + 0.05 + spec, 0.0, 0.95);
    gl_FragColor = vec4(col * (0.75 + fres) + spec, alpha);
  }
`;

export function initBubbles(hero) {
  const canvas = document.createElement('canvas');
  canvas.className = 'bubbles-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  // Position the canvas here as well as in CSS, so it can never take part in
  // layout (and grow the hero) even if the stylesheet is missing or stale.
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
  hero.prepend(canvas);

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
  // 1.5x is visually identical for soft bubbles and frees GPU time for the cursor.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.z = 14;

  const css = getComputedStyle(document.documentElement);
  const tok = (name, fb) => new Color((css.getPropertyValue(name) || fb).trim() || fb);
  const uniforms = {
    uTime: { value: 0 },
    uA: { value: tok('--iris-1', '#5cc2b2') },
    uB: { value: tok('--iris-2', '#b9a6f2') },
    uC: { value: tok('--iris-3', '#ffb59e') },
    uD: { value: tok('--iris-4', '#9fd8ff') },
  };
  const material = new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms, transparent: true, depthWrite: false });

  // Detail 3 (1,280 faces) looks as round as 5 (20,480) once the shader shades it.
  const geo = new IcosahedronGeometry(1, 3);
  const seeds = new Float32Array(COUNT).map(() => Math.random());
  geo.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
  const mesh = new InstancedMesh(geo, material, COUNT);
  mesh.instanceMatrix.setUsage(DynamicDrawUsage);
  scene.add(mesh);

  const dropGeo = new IcosahedronGeometry(1, 2);
  dropGeo.setAttribute('aSeed', new InstancedBufferAttribute(new Float32Array(DROPS).map(() => Math.random()), 1));
  const drops = new InstancedMesh(dropGeo, material, DROPS);
  drops.instanceMatrix.setUsage(DynamicDrawUsage);
  scene.add(drops);

  let W = 10, H = 6;
  const view = () => {
    const w = hero.clientWidth, h = hero.clientHeight;
    // Safety valve: a hero this tall means the layout is broken; don't render into it.
    if (!w || !h || h > 4000) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    H = 2 * Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    W = H * camera.aspect;
  };
  view();
  new ResizeObserver(view).observe(hero);

  const rand = (a, b) => a + Math.random() * (b - a);
  // Phones get fewer, smaller bubbles that favour the right edge, so the headline stays readable.
  const small = hero.clientWidth < 760;
  const active = small ? 12 : COUNT;
  mesh.count = active;
  const size = () => (small ? rand(0.15, 0.4) : rand(0.25, 0.85));
  const spawnX = () => (small ? rand(0, W / 2) : rand(-W / 2, W / 2));
  const bubbles = Array.from({ length: active }, (_, i) => ({
    x: spawnX(), y: rand(-H / 2, H / 2), z: rand(-4, 2),
    vx: 0, vy: rand(0.25, 0.7), r: size(), seed: seeds[i], pop: 0,
  }));
  const respawn = (b) => { b.x = spawnX(); b.y = -H / 2 - 1.5; b.z = rand(-4, 2); b.vx = 0; b.r = size(); b.pop = 0; };
  const droplets = Array.from({ length: DROPS }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, life: 0 }));
  let dropIdx = 0;

  const pointer = { x: 9999, y: 9999 };
  const toWorld = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width - 0.5) * W, y: -((e.clientY - r.top) / r.height - 0.5) * H };
  };
  hero.addEventListener('pointermove', (e) => Object.assign(pointer, toWorld(e)), { passive: true });
  hero.addEventListener('pointerleave', () => { pointer.x = pointer.y = 9999; });
  hero.addEventListener('pointerdown', (e) => {
    if (e.target.closest('a, button, input')) return;
    const p = toWorld(e);
    // Pop the front-most bubble under the pointer (allowing for depth).
    let hit = null;
    for (const b of bubbles) {
      const s = camera.position.z / (camera.position.z - b.z);
      if (!b.pop && Math.hypot(b.x * s - p.x, b.y * s - p.y) < b.r * s * 1.25 && (!hit || b.z > hit.z)) hit = b;
    }
    if (!hit) return;
    hit.pop = 1;
    document.dispatchEvent(new CustomEvent('tt:pop', { detail: { pitch: 1.4 - hit.r * 0.6 } }));
    for (let k = 0; k < 10; k++) {
      const d = droplets[dropIdx++ % DROPS];
      const a = (k / 10) * Math.PI * 2 + Math.random() * 0.4;
      const sp = rand(2, 4.5);
      Object.assign(d, { x: hit.x, y: hit.y, z: hit.z, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 });
    }
  });

  const dummy = new Object3D();
  let last = performance.now();
  let running = true;
  let raf = 0;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    uniforms.uTime.value += dt;
    const t = uniforms.uTime.value;

    bubbles.forEach((b, i) => {
      if (b.pop) {
        b.pop += dt * 9;
        if (b.pop > 2) respawn(b);
      } else {
        b.y += b.vy * dt;
        b.x += (Math.sin(t * 0.8 + b.seed * 10) * 0.25 + b.vx) * dt;
        b.vx *= 0.96;
        const dx = b.x - pointer.x, dy = b.y - pointer.y;
        const d = Math.hypot(dx, dy);
        if (d < 2.2) { b.vx += (dx / (d || 1)) * 6 * dt * (2.2 - d); b.y += (dy / (d || 1)) * 1.5 * dt; }
        if (b.y > H / 2 + 1.5) respawn(b);
      }
      const s = b.pop ? Math.max(0, b.r * (1 + b.pop * 0.25) * (1 - b.pop / 2)) : b.r;
      dummy.position.set(b.x, b.y, b.z);
      dummy.rotation.set(t * 0.2 + b.seed, t * 0.3, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;

    droplets.forEach((d, i) => {
      if (d.life > 0) {
        d.life -= dt * 1.6;
        d.vy -= 6 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
      }
      dummy.position.set(d.x, d.y, d.z);
      dummy.scale.setScalar(Math.max(0, d.life) * 0.09);
      dummy.updateMatrix();
      drops.setMatrixAt(i, dummy.matrix);
    });
    drops.instanceMatrix.needsUpdate = true;

    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  }

  const start = () => { if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };
  new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden ? start() : stop())).observe(hero);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  raf = requestAnimationFrame(frame);
  canvas.classList.add('on');
}
