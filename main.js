/* Oscar Caux · portfolio
   No dependencies. Sections: storage, theme, sound, nav, reveal, index preview,
   DVS (event camera) simulator for the hero, road scenario, misc. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const fr_ = root.lang === 'fr';
  const tr = (en, fr) => fr_ ? fr : en;
  const f1 = (x) => fr_ ? x.toFixed(1).replace('.', ',') : x.toFixed(1); // two languages, so a function beats a dictionary

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} },
  };

  /* ---------- Theme ---------- */
  const darkMq = matchMedia('(prefers-color-scheme: dark)');
  const savedTheme = store.get('oc-theme');
  if (savedTheme) root.dataset.theme = savedTheme;
  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : darkMq.matches;
  let palette = {};
  function readPalette() {
    const cs = getComputedStyle(root);
    const v = (n) => cs.getPropertyValue(n).trim();
    palette = { on: v('--on'), off: v('--off'), ink: v('--ink'), ink3: v('--ink-3'), bg: v('--bg'), bg2: v('--bg-2'), line: v('--line-2') };
    $('meta[name="theme-color"]').content = cs.getPropertyValue('--bg').trim();
  }
  readPalette();
  darkMq.addEventListener('change', readPalette);
  const themeBtn = $('#theme-toggle');
  function syncThemeBtn() {
    // the button names the mode it switches to
    $('.label', themeBtn).textContent = isDark() ? tr('Light', 'Clair') : tr('Dark', 'Sombre');
    themeBtn.setAttribute('aria-pressed', String(isDark()));
    themeBtn.setAttribute('aria-label', isDark() ? tr('Switch to light mode', 'Passer en mode clair') : tr('Switch to dark mode', 'Passer en mode sombre'));
  }
  syncThemeBtn();
  darkMq.addEventListener('change', syncThemeBtn);
  themeBtn.addEventListener('click', () => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    store.set('oc-theme', root.dataset.theme);
    readPalette(); syncThemeBtn();
  });

  /* ---------- Sound (WebAudio, synthesised, no files) ---------- */
  const Sound = {
    ctx: null, on: false, noise: null,
    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    },
    blip(freq = 2200, dur = 0.03, vol = 0.03, type = 'sine') {
      if (!this.on || !this.ctx) return;
      const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.02);
    },
    burst(dur = 0.04, vol = 0.12, freq = 3000, q = 1.2, when = 0) {
      if (!this.on || !this.ctx) return;
      const t = this.ctx.currentTime + when, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
      s.buffer = this.noise; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f).connect(g).connect(this.master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
    },
    tick() { this.blip(2600 + Math.random() * 300, 0.022, 0.022, 'triangle'); },
    click() { this.burst(0.035, 0.1, 3200, 1.4); this.blip(900, 0.05, 0.03); },
    shutter() { this.burst(0.03, 0.22, 2400, 0.9); this.burst(0.05, 0.16, 1400, 0.9, 0.075); },
    chime() { this.blip(880, 0.18, 0.05); setTimeout(() => this.blip(1320, 0.22, 0.04), 90); }
  };
  const soundBtn = $('#sound-toggle');
  function setSound(on) {
    Sound.on = on;
    soundBtn.setAttribute('aria-pressed', String(on));
    $('.label', soundBtn).textContent = on ? tr('Sound on', 'Son activé') : tr('Sound off', 'Son coupé');
    store.set('oc-sound', on ? '1' : '0');
  }
  soundBtn.addEventListener('click', () => {
    Sound.init();
    if (Sound.ctx && Sound.ctx.state === 'suspended') Sound.ctx.resume();
    setSound(!Sound.on);
    if (Sound.on) Sound.chime();
  });
  // Remembered preference still needs a user gesture before audio can start.
  if (store.get('oc-sound') === '1') {
    $('.label', soundBtn).textContent = tr('Sound: tap', 'Son : toucher');
    const arm = () => { Sound.init(); Sound.ctx && Sound.ctx.resume(); setSound(true); };
    addEventListener('pointerdown', arm, { once: true });
  }
  let lastTick = 0;
  document.addEventListener('pointerover', (e) => {
    const el = e.target.closest('[data-snd]');
    if (!el || el.contains(e.relatedTarget)) return;
    const now = performance.now();
    if (now - lastTick > 45) { Sound.tick(); lastTick = now; }
  });
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-snd]');
    if (el && el !== soundBtn) Sound.click();
  });

  /* ---------- Nav: clock, progress, active section ---------- */
  const clock = $('#clock');
  const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  const tickClock = () => { clock.textContent = fmt.format(new Date()); };
  tickClock(); setInterval(tickClock, 15000);

  const nav = $('.nav'), bar = $('.progress span');
  const bleedImgs = $$('.bleed img');
  function onScroll() {
    const h = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${h > 0 ? scrollY / h : 0})`;
    nav.classList.toggle('scrolled', scrollY > 10);
    if (!reduced) for (const img of bleedImgs) {
      const r = img.parentElement.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const p = (r.bottom) / (innerHeight + r.height); // 1 → entering, 0 → leaving
      img.style.transform = `translate3d(0, ${-(1 - p) * 15}%, 0)`;
    }
  }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  const navLinks = $$('.nav-links a');
  const sectionFor = { work: 'work', t1: 'work', r2e: 'work', lab: 'lab', about: 'about', contact: 'contact' };
  const secObs = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) {
      const key = sectionFor[en.target.id];
      navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + key));
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  Object.keys(sectionFor).forEach(id => { const el = document.getElementById(id); el && secObs.observe(el); });

  /* ---------- Reveal on scroll + count-up ---------- */
  function countUp(el) {
    const end = +el.dataset.count, t0 = performance.now(), dur = 1400;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      el.textContent = Math.round(end * e).toLocaleString('en-US').replace(/,/g, ' ');
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const revObs = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) {
      en.target.classList.add('in');
      if (!reduced) $$('[data-count]', en.target).forEach(countUp);
      revObs.unobserve(en.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
  $$('[data-reveal]').forEach(el => revObs.observe(el));

  /* ---------- Index hover preview ---------- */
  const preview = $('#preview'), pImg = $('img', preview);
  let px = 0, py = 0, tx = 0, ty = 0, previewOn = false;
  $$('#index a').forEach(a => {
    a.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse') return;
      pImg.src = a.dataset.preview; preview.classList.add('show');
      if (!previewOn) { px = tx = e.clientX + 180; py = ty = e.clientY; }
      previewOn = true;
    });
    a.addEventListener('pointerleave', () => { preview.classList.remove('show'); previewOn = false; });
  });
  $('#index').addEventListener('pointermove', (e) => { tx = e.clientX + 180; ty = e.clientY; });
  (function follow() {
    px += (tx - px) * 0.18; py += (ty - py) * 0.18;
    preview.style.left = px + 'px'; preview.style.top = py + 'px';
    requestAnimationFrame(follow);
  })();

  /* ---------- DVS simulator ----------
     Same principle as a real event pixel: each cell keeps a reference
     log-intensity and fires ON/OFF events whenever the current value
     drifts more than a contrast threshold C away from it. */
  function DVS(canvas, { cell, C, decay, noise = 0, scene, alpha = 1 }) {
    const ctx = canvas.getContext('2d');
    const off = document.createElement('canvas');
    const octx = off.getContext('2d', { willReadFrequently: true });
    const LEVELS = 6;
    let W = 0, H = 0, dpr = 1, ref, last, pol, rate = 0;
    const self = { C, decay, octx, get W() { return W; }, get H() { return H; }, off, get rate() { return rate; } };

    self.resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
      W = Math.max(1, Math.ceil(r.width / cell)); H = Math.max(1, Math.ceil(r.height / cell));
      off.width = W; off.height = H;
      ref = new Float32Array(W * H).fill(NaN);
      last = new Float32Array(W * H).fill(-1e9);
      pol = new Int8Array(W * H);
    };

    self.step = (now, dt, drawEvents = true) => {
      scene(octx, W, H, now);
      const d = octx.getImageData(0, 0, W, H).data;
      const Cc = self.C;
      let count = 0;
      for (let i = 0, n = W * H; i < n; i++) {
        const j = i << 2;
        const L = Math.log(d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114 + 6);
        const r0 = ref[i];
        if (r0 !== r0) { ref[i] = L; continue; } // NaN → first sample
        const diff = L - r0;
        if (diff > Cc || diff < -Cc) {
          const k = Math.floor(Math.abs(diff) / Cc);
          ref[i] = r0 + Math.sign(diff) * k * Cc;
          pol[i] = diff > 0 ? 1 : -1; last[i] = now; count += k;
        } else if (noise && Math.random() < noise) {
          pol[i] = Math.random() < 0.5 ? 1 : -1; last[i] = now; count++;
        }
      }
      const inst = count / Math.max(dt, 1) * 1000;
      rate += (inst - rate) * 0.08;
      if (drawEvents) self.draw(now);
      return count;
    };

    self.draw = (now, clear = true) => {
      if (clear) ctx.clearRect(0, 0, canvas.width, canvas.height);
      const s = cell * dpr, g = Math.max(0.5, s * 0.14), sz = s - 2 * g;
      const buckets = [];
      for (let b = 0; b < LEVELS * 2; b++) buckets.push([]);
      const dec = self.decay;
      for (let i = 0, n = W * H; i < n; i++) {
        const age = now - last[i];
        if (age >= dec) continue;
        const lvl = Math.min(LEVELS - 1, Math.floor((1 - age / dec) * LEVELS));
        buckets[(pol[i] > 0 ? 0 : LEVELS) + lvl].push(i);
      }
      for (let b = 0; b < buckets.length; b++) {
        const list = buckets[b]; if (!list.length) continue;
        ctx.fillStyle = b < LEVELS ? palette.on : palette.off;
        ctx.globalAlpha = alpha * ((b % LEVELS) + 1) / LEVELS;
        ctx.beginPath();
        for (const i of list) { const x = i % W, y = (i / W) | 0; ctx.rect(x * s + g, y * s + g, sz, sz); }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    self.ctx = ctx;
    Object.defineProperty(self, 'scale', { get: () => cell * dpr });
    self.resize();
    return self;
  }

  /* Run a sim only while visible */
  function runWhenVisible(el, loop) {
    let raf = 0, visible = false, t0 = performance.now();
    const frame = (t) => { const dt = t - t0; t0 = t; loop(t, Math.min(dt, 64)); raf = requestAnimationFrame(frame); };
    new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible && !raf) { t0 = performance.now(); raf = requestAnimationFrame(frame); }
      if (!visible && raf) { cancelAnimationFrame(raf); raf = 0; }
    }).observe(el);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && raf) { cancelAnimationFrame(raf); raf = 0; }
      else if (!document.hidden && visible && !raf) { t0 = performance.now(); raf = requestAnimationFrame(frame); }
    });
  }

  /* ---------- Hero: ambient moving scene + your cursor ---------- */
  const heroCanvas = $('#hero-dvs'), hero = $('.hero');
  const pointer = { x: -1, y: -1, sx: -1, sy: -1, inside: false };
  hero.addEventListener('pointermove', (e) => {
    const r = heroCanvas.getBoundingClientRect();
    pointer.x = (e.clientX - r.left) / r.width; pointer.y = (e.clientY - r.top) / r.height; pointer.inside = true;
    if (pointer.sx < 0) { pointer.sx = pointer.x; pointer.sy = pointer.y; }
  });
  hero.addEventListener('pointerleave', () => { pointer.inside = false; });

  let heroT = 0;
  const heroSim = DVS(heroCanvas, {
    cell: innerWidth < 700 ? 5 : 6, C: 0.16, decay: 400, noise: 0.00003, alpha: 0.75,
    scene(c, W, H) {
      c.fillStyle = '#b4b4b4'; c.fillRect(0, 0, W, H);
      const t = heroT / 1000, m = Math.min(W, H);
      // orbiting discs: reduced size for high contrast and clean typography
      const cx = W * 0.74, cy = H * 0.48;
      for (let k = 0; k < 3; k++) {
        const a = t * (0.32 + k * 0.15) + k * 2.1, rad = m * (0.12 + k * 0.07);
        c.fillStyle = k === 1 ? '#f4f4f4' : '#3a3a3a';
        c.beginPath(); c.arc(cx + Math.cos(a) * rad * 1.3, cy + Math.sin(a) * rad * 0.8, m * (0.026 + k * 0.012), 0, 7); c.fill();
      }
      // ring
      c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(1, m * 0.012);
      c.beginPath(); c.arc(cx, cy, m * (0.3 + Math.sin(t * 0.5) * 0.02), 0, 7); c.stroke();
      // your cursor
      if (pointer.inside) {
        pointer.sx += (pointer.x - pointer.sx) * 0.25; pointer.sy += (pointer.y - pointer.sy) * 0.25;
        c.fillStyle = '#1c1c1c';
        c.beginPath(); c.arc(pointer.sx * W, pointer.sy * H, m * 0.045, 0, 7); c.fill();
      }
    },
  });
  const heroRate = $('#hero-rate');
  let heroReadoutT = 0;
  runWhenVisible(hero, (t, dt) => {
    if (!reduced) heroT += dt;
    heroSim.step(t, dt);
    if (t - heroReadoutT > 250) { heroRate.textContent = Math.round(heroSim.rate).toLocaleString('en-US'); heroReadoutT = t; }
  });

  /* ---------- Scenario: a child runs into the road ----------
     Deliberately simple kinematics; both cars share everything but the sensor. */
  (function roadScenario() {
    const wrap = $('#road-demo');
    if (!wrap) return;
    const D = 15, ACT = 0.1, DEC = 7.5, EV_LAT = 0.01, INF = 0.05, SHARP = 2, PRE = 1.2;
    const XC = 0, VIEW_X0 = -23, VIEW_W = 30, VIEW_Y0 = 2.6, VIEW_H = 8.6;
    const LANE_Y = 6.45, CHILD_Y0 = 9.3, CHILD_STOP = 6.9, CHILD_V = 3;
    let kmh = 50, fps = 30, t = -PRE, playing = false, phase = 0, started = false;
    let speed = 0.3, paused = false, silent = false; // silent: no sound while seeking

    const lanes = $$('.road-lane', wrap).map(el => ({
      el, kind: el.dataset.lane, cv: $('canvas', el), tl: $('[data-tl]', el), res: $('[data-result]', el),
      ctx: $('canvas', el).getContext('2d'), sparks: [], ghosts: [], tDet: 0, tBrake: 0, beeped: false, ended: false,
    }));

    const laneOf = (kind) => lanes.find(L => L.kind === kind);
    const score = (k) => $(`[data-score="${k}"]`, wrap);
    const verdict = $('#road-verdict');
    const ms = (s) => `+${Math.round(s * 1000)} ms`;
    const v = () => kmh / 3.6;
    function plan(keepPhase) {
      const period = 1 / fps;
      if (!keepPhase) phase = Math.random() * period;
      for (const L of lanes) {
        // frame path: wait for the next capture, then SHARP more frames to confirm, then inference
        L.tDet = L.kind === 'event' ? EV_LAT : phase + SHARP * period + INF;
        L.tBrake = L.tDet + ACT;
        L.sparks = []; L.ghosts = []; L.beeped = false; L.ended = false;
        L.res.textContent = '…'; L.res.className = 'lane-result'; L.margin = 0;
        buildTimeline(L);
      }
      $$('[data-score]', wrap).forEach(el => { if (el.dataset.score !== 'lead-m') el.textContent = '…'; });
      score('lead-m').textContent = tr('distance driven before the frame camera reacts', 'distance parcourue avant que la caméra à images réagisse');
      verdict.classList.remove('show');
      $('.fps-v', wrap).textContent = fps;
    }
    // front bumper position; the child appears (t = 0) when it is D metres ahead
    const carFront = (L, tt) => {
      const x0 = XC - D;
      if (tt <= L.tBrake) return x0 + v() * tt;
      const tau = Math.min(tt - L.tBrake, v() / DEC);
      return x0 + v() * L.tBrake + v() * tau - DEC * tau * tau / 2;
    };
    const stopTime = (L) => L.tBrake + v() / DEC;
    const childY = (tt) => tt < 0 ? CHILD_Y0 : Math.max(CHILD_STOP, CHILD_Y0 - CHILD_V * tt);

    const AX = 0.4; // timeline spans 0 / 400 ms
    function buildTimeline(L) {
      const pct = (x) => Math.min(100, x / AX * 100);
      let html = L.tDet / AX < 0.15 ? `<span class="mk" style="left:0"></span>` : `<span class="mk" style="left:0"><b>0 ms</b>${tr('child appears', 'l’enfant apparaît')}</span>`;
      if (L.kind === 'frame') {
        for (let k = 0; phase + k / fps < AX; k++) html += `<i class="tick" style="left:${pct(phase + k / fps)}%"></i>`;
      }
      const lab = (x, cls, title, sub) => `<span class="mk ${cls} ${x / AX > 0.72 ? 'flip' : ''}" data-at="${x}" style="left:${pct(x)}%;opacity:0"><b>${title}</b>${sub}</span>`;
      html += lab(L.tDet, 'det', `+${Math.round(L.tDet * 1000)} ms`, tr('detected', 'détecté'));
      html += lab(L.tBrake, 'brk', `+${Math.round(L.tBrake * 1000)} ms`, tr('brakes', 'freine'));
      L.tl.innerHTML = html;
    }

    function size(L) {
      const r = L.cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      L.cv.width = Math.round(r.width * dpr); L.cv.height = Math.round(r.height * dpr);
    }
    lanes.forEach(size);
    addEventListener('resize', () => lanes.forEach(size));

    function roundRect(c, x, y, w, h, r) {
      c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
    }
    function cone(c, X, Y, x, y, a, col) {
      c.globalAlpha = a; c.fillStyle = col;
      c.beginPath(); c.moveTo(X(x), Y(y)); c.lineTo(X(x + 14), Y(y - 3.2)); c.lineTo(X(x + 14), Y(y + 3.4)); c.closePath(); c.fill();
      c.globalAlpha = 1;
    }

    function draw(L) {
      const c = L.ctx, W = L.cv.width, H = L.cv.height;
      const k = Math.min(W / VIEW_W, H / VIEW_H);
      const ox = -VIEW_X0 * k + (W - VIEW_W * k) / 2, oy = -VIEW_Y0 * k + (H - VIEW_H * k) / 2;
      const X = (x) => ox + x * k, Y = (y) => oy + y * k;
      c.clearRect(0, 0, W, H);
      // road and markings
      c.fillStyle = palette.bg2; c.fillRect(0, Y(1.2), W, 7 * k);
      c.strokeStyle = palette.line; c.lineWidth = Math.max(1, k * 0.08);
      c.setLineDash([k * 2, k * 1.6]); c.beginPath(); c.moveTo(0, Y(4.7)); c.lineTo(W, Y(4.7)); c.stroke(); c.setLineDash([]);
      c.beginPath(); c.moveTo(0, Y(8.2)); c.lineTo(W, Y(8.2)); c.stroke();
      // parked van hiding the child
      c.fillStyle = palette.ink3; roundRect(c, X(XC - 6), Y(8.45), 5.2 * k, 1.9 * k, k * 0.3); c.fill();
      // child's path
      c.strokeStyle = palette.on; c.globalAlpha = 0.35; c.setLineDash([k * 0.3, k * 0.3]);
      c.beginPath(); c.moveTo(X(XC), Y(CHILD_Y0)); c.lineTo(X(XC), Y(4.9)); c.stroke(); c.setLineDash([]); c.globalAlpha = 1;

      const cy = childY(t), fx = carFront(L, t), braking = t > L.tBrake;
      if (L.kind === 'frame') {
        // the field of view "strobes" once per captured frame
        const period = 1 / fps, since = ((t - phase) % period + period) % period;
        cone(c, X, Y, fx, LANE_Y, 0.05 + 0.22 * Math.max(0, 1 - since / (period * 0.5)), palette.ink3);
        // what the frames actually captured: a few blurred snapshots
        for (const g of L.ghosts) {
          c.globalAlpha = g.a; c.fillStyle = palette.ink;
          c.beginPath(); c.ellipse(X(XC), Y(g.y + g.blur / 2), k * 0.32, k * (0.32 + g.blur / 2), 0, 0, 7); c.fill();
        }
        c.globalAlpha = 1;
      } else {
        cone(c, X, Y, fx, LANE_Y, 0.07, palette.off);
        for (const p of L.sparks) {
          c.globalAlpha = Math.max(0, p.life); c.fillStyle = p.on ? palette.on : palette.off;
          c.fillRect(X(p.x) - k * 0.09, Y(p.y) - k * 0.09, k * 0.18, k * 0.18);
        }
        c.globalAlpha = 1;
      }
      // sensor status, written above the car from the moment the child appears
      if (t >= 0) {
        const seen = t >= L.tDet;
        c.font = `500 ${Math.max(11 * (W / L.cv.clientWidth), k * 0.62)}px "Geist Mono", ui-monospace, monospace`;
        c.textBaseline = 'bottom'; c.textAlign = 'left';
        c.fillStyle = seen ? (L.kind === 'event' ? palette.off : palette.ink) : palette.on;
        const label = seen ? `${tr('CHILD DETECTED', 'ENFANT DÉTECTÉ')} ${ms(L.tDet)}` : tr('CHILD NOT DETECTED YET', 'ENFANT PAS ENCORE DÉTECTÉ');
        // keep the whole label inside the canvas, also on a phone
        c.fillText(label, Math.min(Math.max(X(fx - 4.5), k * 0.5), W - c.measureText(label).width - k * 0.5), Y(LANE_Y - 1.25));
      }
      // car
      const len = 4.5, wid = 1.85;
      c.fillStyle = palette.ink; roundRect(c, X(fx - len), Y(LANE_Y - wid / 2), len * k, wid * k, k * 0.45); c.fill();
      c.fillStyle = palette.bg; c.globalAlpha = 0.25; roundRect(c, X(fx - 1.9), Y(LANE_Y - wid / 2 + 0.2), 0.9 * k, (wid - 0.4) * k, k * 0.2); c.fill(); c.globalAlpha = 1;
      c.fillStyle = braking && !L.ended ? '#ff3b2f' : palette.ink3;
      c.fillRect(X(fx - len) - k * 0.05, Y(LANE_Y - wid / 2 + 0.15), k * 0.18, k * 0.4);
      c.fillRect(X(fx - len) - k * 0.05, Y(LANE_Y + wid / 2 - 0.55), k * 0.18, k * 0.4);
      c.fillStyle = L.kind === 'event' ? palette.off : palette.bg;
      c.beginPath(); c.arc(X(fx - 0.25), Y(LANE_Y), k * 0.16, 0, 7); c.fill();
      if (t >= L.tDet && !L.ended) {
        c.strokeStyle = L.kind === 'event' ? palette.off : palette.on;
        c.lineWidth = Math.max(1.5, k * 0.08);
        c.beginPath();
        c.arc(X(fx), Y(LANE_Y), k * (0.45 + 0.25 * Math.sin((t - L.tDet) * 25)), 0, 7);
        c.stroke();
      }
      // child (faint while hidden behind the van)
      c.globalAlpha = t >= 0 ? 1 : 0.3; c.fillStyle = palette.on;
      c.beginPath(); c.arc(X(XC), Y(cy), k * 0.34, 0, 7); c.fill(); c.globalAlpha = 1;
      if (L.ended && L.res.classList.contains('bad')) {
        c.strokeStyle = palette.on; c.lineWidth = Math.max(1.5, k * 0.1);
        c.beginPath(); c.arc(X(XC), Y(cy), k * (0.8 + 0.15 * Math.sin(performance.now() / 120)), 0, 7); c.stroke();
      }
    }

    function update(dtReal) {
      const prev = t;
      if (playing) t += dtReal / 1000 * speed;
      for (const L of lanes) {
        if (L.kind === 'frame') {
          const period = 1 / fps;
          for (let kf = Math.ceil((prev - phase) / period), tc = phase + kf * period; tc <= t && playing; kf++, tc = phase + kf * period) {
            if (tc < 0 || tc <= prev) continue;
            const moving = childY(tc) > CHILD_STOP;
            L.ghosts.push({ y: childY(tc), blur: moving ? CHILD_V * period * 0.8 : 0, a: 0.5 });
            if (L.ghosts.length > 4) L.ghosts.shift();
          }
          L.ghosts.forEach((g, i) => { g.a = 0.12 + 0.12 * i; });
        } else if (playing && t >= 0 && childY(t) > CHILD_STOP) {
          const y = childY(t);
          for (let n = 0; n < 7; n++) {
            const lead = Math.random() < 0.55;
            L.sparks.push({ x: XC + (Math.random() - 0.5) * 0.7, y: y + (lead ? -0.3 : 0.3) + (Math.random() - 0.5) * 0.25, on: lead, life: 1 });
          }
        }
        for (const p of L.sparks) p.life -= dtReal / 450;
        L.sparks = L.sparks.filter(p => p.life > 0);

        if (!L.beeped && t >= L.tDet) {
          L.beeped = true;
          silent || Sound.blip(L.kind === 'event' ? 1760 : 1100, 0.08, 0.035);
          score(L.kind).textContent = ms(L.tDet);
          if (L.kind === 'frame') {
            const lead = L.tDet - laneOf('event').tDet;
            score('lead').textContent = `${Math.round(lead * 1000)} ms`;
            score('lead-m').textContent = tr(`${f1((v() * lead))} m driven at ${kmh} km/h before the frame camera reacts`, `${f1((v() * lead))} m parcourus à ${kmh} km/h avant que la caméra à images réagisse`);
          }
        }
        $$('.mk[data-at]', L.tl).forEach(m => { m.style.opacity = t >= +m.dataset.at ? 1 : 0; });
        if (!L.ended && t >= stopTime(L)) {
          L.ended = true;
          const margin = L.margin = (XC - 0.34) - carFront(L, t);
          if (margin >= 0) { L.res.textContent = tr(`Stops ${f1(margin)} m short`, `S’arrête ${f1(margin)} m avant`); L.res.className = 'lane-result good'; }
          else { L.res.textContent = tr(`Reaches the child · ${f1((-margin))} m overrun`, `Atteint l’enfant · ${f1((-margin))} m de dépassement`); L.res.className = 'lane-result bad'; silent || Sound.blip(180, 0.25, 0.05, 'sawtooth'); }
        }
      }
      if (lanes.every(L => L.ended) && t > Math.max(...lanes.map(stopTime)) + 0.6) {
        playing = false;
        if (!verdict.classList.contains('show')) {
          const ev = laneOf('event'), fr = laneOf('frame');
          const lead = fr.tDet - ev.tDet;
          const outcome = ev.margin >= 0 && fr.margin < 0 ? tr('The car with the event camera stops in time, the car with the frame camera does not.', 'La voiture à caméra événementielle s’arrête à temps, celle à caméra à images non.')
            : ev.margin >= 0 ? tr(`Both cars stop in time, the one with the event camera ${f1((ev.margin - fr.margin))} m earlier.`, `Les deux voitures s’arrêtent à temps, celle à caméra événementielle ${f1((ev.margin - fr.margin))} m plus tôt.`)
            : tr('At this speed neither car stops in time.', 'À cette vitesse, aucune des deux voitures ne s’arrête à temps.');
          const ms0 = Math.round(lead * 1000), m0 = f1(v() * lead);
          verdict.innerHTML = tr(`<strong>Result.</strong> The event camera detected the child <strong>${ms0} ms before</strong> the frame camera, which is ${m0} m of road at ${kmh} km/h. ${outcome}`,
            `<strong>Résultat.</strong> La caméra événementielle a détecté l’enfant <strong>${ms0} ms avant</strong> la caméra à images, soit ${m0} m de route à ${kmh} km/h. ${outcome}`);
          verdict.classList.add('show');
        }
      }
    }

    function replay() { t = -PRE; playing = true; setPaused(false); plan(); }

    // playback: pause, speed and a time bar; seeking replays the same run without sound
    const pauseBtn = $('#road-pause'), scrub = $('#road-scrub'), clockEl = $('#road-clock');
    const endT = () => Math.max(...lanes.map(stopTime)) + 0.6;
    function setPaused(p) {
      paused = p;
      pauseBtn.textContent = p ? tr('Play', 'Lecture') : tr('Pause', 'Pause');
      pauseBtn.setAttribute('aria-pressed', String(p));
    }
    function seek(target) {
      t = -PRE; playing = true; plan(true); silent = true;
      while (playing && t < target) update(16);
      silent = false;
    }
    function syncTransport() {
      if (!paused) scrub.value = Math.round((t + PRE) / (endT() + PRE) * 1000);
      clockEl.textContent = t < 0 ? tr('child hidden', 'enfant caché') : `+${Math.round(t * 1000)} ms`;
    }
    pauseBtn.addEventListener('click', () => {
      if (!playing) { replay(); return; } // finished: play again from the start
      setPaused(!paused);
    });
    scrub.addEventListener('input', () => { setPaused(true); seek(scrub.value / 1000 * (endT() + PRE) - PRE); });
    $$('[data-rate]', wrap).forEach(b => b.addEventListener('click', () => {
      speed = +b.dataset.rate; $$('[data-rate]', wrap).forEach(x => x.setAttribute('aria-selected', String(x === b)));
    }));
    $('#road-play').addEventListener('click', replay);
    $$('[data-speed]', wrap).forEach(b => b.addEventListener('click', () => {
      kmh = +b.dataset.speed; $$('[data-speed]', wrap).forEach(x => x.setAttribute('aria-selected', String(x === b))); replay();
    }));
    $$('[data-fps]', wrap).forEach(b => b.addEventListener('click', () => {
      fps = +b.dataset.fps; $$('[data-fps]', wrap).forEach(x => x.setAttribute('aria-selected', String(x === b))); replay();
    }));

    plan();
    runWhenVisible(wrap, (now, dt) => {
      if (!started) { started = true; replay(); }
      if (!paused) update(dt);
      lanes.forEach(draw);
      syncTransport();
    });
  })();


  /* ---------- One pixel: when does it fire an event? ----------
     Same rule as the hero simulator: compare with the level of the last event,
     fire when the change passes the threshold C, then move the memory. */
  (function pixelDemo() {
    const cv = $('#px-cv'); if (!cv) return;
    const ctx = cv.getContext('2d'), slider = $('#px-c'), cOut = $('#px-c-v');
    const N = 60; // camera frames across the plot
    const ease = (u, a, b) => { const x = Math.min(1, Math.max(0, (u - a) / (b - a))); return x * x * (3 - 2 * x); };
    // an edge passes the pixel (brighter), small flicker, then a shadow (darker)
    const sig = (u) => 0.28 + 0.46 * ease(u, 0.16, 0.3)
      + 0.035 * Math.sin(u * 90) * ease(u, 0.32, 0.36) * (1 - ease(u, 0.5, 0.54))
      - 0.38 * ease(u, 0.58, 0.72);
    const C = () => +slider.value * 0.05;
    slider.addEventListener('input', () => { cOut.textContent = C().toFixed(2).replace('.', fr_ ? ',' : '.'); });
    slider.dispatchEvent(new Event('input'));

    function run(c, upTo) {
      let mem = sig(0); const memAt = [mem], ev = [];
      for (let i = 1; i <= upTo; i++) {
        const d = sig(i / N) - mem, k = Math.floor(Math.abs(d) / c);
        for (let j = 0; j < k; j++) ev.push({ i, p: d > 0 ? 1 : -1, j });
        mem += Math.sign(d) * k * c; memAt.push(mem);
      }
      return { ev, memAt };
    }

    function draw(now) {
      const dpr = Math.min(devicePixelRatio || 1, 2), w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const W = cv.width, H = cv.height, c = C(), upTo = Math.floor(now * N);
      const { ev, memAt } = run(c, upTo);
      const fs = 11 * dpr, x0 = 14 * dpr, x1 = W - 14 * dpr;
      const yT = fs * 2.6, yB = H * 0.64, laneY = H * 0.84;
      const X = (u) => x0 + u * (x1 - x0), Y = (v) => yB - v * (yB - yT);
      ctx.clearRect(0, 0, W, H);
      ctx.font = `500 ${fs}px "Geist Mono", ui-monospace, monospace`;
      ctx.fillStyle = palette.ink3; ctx.textAlign = 'left';
      ctx.fillText(tr('BRIGHTNESS OF ONE PIXEL', 'LUMINOSITÉ D’UN PIXEL'), x0, fs * 1.4);
      ctx.fillText(tr('EVENTS', 'ÉVÉNEMENTS'), x0, laneY - 20 * dpr);
      // threshold band around the current memory
      const m = memAt[memAt.length - 1], xn = X(upTo / N);
      ctx.fillStyle = palette.bg2; ctx.fillRect(xn, Y(m + c), x1 - xn, Y(m - c) - Y(m + c));
      ctx.setLineDash([4 * dpr, 4 * dpr]); ctx.strokeStyle = palette.line; ctx.lineWidth = dpr;
      for (const v of [m + c, m - c]) { ctx.beginPath(); ctx.moveTo(xn, Y(v)); ctx.lineTo(x1, Y(v)); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.fillStyle = palette.ink3; ctx.textAlign = 'right';
      ctx.fillText(tr('threshold ±C', 'seuil ±C'), x1, Y(m + c) - 4 * dpr);
      ctx.textAlign = 'left';
      // the signal still to come, faint
      ctx.strokeStyle = palette.line; ctx.lineWidth = 1.5 * dpr; ctx.beginPath();
      for (let k = 0; k <= 200; k++) { const u = k / 200; if (k) ctx.lineTo(X(u), Y(sig(u))); else ctx.moveTo(X(u), Y(sig(u))); }
      ctx.stroke();
      // memory: a staircase that only moves when an event fires
      ctx.strokeStyle = palette.ink3; ctx.lineWidth = 2 * dpr; ctx.beginPath();
      ctx.moveTo(X(0), Y(memAt[0]));
      for (let i = 1; i < memAt.length; i++) { ctx.lineTo(X(i / N), Y(memAt[i - 1])); ctx.lineTo(X(i / N), Y(memAt[i])); }
      ctx.lineTo(xn, Y(m)); ctx.stroke();
      // what the camera actually sampled, one dot per frame
      ctx.strokeStyle = palette.ink; ctx.lineWidth = 2 * dpr; ctx.beginPath();
      for (let i = 0; i <= upTo; i++) { if (i) ctx.lineTo(X(i / N), Y(sig(i / N))); else ctx.moveTo(X(0), Y(sig(0))); }
      ctx.stroke();
      ctx.fillStyle = palette.ink;
      for (let i = 0; i <= upTo; i++) { ctx.beginPath(); ctx.arc(X(i / N), Y(sig(i / N)), 2 * dpr, 0, 7); ctx.fill(); }
      // event lane: ON up in red, OFF down in blue, side by side when one frame fires several
      ctx.strokeStyle = palette.line; ctx.lineWidth = dpr; ctx.beginPath(); ctx.moveTo(x0, laneY); ctx.lineTo(x1, laneY); ctx.stroke();
      const hh = 14 * dpr;
      for (const e of ev) {
        ctx.fillStyle = e.p > 0 ? palette.on : palette.off;
        ctx.fillRect(X(e.i / N) + e.j * 4 * dpr - 1.5 * dpr, e.p > 0 ? laneY - hh : laneY, 3 * dpr, hh);
        ctx.globalAlpha = 0.25; ctx.fillRect(X(e.i / N) - dpr / 2, Y(memAt[e.i]), dpr, laneY - Y(memAt[e.i])); ctx.globalAlpha = 1;
      }
      const on = ev.filter(e => e.p > 0).length;
      ctx.fillStyle = palette.ink; ctx.textAlign = 'right';
      ctx.fillText(`${on} ON · ${ev.length - on} OFF`, x1, fs * 1.4);
      ctx.textAlign = 'left';
    }

    const CYCLE = 7000, HOLD = 1800;
    runWhenVisible(cv, (time) => {
      draw(reduced ? 1 : Math.min(1, (time % (CYCLE + HOLD)) / CYCLE));
    });
  })();


  /* ---------- Camera T-1: rotating 3D model next to the title ----------
     The case is rebuilt in code from the current CAD screenshots and drawing
     (rounded body, grip with finger swoop, two-step lens, knurled dial, top
     slots, back screen), in millimetres. three.js loads only when the chapter
     gets close. */
  (function t1Model() {
    const box = $('#t1-model'); if (!box) return;
    const canvas = $('canvas', box);
    const near = new IntersectionObserver(([en]) => {
      if (en.isIntersecting) { near.disconnect(); start(); }
    }, { rootMargin: '600px 0px' });
    near.observe(box);

    // Smooth normals across soft curves, keep hard edges sharper than `deg` degrees.
    function crease(THREE, geo, deg = 38) {
      if (geo.index) geo = geo.toNonIndexed();
      const p = geo.attributes.position.array, nc = p.length / 3, nf = nc / 3, cosC = Math.cos(deg * Math.PI / 180);
      const fn = new Float32Array(nf * 3), fa = new Float32Array(nf), out = new Float32Array(p.length);
      for (let f = 0; f < nf; f++) {
        const o = f * 9;
        const ux = p[o + 3] - p[o], uy = p[o + 4] - p[o + 1], uz = p[o + 5] - p[o + 2];
        const vx = p[o + 6] - p[o], vy = p[o + 7] - p[o + 1], vz = p[o + 8] - p[o + 2];
        const x = uy * vz - uz * vy, y = uz * vx - ux * vz, z = ux * vy - uy * vx, l = Math.hypot(x, y, z);
        fa[f] = l; if (l > 0) { fn[f * 3] = x / l; fn[f * 3 + 1] = y / l; fn[f * 3 + 2] = z / l; }
      }
      const groups = new Map();
      for (let c = 0; c < nc; c++) {
        const k = `${Math.round(p[c * 3] * 1e3)},${Math.round(p[c * 3 + 1] * 1e3)},${Math.round(p[c * 3 + 2] * 1e3)}`;
        let g = groups.get(k); if (!g) groups.set(k, g = []); g.push(c);
      }
      for (const g of groups.values()) for (const c of g) {
        const f = (c / 3) | 0; let x = 0, y = 0, z = 0;
        for (const c2 of g) {
          const f2 = (c2 / 3) | 0;
          if (fn[f * 3] * fn[f2 * 3] + fn[f * 3 + 1] * fn[f2 * 3 + 1] + fn[f * 3 + 2] * fn[f2 * 3 + 2] >= cosC) {
            x += fn[f2 * 3] * fa[f2]; y += fn[f2 * 3 + 1] * fa[f2]; z += fn[f2 * 3 + 2] * fa[f2];
          }
        }
        const l = Math.hypot(x, y, z) || 1; out[c * 3] = x / l; out[c * 3 + 1] = y / l; out[c * 3 + 2] = z / l;
      }
      geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
      return geo;
    }

    function buildCamera(THREE) {
      // millimetres, measured from the CAD top and side views; front faces +z, grip on the left seen from the front
      const W = 120, H = 69, D = 26.6, GD = 41.9;   // body, and total depth at the grip
      const zB = -D / 2, zF = D / 2, xE = -W / 2;
      const shell = new THREE.MeshStandardMaterial({ roughness: 0.56, metalness: 0.02 });
      const panel = new THREE.MeshStandardMaterial({ color: 0x1f1b1a, roughness: 0.42, metalness: 0.04 });
      const hole = new THREE.MeshBasicMaterial({ color: 0x060505 });
      const cam = new THREE.Group();
      const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); cam.add(m); return m; };
      // extrude a 2D outline with a rounded bevel; `bev` is added outside the outline
      const extrude = (shape, depth, bev, deg = 38) => {
        const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.01, depth - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 7, curveSegments: 18 });
        geo.translate(0, 0, -Math.max(0.01, depth - 2 * bev) / 2);
        return crease(THREE, geo, deg);
      };
      const rrect = (w, h, r) => {
        const s = new THREE.Shape(), x = w / 2 - r, y = h / 2 - r;
        s.absarc(x, y, r, 0, Math.PI / 2); s.absarc(-x, y, r, Math.PI / 2, Math.PI);
        s.absarc(-x, -y, r, Math.PI, 1.5 * Math.PI); s.absarc(x, -y, r, 1.5 * Math.PI, 2 * Math.PI);
        return s;
      };

      // body
      add(extrude(rrect(W - 12, H - 12, 2.5), D, 6), shell);

      // grip: the lobe seen from above (round outer corner, S-curve back into the body front),
      // lofted over the height with rounded top and bottom edges, and cut back along the
      // finger scoop so the bottom 10 mm is flush with the body, as in the side view
      {
        const zIn = zB + 4, tipX = xE + 17, tipZ = zB + GD, rb = 8.5, e = 0.15; // rb matches the body's corner radius // e keeps hidden faces just inside the body
        const plan = new THREE.Path();
        plan.moveTo(xE + 8, zIn);                                                         // hidden part, kept inside the body's rounded back edge
        plan.quadraticCurveTo(xE + 2, zIn + 0.5, xE + e, zIn + 6);
        plan.lineTo(xE + e, 0.5);
        plan.bezierCurveTo(xE + e, 14, xE + 6, tipZ, tipX, tipZ);                         // outer rounded corner
        plan.bezierCurveTo(tipX + 5.5, tipZ, tipX + 8.5, tipZ - 6, xE + 27, zF + 3.5);    // steep inner side
        plan.bezierCurveTo(xE + 28.3, zF + 1.3, xE + 29.8, zF - 0.3, xE + 32, zF - 0.3);  // eases into the body front
        plan.lineTo(xE + 44, zF - 0.3);
        plan.lineTo(xE + 44, zIn); plan.lineTo(xE + 8, zIn);
        const N = 240, ring = plan.getSpacedPoints(N).slice(0, N);                      // (x, z) around the outline
        // outward 2D normals, to pull the outline in where the top and bottom edges round over
        let area = 0;
        for (let i = 0; i < N; i++) { const a = ring[i], b = ring[(i + 1) % N]; area += a.x * b.y - b.x * a.y; }
        const sgn = area > 0 ? 1 : -1;
        const nrm = ring.map((p, i) => {
          const a = ring[(i + N - 1) % N], b = ring[(i + 1) % N], dx = b.x - a.x, dz = b.y - a.y, l = Math.hypot(dx, dz) || 1;
          return [sgn * dz / l, -sgn * dx / l];
        });
        // rows over the height: rounded bottom, the scoop transition, straight middle, rounded top
        const yBot = -H / 2 + e, yTop = H / 2 - e, yA = yBot + 30, yS = yBot + 10, rows = [];
        for (let k = 0; k <= 6; k++) { const f = Math.PI / 2 * (1 - k / 6); rows.push([yBot + rb - rb * Math.sin(f), rb * (1 - Math.cos(f))]); }
        for (let k = 1; k <= 40; k++) rows.push([yBot + rb + (yA + 4 - yBot - rb) * k / 40, 0]);
        for (let k = 1; k <= 4; k++) rows.push([yA + 4 + (yTop - rb - yA - 4) * k / 4, 0]);
        for (let k = 1; k <= 6; k++) { const f = Math.PI / 2 * k / 6; rows.push([yTop - rb + rb * Math.sin(f), rb * (1 - Math.cos(f))]); }
        const front = (y) => { // how far forward the grip reaches at height y
          const t = Math.min(1, Math.max(0, (y - yS) / (yA - yS))), s = t * t * (3 - 2 * t);
          return zF - 7 + (tipZ - zF + 7) * s;
        };
        const pos = [];
        for (const [y, off] of rows) {
          const lim = front(y);
          ring.forEach((p, i) => pos.push(p.x - nrm[i][0] * off, y, Math.min(p.y - nrm[i][1] * off, lim)));
        }
        const idx = [], R = rows.length, P = (k) => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);
        for (let r = 0; r < R - 1; r++) for (let i = 0; i < N; i++) {
          const a = r * N + i, b = r * N + (i + 1) % N, c = a + N, d = b + N;
          idx.push(a, b, d, a, d, c);
        }
        // walls must face outward: test the quads of a full-depth row against the row centre
        const rr = R - 8, ctr = new THREE.Vector3();
        for (let i = 0; i < N; i++) ctr.add(P(rr * N + i));
        ctr.divideScalar(N);
        let facing = 0;
        for (let i = 0; i < N; i++) {
          const a = P(rr * N + i), b = P(rr * N + (i + 1) % N), d = P((rr + 1) * N + (i + 1) % N);
          facing += b.clone().sub(a).cross(d.clone().sub(a)).dot(a.clone().sub(ctr));
        }
        if (facing < 0) for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
        // caps: each triangle turned to face up (top) or down (bottom)
        const cap = (r, up) => {
          const pts = ring.map((_, i) => new THREE.Vector2(pos[(r * N + i) * 3], pos[(r * N + i) * 3 + 2]));
          for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(pts, [])) {
            const A = r * N + a, B = r * N + b, C = r * N + c;
            const ny = P(B).sub(P(A)).cross(P(C).sub(P(A))).y;
            idx.push(...((ny > 0) === up ? [A, B, C] : [A, C, B]));
          }
        };
        cap(0, false); cap(R - 1, true);
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        add(crease(THREE, g, 40), shell);
      }

      // lens: low flange blended into the body, barrel 47 mm across ending 21.5 mm out, ring line, dome button
      {
        const prof = [[27.5, -1], [27.5, 0.4], [27.1, 1.4], [26.3, 2.1], [25.2, 2.5], [24.2, 2.7], [23.6, 3.2], [23.4, 4],
          [23.4, 17.3], [23.08, 18.91], [22.17, 20.27], [20.81, 21.18], [19.2, 21.5], [16.4, 21.5], [16.1, 21.25], [15.8, 21.2],
          [6, 21.2], [5.67, 21.2], [5.02, 22.9], [4.1, 24.1], [2.9, 25.02], [1.5, 25.6], [0, 25.8]].map(([rr, z]) => new THREE.Vector2(rr, z));
        const lens = new THREE.LatheGeometry(prof, 72);
        lens.rotateX(Math.PI / 2);            // lathe axis y -> z (forward)
        add(crease(THREE, lens, 30), shell, 10, 0, zF);
      }

      // knurled dial on the front part of the grip top
      {
        const teeth = 16, gear = new THREE.Shape();
        for (let i = 0; i <= teeth * 2; i++) {
          const a = i / (teeth * 2) * Math.PI * 2, rr = i % 2 ? 2.35 : 2.85;
          if (i) gear.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else gear.moveTo(rr, 0);
        }
        const dial = new THREE.ExtrudeGeometry(gear, { depth: 5.6, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.2, bevelSegments: 2 });
        dial.rotateX(-Math.PI / 2);
        const x = xE + 14.7, z = zB + 29.5, y = H / 2;
        add(crease(THREE, dial, 50), shell, x, y + 1.9, z);
        add(crease(THREE, new THREE.CylinderGeometry(1.7, 1.7, 2, 24)), shell, x, y + 0.9, z);
      }

      // two slots on the top: one across, one running front to back next to the grip
      add(new THREE.BoxGeometry(10.7, 0.6, 6.4), hole, xE + 47.8, H / 2 + 0.05, zB + 20.2);
      add(new THREE.BoxGeometry(6.4, 0.6, 12.8), hole, xE + 29.5, H / 2 + 0.05, zB + 13.8);

      // back: framed screen at the end away from the grip, flat space between it and the grip
      add(new THREE.BoxGeometry(74, 51, 0.5), hole, 15, -1, zB - 0.1);        // thin dark gap around the panel
      add(extrude(rrect(72, 49, 1.2), 1.4, 0.4, 50), panel, 15, -1, zB - 0.45);
      return cam;
    }

    async function start() {
      let THREE;
      try { THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js'); }
      catch (e) { box.remove(); return; } // no model beats a broken box

      let renderer;
      try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' }); }
      catch (e) { box.remove(); return; } // no WebGL
      renderer.setClearColor(0x000000, 0); // transparent: the page background shows through in both themes

      const model = buildCamera(THREE), size = 130;
      const spin = new THREE.Group(); spin.add(model);
      const scene = new THREE.Scene(); scene.add(spin);
      const shell = model.children[0].material;

      const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
      const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-1.1, 1.5, 1.5);
      const rim = new THREE.DirectionalLight(0xffffff, 2); rim.position.set(1.6, 0.9, -1.4);
      const top = new THREE.DirectionalLight(0xffffff, 0.8); top.position.set(0.3, 2, 0.2);
      scene.add(hemi, key, rim, top);

      const cam = new THREE.PerspectiveCamera(26, 1, size * 0.1, size * 20);
      cam.position.set(0, size * 0.5, size * 2.45); cam.lookAt(0, size * 0.03, 0);

      // the case is dark brown in the CAD render; lights adapt so it reads on both page colours
      let themeDark = null;
      function syncTheme() {
        const d = isDark(); if (d === themeDark) return; themeDark = d;
        shell.color.set(d ? '#3a3330' : '#2e2826');
        hemi.color.set(d ? '#fff3e4' : '#ffffff'); hemi.groundColor.set(d ? '#1c1a18' : '#b8b2a6');
        hemi.intensity = d ? 1.5 : 1.2;
        key.intensity = d ? 2.8 : 2.4; rim.intensity = d ? 3.2 : 1.6; rim.color.set(d ? '#ffe9d2' : '#ffffff');
      }

      // slow turn, drag to spin with a little inertia; reduced motion keeps a still 3/4 view
      let yaw = -0.6, vel = 0, drag = null; // front three-quarter view, as in the CAD render
      canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, t: performance.now() }; canvas.setPointerCapture(e.pointerId); });
      canvas.addEventListener('pointermove', (e) => {
        if (!drag) return;
        const now = performance.now(), dx = e.clientX - drag.x;
        yaw += dx * 0.012; vel = dx * 0.012 / Math.max(1, now - drag.t) * 16; drag = { x: e.clientX, t: now };
      });
      const release = () => { drag = null; };
      canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release);

      function resize() {
        const w = canvas.clientWidth, h = canvas.clientHeight;
        const dpr = Math.min(devicePixelRatio || 1, 2);
        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          renderer.setPixelRatio(dpr); renderer.setSize(w, h, false);
          cam.aspect = w / h;
          cam.zoom = Math.min(1, cam.aspect / 1.15); // keep the whole case in view in narrow boxes
          cam.updateProjectionMatrix();
        }
      }

      runWhenVisible(box, (now, dt) => {
        syncTheme(); resize();
        if (!drag) { vel *= 0.94; yaw += vel + (reduced ? 0 : dt * 0.00035); }
        spin.rotation.y = yaw;
        spin.position.y = reduced ? 0 : Math.sin(now / 1600) * size * 0.012;
        renderer.render(scene, cam);
        if (!canvas.classList.contains('ready')) { canvas.classList.add('ready'); box.classList.add('ready'); }
      });
    }
  })();

  /* ---------- Resize ---------- */
  let rz;
  addEventListener('resize', () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      heroSim.resize();
    }, 150);
  });

  /* ---------- Lite YouTube ----------
     YouTube refuses to play an embed without an HTTP origin (error 153 when the
     page is opened as a local file), so there the link just opens YouTube. */
  const canEmbed = /^https?:$/.test(location.protocol);
  $$('a.yt').forEach(a => a.addEventListener('click', (e) => {
    if (!canEmbed) return;
    e.preventDefault();
    const f = document.createElement('iframe');
    f.src = `https://www.youtube-nocookie.com/embed/${a.dataset.id}?autoplay=1&rel=0`;
    f.title = a.dataset.title || 'YouTube video';
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    f.referrerPolicy = 'strict-origin-when-cross-origin';
    f.allowFullscreen = true;
    f.className = 'yt-frame';
    a.replaceWith(f);
  }));

  /* ---------- Email copy ---------- */
  const toast = $('#toast');
  function showToast(msg) {
    toast.textContent = msg; toast.classList.add('show');
    clearTimeout(showToast.t); showToast.t = setTimeout(() => toast.classList.remove('show'), 1800);
  }
  $('#email').addEventListener('click', async (e) => {
    const addr = e.currentTarget.dataset.email;
    Sound.shutter();
    try { await navigator.clipboard.writeText(addr); showToast(tr('Copied ', 'Copié ') + addr); }
    catch { location.href = 'mailto:' + addr; }
  });

  /* Camera T-1 shutter on its hero image */
  $('#t1 .bleed').addEventListener('pointerdown', () => Sound.shutter());

  /* ---------- Floating Next Navigation ---------- */
  const floatingNav = $('#floating-nav');
  const floatingBtn = $('#floating-next-btn');
  const floatingLabel = $('#floating-next-label');
  const flowSections = [
    { id: 'top', nextId: 't1', label: 'Camera T-1' },
    { id: 'work', nextId: 't1', label: 'Camera T-1' },
    { id: 't1', nextId: 'r2e', label: 'Raw2Event' },
    { id: 'r2e', nextId: 'lab', label: tr('Lab', 'Labo') },
    { id: 'lab', nextId: 'about', label: tr('About', 'À propos') },
    { id: 'about', nextId: 'contact', label: 'Contact' },
    { id: 'contact', nextId: 'top', label: tr('Back to top', 'Haut de page') }
  ];

  function updateFloatingNav() {
    if (!floatingNav || !floatingBtn) return;
    const scrollPos = window.scrollY + window.innerHeight * 0.45;
    let current = flowSections[0];
    for (const sec of flowSections) {
      const el = document.getElementById(sec.id);
      if (el && el.offsetTop <= scrollPos) {
        current = sec;
      }
    }
    if (floatingLabel) floatingLabel.textContent = current.label;
    floatingBtn.dataset.target = current.nextId;
    const isTopTarget = current.nextId === 'top';
    const svgIcon = $('.floating-icon svg path', floatingBtn);
    if (svgIcon) {
      svgIcon.setAttribute('d', isTopTarget ? 'M8 14V4m0 0L4 8m4-4l4 4' : 'M8 2v10m0 0l4-4m-4 4L4 8');
    }
  }

  floatingBtn?.addEventListener('click', () => {
    const targetId = floatingBtn.dataset.target || 't1';
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth' });
    }
  });

  // step aside while a chapter's own "next" button is on screen
  const nextRows = new Set();
  const nextObs = new IntersectionObserver((entries) => {
    for (const en of entries) { if (en.isIntersecting) nextRows.add(en.target); else nextRows.delete(en.target); }
    floatingNav.classList.toggle('hidden', nextRows.size > 0);
  });
  $$('.next-row').forEach(el => nextObs.observe(el));

  window.addEventListener('scroll', updateFloatingNav, { passive: true });
  updateFloatingNav();

})();
