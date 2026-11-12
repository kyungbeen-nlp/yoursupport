(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = document.querySelector('.site-header');
  const headerH = () => header.getBoundingClientRect().height;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ───────── 첫 화면 인트로는 intro.js가 맡음 (끝나면 'ys:intro-end') */
  const introActive = () => !!(window.ysIntro && window.ysIntro.active);
  const video = document.querySelector('.hero-video');

  /* ───────── 부드러운 스크롤 (움직임 최소화 설정이면 끔) */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ duration: 1.1, smoothWheel: true });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    if (introActive()) {
      lenis.stop();
      window.addEventListener('ys:intro-end', () => lenis.start(), { once: true });
    }
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    const offset = id === '#top' ? 0 : -headerH() + 1;
    if (lenis) lenis.scrollTo(el, { offset });
    else window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + offset, behavior: reduce ? 'auto' : 'smooth' });
    if (el.matches('section, main')) {
      el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    }
    history.replaceState(null, '', id);
  });

  /* ───────── 메뉴바: 첫 화면을 지나면 흰 바탕 */
  const hero = document.querySelector('.hero');
  if (hero && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(([e]) => {
      header.classList.toggle('is-solid', !e.isIntersecting);
    }, { rootMargin: `-${Math.round(headerH())}px 0px 0px 0px` });
    io.observe(hero);
  }

  /* ───────── 배경 영상: 멈춤 버튼 + 화면 밖이면 정지 */
  const toggle = document.querySelector('.video-toggle');
  let userPaused = reduce;
  const setPaused = (paused) => {
    if (!video) return;
    if (paused) video.pause(); else video.play().catch(() => {});
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.setAttribute('aria-label', paused ? '배경 영상 재생' : '배경 영상 멈춤');
  };
  if (video && toggle) {
    if (reduce) { video.removeAttribute('autoplay'); setPaused(true); }
    toggle.addEventListener('click', () => { userPaused = !video.paused ? true : false; setPaused(userPaused); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        if (userPaused || introActive()) return;       /* 인트로 중에는 첫 장면에 멈춰 둠 */
        if (e.isIntersecting) video.play().catch(() => {}); else video.pause();
      }).observe(video);
    }
  }

  /* ───────── 12주 과정: 스크롤 진행도 → 단계 (3D 점은 journey.js가 읽어 감) */
  const journey = document.querySelector('.journey');
  const steps = journey ? Array.from(journey.querySelectorAll('.jstep')) : [];
  const dashes = journey ? Array.from(journey.querySelectorAll('.journey-scale li')) : [];
  window.ysJourney = { p: 0, s: 0, active: 0 };
  /* 진행도 p(0~1) → 모양 단계 s(0~3): 모양이 다 만들어진 구간을 두고 사이에서 바뀜 */
  const shape = (p) => {
    const keys = [[0, 0], [0.1, 0], [0.3, 1], [0.4, 1], [0.6, 2], [0.7, 2], [0.9, 3], [1, 3]];
    for (let i = 1; i < keys.length; i++) {
      const [p1, s1] = keys[i], [p0, s0] = keys[i - 1];
      if (p <= p1) { const t = (p - p0) / (p1 - p0 || 1); const e = t * t * (3 - 2 * t); return s0 + (s1 - s0) * e; }
    }
    return 3;
  };
  let lastActive = -1;
  const updateJourney = () => {
    if (!journey) return;
    const r = journey.getBoundingClientRect();
    const span = r.height - window.innerHeight;
    const p = span > 0 ? clamp(-r.top / span, 0, 1) : 0;
    const active = p < 0.2 ? 0 : p < 0.5 ? 1 : p < 0.8 ? 2 : 3;
    window.ysJourney.p = p;
    window.ysJourney.s = shape(p);
    window.ysJourney.active = active;
    if (active !== lastActive) {
      steps.forEach((el, i) => el.classList.toggle('is-active', i === active));
      dashes.forEach((d, i) => d.classList.toggle('is-on', i < active));
      lastActive = active;
    }
  };
  if (lenis) lenis.on('scroll', updateJourney);
  window.addEventListener('scroll', updateJourney, { passive: true });
  window.addEventListener('resize', updateJourney);
  updateJourney();

  /* ───────── 숫자 카드: 한 번 올라가기 */
  const counts = Array.from(document.querySelectorAll('.count'));
  if (counts.length && !reduce && 'IntersectionObserver' in window) {
    counts.forEach((c) => { c.textContent = '0'; });
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      const t0 = performance.now(), dur = 1400;
      const run = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(2, -10 * k);
        counts.forEach((c) => { c.textContent = String(Math.round(+c.dataset.to * (k >= 1 ? 1 : e))); });
        if (k < 1) requestAnimationFrame(run);
      };
      requestAnimationFrame(run);
    }, { threshold: 0.4 });
    io.observe(document.querySelector('.stats'));
  }

  /* ───────── 이런 밤이 잦다면: 표시한 항목을 신청서에 미리 적어 둠 */
  const checks = Array.from(document.querySelectorAll('.checklist input[type="checkbox"]'));
  const note = document.querySelector('.nights-note');
  const concern = document.getElementById('f-concern');
  const defaultNote = note ? note.textContent : '';
  let concernTouched = false;
  let lastPrefill = '';
  if (concern) concern.addEventListener('input', () => { concernTouched = concern.value !== lastPrefill; });
  checks.forEach((c) => c.addEventListener('change', () => {
    const picked = checks.filter((x) => x.checked).map((x) => x.dataset.text);
    if (note) note.textContent = picked.length ? `표시한 ${picked.length}가지는 아래 신청서에 미리 적어 둘게요.` : defaultNote;
    if (concern && !concernTouched) {
      lastPrefill = picked.length ? picked.map((t) => `· ${t}`).join('\n') + '\n' : '';
      concern.value = lastPrefill;
    }
  }));

  /* ───────── 자주 묻는 질문: 읽은 질문에 주황 점 */
  document.querySelectorAll('.faq-list details').forEach((d) => {
    d.addEventListener('toggle', () => { if (d.open) d.classList.add('is-read'); });
  });

  /* ───────── 첫 상담 신청 폼 */
  const form = document.getElementById('apply-form');
  if (!form) return;
  const status = form.querySelector('.form-status');
  const submit = form.querySelector('button[type="submit"]');
  const rules = {
    name: (v) => (v.trim() ? '' : '이름을 적어 주세요.'),
    phone: (v) => (/^01\d{8,9}$/.test(v.replace(/\D/g, '')) ? '' : '휴대폰 번호를 숫자 10~11자리로 적어 주세요. 예: 010-1234-5678'),
    concern: (v) => (v.trim().length >= 2 ? '' : '고민을 한 줄이라도 적어 주세요. 정리되지 않아도 괜찮습니다.'),
  };
  const setError = (el, errId, msg) => {
    const err = document.getElementById(errId);
    if (msg) { el.setAttribute('aria-invalid', 'true'); err.textContent = msg; err.hidden = false; }
    else { el.removeAttribute('aria-invalid'); err.textContent = ''; err.hidden = true; }
    return !msg;
  };
  const validate = () => [
    setError(form.name, 'e-name', rules.name(form.name.value)),
    setError(form.phone, 'e-phone', rules.phone(form.phone.value)),
    setError(form.concern, 'e-concern', rules.concern(form.concern.value)),
    setError(form.consent, 'e-consent', form.consent.checked ? '' : '개인정보 수집·이용에 동의해야 신청서를 보낼 수 있습니다.'),
  ].every(Boolean);
  ['name', 'phone', 'concern'].forEach((n) => {
    form[n].addEventListener('blur', () => {
      if (form[n].hasAttribute('aria-invalid')) setError(form[n], `e-${n}`, rules[n](form[n].value));
    });
  });
  form.consent.addEventListener('change', () => { if (form.consent.checked) setError(form.consent, 'e-consent', ''); });
  const setStatus = (msg, kind) => { status.textContent = msg; status.className = 'form-status' + (kind ? ` is-${kind}` : ''); };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    setStatus('', '');
    if (!validate()) {
      const first = form.querySelector('[aria-invalid="true"]');
      if (first) first.focus();
      return;
    }
    const endpoint = form.dataset.endpoint;
    if (!endpoint) {
      setStatus('아직 예시 페이지라 신청서가 전송되지 않습니다. 전화나 이메일로 연락해 주세요.', 'notice');
      return;
    }
    submit.setAttribute('aria-busy', 'true'); submit.disabled = true; submit.textContent = '보내는 중…';
    try {
      const res = await fetch(endpoint, { method: 'POST', body: new FormData(form) });
      if (!res.ok && res.type !== 'opaque') throw new Error(String(res.status));
      const done = document.createElement('div');
      done.className = 'apply-done'; done.tabIndex = -1;
      done.innerHTML = '<h3>신청서를 받았습니다</h3><p>남겨 주신 번호로 연락드릴게요. 그 사이 떠오르는 생각이 있다면 메모해 두셔도 좋습니다.</p>';
      form.replaceChildren(done);
      done.focus();
    } catch (err) {
      setStatus('신청서를 보내지 못했습니다. 잠시 뒤 다시 시도하시거나 전화로 연락해 주세요.', 'error');
      submit.removeAttribute('aria-busy'); submit.disabled = false; submit.textContent = '첫 상담 신청하기';
    }
  });
})();
