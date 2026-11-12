/* Your Support — 첫 화면 인트로
   종이 위에 로고가 써지고 → 글자의 잉크가 점으로 흩어져 상담 장면(영상 첫 장면)을 점묘로 그리고 →
   그 그림이 실제 영상으로 바뀐다. 어떤 단계가 실패해도 로고 → 영상으로 부드럽게 넘어간다. */
(() => {
  const root = document.documentElement;
  const intro = document.querySelector('.intro');
  const video = document.querySelector('.hero-video');
  const meta = document.querySelector('meta[name="theme-color"]');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  let ended = false;
  let revealed = false;
  let started = false;
  let gl = null;
  const listeners = [];
  window.ysIntro = { active: true };

  const reveal = () => {
    if (revealed) return;
    revealed = true;
    root.classList.add('is-revealed');
  };
  const end = () => {
    if (ended) return;
    ended = true;
    window.ysIntro.active = false;
    reveal();
    root.classList.remove('is-intro', 'is-developing');
    if (meta) meta.setAttribute('content', '#121316');
    if (started && video && video.paused && !reduce) {   /* 시간 초과·오류·숨은 탭 등 어떤 경로로 끝나도 영상은 재생 */
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
    }
    listeners.forEach(([t, f]) => window.removeEventListener(t, f));
    if (gl) { const x = gl.getExtension('WEBGL_lose_context'); if (x) x.loseContext(); gl = null; }
    if (intro) intro.remove();
    window.dispatchEvent(new Event('ys:intro-end'));
  };
  const playVideo = () => {
    if (!video || reduce) return;
    try { if (video.currentTime > 0.05) video.currentTime = 0; } catch (e) { /* 아직 메타데이터 없음 */ }
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
  };

  if (!intro || root.classList.contains('no-intro')) { end(); return; }

  started = true;
  root.classList.add('is-intro');
  if (meta) meta.setAttribute('content', '#FAF9F4');
  window.scrollTo(0, 0);
  if (video) { video.pause(); }
  setTimeout(end, 12000);                       /* 무슨 일이 있어도 12초 안에는 첫 화면이 열림 */

  const logo = intro.querySelector('.intro-logo');
  const paper = intro.querySelector('.intro-paper');
  const canvas = intro.querySelector('.intro-canvas');
  const small = window.innerWidth < 860;
  const T = reduce
    ? { write: 0, hold: 1100, travel: 0, rest: 0, develop: 700 }
    : { write: 1250, hold: 420, travel: small ? 2100 : 2350, rest: 480, develop: 1250 };

  /* ───────── 점 만들기: 로고 잉크 위치 · 장면 점묘 위치 */
  const loadImg = (src) => new Promise((res, rej) => {
    const im = new Image();
    im.decoding = 'async';
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
  const posterP = video && video.getAttribute('poster') && !reduce ? loadImg(video.getAttribute('poster')) : Promise.reject(new Error('no poster'));
  posterP.catch(() => {});
  const logoP = new Promise((res) => {
    if (!logo) return res(null);
    const done = () => res(logo);
    if (logo.complete && logo.naturalWidth) done();
    else { logo.addEventListener('load', done, { once: true }); logo.addEventListener('error', () => res(null), { once: true }); }
  });

  const rand = (() => { let s = 0x9e3779b9; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; }; })();

  /* 로고: 화면에 놓인 크기 그대로 그려서 잉크 픽셀을 고른다 */
  function logoPoints(n) {
    const r = logo.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(logo, 0, 0, w, h);
    const a = g.getImageData(0, 0, w, h).data;
    const ink = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a[(y * w + x) * 4 + 3] > 140) ink.push(x, y);
    const m = ink.length / 2;
    if (m < 50) throw new Error('logo empty');
    const out = new Float32Array(n * 2), nx = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const j = Math.floor(rand() * m) * 2;
      out[2 * i] = r.left + ink[j] + rand();
      out[2 * i + 1] = r.top + ink[j + 1] + rand();
      nx[i] = ink[j] / w;
    }
    return { xy: out, nx };
  }

  /* 장면: 영상이 화면에 놓이는 자리(cover · object-position)와 똑같이 첫 장면을 깔고 점묘 */
  function scenePoints(poster, n, W, H) {
    const vr = video.getBoundingClientRect();
    const pos = getComputedStyle(video).objectPosition.split(' ').map((v) => (v.endsWith('%') ? parseFloat(v) / 100 : 0.5));
    const iw = poster.naturalWidth, ih = poster.naturalHeight;
    const s = Math.max(vr.width / iw, vr.height / ih);
    const dw = iw * s, dh = ih * s;
    const ox = vr.left + (vr.width - dw) * pos[0], oy = vr.top + (vr.height - dh) * (pos[1] === undefined ? 0.5 : pos[1]);
    const clipBottom = Math.min(H, vr.bottom);

    const grid = (cell) => {
      const gw = Math.ceil(W / cell), gh = Math.ceil(H / cell);
      const c = document.createElement('canvas'); c.width = gw; c.height = gh;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.fillStyle = '#fff'; g.fillRect(0, 0, gw, gh);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(poster, ox / cell, oy / cell, dw / cell, dh / cell);
      const d = g.getImageData(0, 0, gw, gh).data;
      const L = new Float32Array(gw * gh);
      for (let i = 0; i < gw * gh; i++) L[i] = (0.2126 * d[4 * i] + 0.7152 * d[4 * i + 1] + 0.0722 * d[4 * i + 2]) / 255;
      const F = new Float32Array(gw * gh);       /* 칸마다 초점 값 (focus는 아래에서 만들어 둠) */
      for (let y = 0; y < gh; y++) {
        const v = Math.min(fh - 1, Math.max(0, Math.floor((((y + 0.5) * cell - oy) / dh) * fh)));
        for (let x = 0; x < gw; x++) {
          const u = Math.min(fw - 1, Math.max(0, Math.floor((((x + 0.5) * cell - ox) / dw) * fw)));
          F[y * gw + x] = focus[v * fw + u];
        }
      }
      return { gw, gh, L, F };
    };
    const blur = (src, gw, gh, rad) => {          /* 상자 흐림 2번 = 부드러운 흐림 */
      let a = src.slice(), b = new Float32Array(src.length);
      for (let pass = 0; pass < 2; pass++) {
        for (let y = 0; y < gh; y++) {
          let acc = 0, cnt = 0;
          for (let x = -rad; x < gw; x++) {
            if (x + rad < gw) { acc += a[y * gw + x + rad]; cnt++; }
            if (x - rad - 1 >= 0) { acc -= a[y * gw + x - rad - 1]; cnt--; }
            if (x >= 0) b[y * gw + x] = acc / cnt;
          }
        }
        for (let x = 0; x < gw; x++) {
          let acc = 0, cnt = 0;
          for (let y = -rad; y < gh; y++) {
            if (y + rad < gh) { acc += b[(y + rad) * gw + x]; cnt++; }
            if (y - rad - 1 >= 0) { acc -= b[(y - rad - 1) * gw + x]; cnt--; }
            if (y >= 0) a[y * gw + x] = acc / cnt;
          }
        }
      }
      return a;
    };
    const pct = (arr, p) => {                     /* 0~1 값의 백분위 (히스토그램) */
      const hist = new Uint32Array(512);
      for (let i = 0; i < arr.length; i++) hist[Math.min(511, Math.max(0, Math.floor(arr[i] * 511)))]++;
      const want = arr.length * p;
      let acc = 0;
      for (let i = 0; i < 512; i++) { acc += hist[i]; if (acc >= want) return i / 511; }
      return 1;
    };
    /* 초점 지도: 반 해상도에서 국소 라플라시안 에너지 → 크게 흐림 → 백분위 정규화.
       초점이 맞은 사람(코치)에 잉크가 모이고, 흐린 앞사람·배경은 옅어진다 */
    const fw = Math.max(16, Math.round(iw / 2)), fh = Math.max(16, Math.round(ih / 2));
    const focus = (() => {
      const c = document.createElement('canvas'); c.width = fw; c.height = fh;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(poster, 0, 0, fw, fh);
      const d = g.getImageData(0, 0, fw, fh).data;
      const Y = new Float32Array(fw * fh);
      for (let i = 0; i < fw * fh; i++) Y[i] = (0.299 * d[4 * i] + 0.587 * d[4 * i + 1] + 0.114 * d[4 * i + 2]) / 255;
      const lap = new Float32Array(fw * fh);
      for (let y = 1; y < fh - 1; y++) for (let x = 1; x < fw - 1; x++) {
        const i = y * fw + x;
        lap[i] = Math.min(1, Math.abs(4 * Y[i] - Y[i - 1] - Y[i + 1] - Y[i - fw] - Y[i + fw]) * 4);
      }
      const F = blur(lap, fw, fh, Math.max(4, Math.round(fw / 53)));
      const top = pct(F, 0.92) || 1;
      for (let i = 0; i < F.length; i++) F[i] = Math.min(1, F[i] / top);
      return F;
    })();
    const importance = ({ gw, gh, L, F }) => {
      const B = blur(L, gw, gh, Math.max(2, Math.round(gw / 40)));
      const C = new Float32Array(L.length);
      for (let i = 0; i < L.length; i++) C[i] = clamp(L[i] + (L[i] - B[i]) * 0.8, 0, 1);
      const lo = pct(C, 0.03), hi = pct(C, 0.97);
      const E = new Float32Array(L.length);
      for (let y = 1; y < gh - 1; y++) for (let x = 1; x < gw - 1; x++) {
        const i = y * gw + x;
        const gx = (C[i + 1] - C[i - 1]) / (hi - lo + 1e-6), gy = (C[i + gw] - C[i - gw]) / (hi - lo + 1e-6);
        E[i] = Math.sqrt(gx * gx + gy * gy);
      }
      const e97 = pct(E.map((v) => Math.min(1, v)), 0.97) || 1;
      const I = new Float32Array(L.length);
      for (let i = 0; i < L.length; i++) {
        const l = clamp((C[i] - lo) / (hi - lo + 1e-6), 0, 1);
        const e = clamp((Math.min(1, E[i]) / e97 - 0.25) / 0.75, 0, 1);   /* 얼굴선·눈매 같은 윤곽도 점으로 */
        I[i] = clamp((1 - l) * (1 - l) + e * 0.55, 0, 1) * (0.5 + 0.5 * F[i]);
      }
      return I;
    };

    const probe = grid(4);
    const pI = importance(probe);
    let mean = 0; for (let i = 0; i < pI.length; i++) mean += pI[i]; mean /= pI.length;
    const cell = Math.max(2.5, Math.sqrt((W * H * 0.9 * mean) / n));
    const G = grid(cell);
    const I = importance(G);
    const { gw, gh } = G;
    let sum = 0; for (let i = 0; i < I.length; i++) sum += I[i];
    const gain = n / (sum || 1);
    const v = new Float32Array(I.length);
    for (let i = 0; i < I.length; i++) v[i] = I[i] * gain;

    const pts = [];
    for (let y = 0; y < gh; y++) {                  /* 오차 확산(지그재그) */
      const ltr = (y & 1) === 0, dx = ltr ? 1 : -1;
      for (let k = 0; k < gw; k++) {
        const x = ltr ? k : gw - 1 - k, i = y * gw + x;
        const old = v[i], on = old >= 0.5, err = old - (on ? 1 : 0);
        if (on && (y + 0.5) * cell <= clipBottom) pts.push(x, y);
        if (x + dx >= 0 && x + dx < gw) v[i + dx] += err * 7 / 16;
        if (y + 1 < gh) {
          if (x - dx >= 0 && x - dx < gw) v[i + gw - dx] += err * 3 / 16;
          v[i + gw] += err * 5 / 16;
          if (x + dx >= 0 && x + dx < gw) v[i + gw + dx] += err / 16;
        }
      }
    }
    const m = pts.length / 2;
    if (m < 200) throw new Error('scene empty');
    const idx = new Uint32Array(m); for (let i = 0; i < m; i++) idx[i] = i;
    for (let i = m - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
    const xy = new Float32Array(n * 2), tone = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const k = idx[i % m], x = pts[2 * k], y = pts[2 * k + 1];
      const dup = i >= m ? 0.35 : 0;              /* 모자라면 겹쳐 놓되 살짝 비켜 */
      xy[2 * i] = (x + 0.5 + (rand() - 0.5) * (0.8 + dup)) * cell;
      xy[2 * i + 1] = (y + 0.5 + (rand() - 0.5) * (0.8 + dup)) * cell;
      tone[i] = I[y * gw + x];
    }
    return { xy, tone, cell };
  }

  /* 위치를 띠(가로 순) → 띠 안(세로 순)으로 정렬해 짝지음: 로고의 왼쪽 위는 장면의 왼쪽 위로 */
  function stripOrder(xy, n, strips) {
    const byX = Array.from({ length: n }, (_, i) => i).sort((a, b) => xy[2 * a] - xy[2 * b]);
    const out = new Uint32Array(n);
    const per = n / strips;
    for (let s = 0; s < strips; s++) {
      const a = Math.round(s * per), b = Math.round((s + 1) * per);
      const part = byX.slice(a, b).sort((p, q) => xy[2 * p + 1] - xy[2 * q + 1]);
      out.set(part, a);
    }
    return out;
  }

  /* ───────── WebGL 점 그리기 */
  const VS = `
attribute vec2 aFrom; attribute vec2 aTo; attribute vec4 aSeed; attribute float aTone;
uniform vec2 uRes; uniform float uPR; uniform float uT; uniform float uTime;
uniform float uSizeA; uniform vec2 uSizeB; uniform float uShrink;
varying float vA;
const float SPAN = 0.48;
float ease(float t){ return t < 0.5 ? 4.0*t*t*t : 1.0 - pow(-2.0*t + 2.0, 3.0) * 0.5; }
void main(){
  float start = aSeed.x * (1.0 - SPAN);
  float k = clamp((uT - start) / SPAN, 0.0, 1.0);
  float e = ease(k);
  vec2 d = aTo - aFrom;
  float len = length(d);
  vec2 n = len > 0.001 ? vec2(-d.y, d.x) / len : vec2(0.0);
  vec2 c = mix(aFrom, aTo, 0.5) + n * (aSeed.z * len * 0.3);
  vec2 p = mix(mix(aFrom, c, e), mix(c, aTo, e), e);
  float mid = sin(3.14159265 * e);
  float pre = (1.0 - step(0.0001, k)) * smoothstep(-0.22, 0.0, uT - start) * step(0.0001, uT);
  p += vec2(sin(uTime * 2.3 + aSeed.w), cos(uTime * 1.9 + aSeed.w * 1.7)) * (mid * 9.0 + pre * 0.9);
  vec2 q = p / uRes * 2.0 - 1.0;
  gl_Position = vec4(q.x, -q.y, 0.0, 1.0);
  float sb = mix(uSizeB.x, uSizeB.y, aTone);
  float size = mix(uSizeA, sb, e) * aSeed.y * (1.0 + mid * 0.35) * (1.0 - uShrink * 0.55);
  gl_PointSize = max(size * uPR, 1.0);
  vA = 1.0 - mid * 0.15;
}`;
  const FS = `
precision mediump float;
uniform vec3 uInk; uniform float uAlpha;
varying float vA;
void main(){
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.68, 1.0, r)) * vA * uAlpha;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uInk * a, a);
}`;

  let draw = null;                                  /* (uT, time, alpha, shrink) => void */
  function buildGL(from, to, seed, tone, n, sizes) {
    const W = canvas.clientWidth || window.innerWidth, H = canvas.clientHeight || window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * pr); canvas.height = Math.round(H * pr);
    gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, powerPreference: 'high-performance' });
    if (!gl) throw new Error('no webgl');
    canvas.addEventListener('webglcontextlost', (e) => {     /* 휴대폰 GPU가 문맥을 거둬 가면 빈 종이 대신 바로 영상으로 */
      e.preventDefault();
      particles = false; draw = null; gl = null;
      if (state === 'travel' || state === 'rest') { speed = 2; startDevelop(); }
    }, { once: true });
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const attr = (name, data, size) => {
      const loc = gl.getAttribLocation(prog, name);
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    attr('aFrom', from, 2); attr('aTo', to, 2); attr('aSeed', seed, 4); attr('aTone', tone, 1);
    const u = (name) => gl.getUniformLocation(prog, name);
    const uT = u('uT'), uTime = u('uTime'), uAlpha = u('uAlpha'), uShrink = u('uShrink');
    gl.uniform2f(u('uRes'), W, H);
    gl.uniform1f(u('uPR'), pr);
    gl.uniform1f(u('uSizeA'), sizes.a);
    gl.uniform2f(u('uSizeB'), sizes.min, sizes.max);
    gl.uniform3f(u('uInk'), 0x12 / 255, 0x12 / 255, 0x10 / 255);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    draw = (t, time, alpha, shrink) => {
      if (!gl) return;
      gl.uniform1f(uT, t); gl.uniform1f(uTime, time); gl.uniform1f(uAlpha, alpha); gl.uniform1f(uShrink, shrink);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, n);
    };
  }

  function prepare(poster) {
    const W = canvas.clientWidth || window.innerWidth, H = canvas.clientHeight || window.innerHeight;
    const n = Math.round(clamp((W * H) / 80, 8000, 22000));
    const L = logoPoints(n);
    const S = scenePoints(poster, n, W, H);
    const strips = Math.max(8, Math.round(Math.sqrt(n * (W / H))));
    const oL = stripOrder(L.xy, n, strips), oS = stripOrder(S.xy, n, strips);
    const from = new Float32Array(n * 2), to = new Float32Array(n * 2), seed = new Float32Array(n * 4), tone = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = oL[i], b = oS[i];
      from[2 * i] = L.xy[2 * a]; from[2 * i + 1] = L.xy[2 * a + 1];
      to[2 * i] = S.xy[2 * b]; to[2 * i + 1] = S.xy[2 * b + 1];
      seed[4 * i] = clamp(L.nx[a] * 0.8 + rand() * 0.2, 0, 1);     /* 로고가 써진 방향(왼→오)대로 떠남 */
      seed[4 * i + 1] = 0.85 + rand() * 0.3;
      seed[4 * i + 2] = (rand() * 2 - 1) * 0.9;
      seed[4 * i + 3] = rand() * 6.2832;
      tone[i] = S.tone[b];
    }
    const max = clamp(S.cell * 0.72, 2.6, 4.6);
    buildGL(from, to, seed, tone, n, { a: small ? 1.9 : 2.3, min: max * 0.34, max });
  }

  /* ───────── 진행: 쓰기 → 잠깐 머묾 → 흩어져 장면 → 머묾 → 영상으로 */
  let state = 'boot', clock = 0, last = performance.now(), speed = 1, mark = 0, particles = false, prepTried = false;
  let posterImg = null;
  posterP.then((im) => { posterImg = im; }, () => {});

  const go = (s) => { state = s; mark = clock; };
  const startDevelop = () => {
    intro.classList.add('is-developing');
    root.classList.add('is-developing');           /* 첫 화면 그늘은 이때부터 함께 짙어짐 */
    playVideo();
    go('develop');
  };
  const startWrite = () => {
    if (state !== 'boot') return;
    intro.classList.add('is-in');
    go('write');
  };
  const skip = () => {
    if (ended) return;
    if (state === 'boot' || state === 'write') { particles = false; speed = 2.2; startDevelop(); return; }
    speed = state === 'develop' ? 3 : 5;
  };
  const size0 = [window.innerWidth, window.innerHeight];
  const onResize = () => {                          /* 주소창 접힘 같은 작은 변화는 무시, 화면 방향·크기가 바뀌면 바로 영상으로 */
    if (Math.abs(window.innerWidth - size0[0]) > 40 || Math.abs(window.innerHeight - size0[1]) > 160) skip();
  };
  [['wheel', skip], ['touchstart', skip], ['keydown', skip], ['pointerdown', skip], ['resize', onResize]].forEach(([t, f]) => {
    window.addEventListener(t, f, { passive: true });
    listeners.push([t, f]);
  });

  logoP.then(() => {
    if (logo && logo.decode) logo.decode().then(startWrite, startWrite); else startWrite();
  });
  setTimeout(startWrite, 2500);                     /* 로고가 늦으면 종이에서 바로 진행 */

  const frame = (now) => {
    if (ended) return;
    const dt = Math.min(64, now - last); last = now;
    clock += dt * speed;
    const t = clock - mark;
    try {
      if (state === 'write') {
        if (!prepTried && t >= T.write) {
          if (posterImg && !reduce) {
            prepTried = true;
            try { prepare(posterImg); particles = true; } catch (e) { particles = false; }
          } else if (t >= T.write + T.hold + 1600 || reduce) {
            prepTried = true;                       /* 첫 장면을 못 받으면 점 없이 넘어감 */
          }
        }
        if (prepTried && t >= T.write + T.hold) {
          if (particles) { intro.classList.add('is-moving'); go('travel'); }
          else startDevelop();
        }
      } else if (state === 'travel') {
        const k = clamp(t / T.travel, 0, 1);
        if (draw) draw(k, clock / 1000, 1, 0);
        if (k >= 1) go('rest');
      } else if (state === 'rest') {
        if (draw) draw(1, clock / 1000, 1, 0);
        if (t >= T.rest) startDevelop();
      } else if (state === 'develop') {
        const k = clamp(t / T.develop, 0, 1);
        const e = easeIO(k);
        paper.style.opacity = String(1 - e);
        if (particles && draw) draw(1, clock / 1000, 1 - easeIO(clamp(k * 1.25, 0, 1)), k);
        else if (logo) logo.style.opacity = String(1 - easeIO(clamp(k * 1.4, 0, 1)));
        if (k >= 0.6) reveal();                     /* 종이가 80% 가까이 걷힌 뒤 제목·메뉴 등장 */
        if (k >= 1) { end(); return; }
      }
    } catch (err) {
      end();
      return;
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();
