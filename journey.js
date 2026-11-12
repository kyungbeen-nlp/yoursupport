/* 12주 과정: 스크롤에 따라 점 9,000개가 모양을 바꾼다.
   0 흩어진 구름(막막함) → 1 구(나를 설명하는 말) → 2 중심과 궤도(나만의 기준) → 3 오른쪽 위로 오르는 물결(혼자서도 나아가는 방향)
   진행도는 main.js가 window.ysJourney에 넣어 둔다. */

const section = document.querySelector('.journey');
const canvas = section && section.querySelector('.journey-canvas');

if (section && canvas && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    io.disconnect();
    import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js')
      .then(init)
      .catch(() => section.classList.add('no-webgl'));
  }, { rootMargin: '150% 0px 150% 0px' });
  io.observe(section);
}

function init(THREE) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    section.classList.add('no-webgl');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0xffffff, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  const small = window.innerWidth < 860;
  const N = small ? 5200 : 9000;

  /* 같은 모양이 매번 나오도록 고정된 난수 */
  let seed = 20261109;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const gauss = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  const P0 = new Float32Array(N * 3), P1 = new Float32Array(N * 3), P2 = new Float32Array(N * 3), P3 = new Float32Array(N * 3);
  const R = new Float32Array(N * 4);
  const golden = Math.PI * (1 + Math.sqrt(5));

  /* 흩어진 구름에 몇 개의 뭉치를 섞어 '생각의 덩어리'처럼 */
  const clumps = Array.from({ length: 7 }, () => [(rand() * 2 - 1) * 4.6, (rand() * 2 - 1) * 2.4, (rand() * 2 - 1) * 2]);
  const coreCount = Math.floor(N * 0.34);
  const rings = [
    { r: 2.15, rx: 1.22, ry: 0 },
    { r: 2.6, rx: 1.22, ry: 1.05 },
    { r: 3.05, rx: 1.22, ry: -1.05 },
  ];

  for (let i = 0; i < N; i++) {
    const o = i * 3;
    /* 0. 흩어진 구름 */
    if (rand() < 0.32) {
      const c = clumps[Math.floor(rand() * clumps.length)];
      P0[o] = c[0] + gauss() * 0.55; P0[o + 1] = c[1] + gauss() * 0.4; P0[o + 2] = c[2] + gauss() * 0.5;
    } else {
      P0[o] = (rand() * 2 - 1) * 6.4; P0[o + 1] = (rand() * 2 - 1) * 3.7; P0[o + 2] = (rand() * 2 - 1) * 3.2 - 0.4;
    }
    /* 1. 구 */
    const k = i + 0.5, phi = Math.acos(1 - (2 * k) / N), th = golden * k;
    const r1 = 2.05 * (1 + gauss() * 0.022);
    P1[o] = r1 * Math.cos(th) * Math.sin(phi); P1[o + 1] = r1 * Math.sin(th) * Math.sin(phi); P1[o + 2] = r1 * Math.cos(phi);
    /* 2. 작은 중심 + 기울어진 궤도 셋 */
    if (i < coreCount) {
      const kk = i + 0.5, ph = Math.acos(1 - (2 * kk) / coreCount), t2 = golden * kk, rc = 1.0 * (1 + gauss() * 0.03);
      P2[o] = rc * Math.cos(t2) * Math.sin(ph); P2[o + 1] = rc * Math.sin(t2) * Math.sin(ph); P2[o + 2] = rc * Math.cos(ph);
    } else {
      const ring = rings[i % 3], a = rand() * Math.PI * 2, w = gauss() * 0.045;
      let x = (ring.r + w) * Math.cos(a), y = gauss() * 0.03, z = (ring.r + w) * Math.sin(a);
      const cx = Math.cos(ring.rx), sx = Math.sin(ring.rx);
      [y, z] = [y * cx - z * sx, y * sx + z * cx];
      const cy = Math.cos(ring.ry), sy = Math.sin(ring.ry);
      [x, z] = [x * cy + z * sy, -x * sy + z * cy];
      P2[o] = x; P2[o + 1] = y; P2[o + 2] = z;
    }
    /* 3. 오른쪽 위로 오르는 물결 */
    const u = rand(), v = rand() * 2 - 1;
    P3[o] = -5.2 + 10.4 * u + gauss() * 0.03;
    P3[o + 1] = -2.0 + 3.4 * Math.pow(u, 1.35) + 0.34 * Math.sin(u * 7.0 + v * 1.6) + gauss() * 0.03;
    P3[o + 2] = v * 1.8 + 0.45 * Math.sin(u * 5.0) ;
    /* 크기 · 위상 · 색 · 출발 지연 */
    const q = o / 3 * 4;
    R[q] = 0.55 + Math.pow(rand(), 3) * 1.25;
    R[q + 1] = rand() * Math.PI * 2;
    R[q + 2] = rand();
    R[q + 3] = rand();
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P0, 3));
  geo.setAttribute('aP1', new THREE.BufferAttribute(P1, 3));
  geo.setAttribute('aP2', new THREE.BufferAttribute(P2, 3));
  geo.setAttribute('aP3', new THREE.BufferAttribute(P3, 3));
  geo.setAttribute('aRnd', new THREE.BufferAttribute(R, 4));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uStep: { value: 0 },
      uTime: { value: 0 },
      uPR: { value: renderer.getPixelRatio() },
      uSize: { value: small ? 30 : 34 },
      uDrift: { value: reduce ? 0 : 1 },
      /* 셰이더는 색공간 변환을 하지 않으므로 sRGB 값을 그대로 넘긴다 (THREE.Color는 선형으로 바꿔 버림) */
      uGray: { value: new THREE.Vector3(0xA3 / 255, 0xA7 / 255, 0xB1 / 255) },
      uAccent: { value: new THREE.Vector3(0xFF / 255, 0x5A / 255, 0x1F / 255) },
    },
    vertexShader: /* glsl */`
      attribute vec3 aP1; attribute vec3 aP2; attribute vec3 aP3; attribute vec4 aRnd;
      uniform float uStep; uniform float uTime; uniform float uPR; uniform float uSize; uniform float uDrift;
      uniform vec3 uGray; uniform vec3 uAccent;
      varying vec3 vColor; varying float vAlpha;
      float ease(float t) { return t < 0.5 ? 4.0 * t * t * t : 1.0 - pow(-2.0 * t + 2.0, 3.0) / 2.0; }
      void main() {
        float s = clamp(uStep, 0.0, 3.0);
        float seg = min(floor(s), 2.0);
        float t = s - seg;
        float tt = ease(clamp((t - aRnd.w * 0.4) / 0.6, 0.0, 1.0));
        vec3 a = seg < 0.5 ? position : (seg < 1.5 ? aP1 : aP2);
        vec3 b = seg < 0.5 ? aP1 : (seg < 1.5 ? aP2 : aP3);
        vec3 pos = mix(a, b, tt);
        float lift = sin(tt * 3.14159);
        pos += normalize(pos + vec3(0.0001)) * lift * 0.28 * (0.4 + aRnd.y / 6.2832);
        float chaos = 1.0 - clamp(s, 0.0, 1.0);
        float amp = (0.03 + 0.2 * chaos) * uDrift;
        pos += amp * vec3(sin(uTime * 0.55 + aRnd.y), cos(uTime * 0.47 + aRnd.y * 1.3), sin(uTime * 0.39 + aRnd.y * 0.7));
        vec4 mv = modelViewMatrix * vec4(pos, 1.0);
        gl_Position = projectionMatrix * mv;
        float depth = clamp((mv.z + 14.0) / 6.0, 0.0, 1.0);          /* 0 = 뒤, 1 = 앞 */
        /* 주황은 위쪽 앞면(물결에선 오르는 끝)에 모인다: 전체 비율은 단계마다 늘어난다 */
        vec3 dir = normalize(pos + vec3(0.0001));
        float crest = clamp(0.5 + 0.38 * dir.y + 0.3 * (depth * 2.0 - 1.0), 0.0, 1.0);
        float ratio = (0.03 + 0.14 * s) * mix(0.3, 1.7, crest);
        float acc = step(aRnd.z, ratio);
        vColor = mix(uGray, uAccent, acc);
        gl_PointSize = uSize * aRnd.x * uPR / -mv.z * mix(0.62, 1.55, depth) * mix(1.0, 1.25, acc);
        vAlpha = mix(0.22, 1.0, depth) * mix(0.6, 1.0, acc);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vColor; varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(vColor, smoothstep(0.5, 0.3, d) * vAlpha);
      }`,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  const group = new THREE.Group();
  group.add(points);
  scene.add(group);

  /* 화면 비율에 맞춰 위치 · 크기 조정: 넓은 화면은 오른쪽, 좁은 화면은 위쪽 */
  let baseX = 0, baseY = 0, baseScale = 1;
  const layout = () => {
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    const halfW = halfH * camera.aspect;
    if (camera.aspect >= 1.1) { baseScale = Math.min(0.9, halfH / 3.5); baseX = halfW * 0.34; baseY = -0.05; }
    else { baseScale = Math.min(1, halfW / 3.3); baseX = 0; baseY = halfH * 0.36; }
  };
  layout();
  new ResizeObserver(layout).observe(canvas);

  let running = false, last = performance.now(), time = 0, current = (window.ysJourney && window.ysJourney.s) || 0;
  const frame = (now) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduce) time += dt;
    const state = window.ysJourney || { s: 0, p: 0 };
    current = reduce ? state.s : current + (state.s - current) * Math.min(1, dt * 5);
    mat.uniforms.uStep.value = current;
    mat.uniforms.uTime.value = time;
    group.position.set(baseX, baseY, 0);
    group.scale.setScalar(baseScale);
    group.rotation.y = -0.4 + state.p * 0.75 + (reduce ? 0 : Math.sin(time * 0.18) * 0.06);
    group.rotation.x = 0.16 + (reduce ? 0 : Math.sin(time * 0.13) * 0.04);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !running) { running = true; last = performance.now(); requestAnimationFrame(frame); }
    else if (!e.isIntersecting) running = false;
  }).observe(section);
}
