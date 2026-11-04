/* Oscar Caux — portfolio
   No dependencies. Sections: storage, theme, sound, nav, reveal, index preview,
   DVS (event camera) simulator for the hero, road scenario, misc. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

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
    $('.label', themeBtn).textContent = isDark() ? 'Light' : 'Dark';
    themeBtn.setAttribute('aria-pressed', String(isDark()));
    themeBtn.setAttribute('aria-label', isDark() ? 'Switch to light mode' : 'Switch to dark mode');
  }
  syncThemeBtn();
  darkMq.addEventListener('change', syncThemeBtn);
  themeBtn.addEventListener('click', () => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    store.set('oc-theme', root.dataset.theme);
    readPalette(); syncThemeBtn();
  });

  /* ---------- Sound (WebAudio, synthesised — no files) ---------- */
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
    $('.label', soundBtn).textContent = on ? 'Sound on' : 'Sound off';
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
    $('.label', soundBtn).textContent = 'Sound: tap';
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
    cell: innerWidth < 700 ? 6 : 7, C: 0.16, decay: 420, noise: 0.00004, alpha: 0.85,
    scene(c, W, H) {
      c.fillStyle = '#b4b4b4'; c.fillRect(0, 0, W, H);
      const t = heroT / 1000, m = Math.min(W, H);
      // orbiting discs, mostly on the right half so the title stays calm
      const cx = W * 0.72, cy = H * 0.46;
      for (let k = 0; k < 3; k++) {
        const a = t * (0.35 + k * 0.17) + k * 2.1, rad = m * (0.18 + k * 0.1);
        c.fillStyle = k === 1 ? '#f4f4f4' : '#3a3a3a';
        c.beginPath(); c.arc(cx + Math.cos(a) * rad * 1.3, cy + Math.sin(a) * rad * 0.8, m * (0.05 + k * 0.018), 0, 7); c.fill();
      }
      // ring
      c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(1, m * 0.02);
      c.beginPath(); c.arc(cx, cy, m * (0.42 + Math.sin(t * 0.6) * 0.03), 0, 7); c.stroke();
      // your cursor
      if (pointer.inside) {
        pointer.sx += (pointer.x - pointer.sx) * 0.25; pointer.sy += (pointer.y - pointer.sy) * 0.25;
        c.fillStyle = '#1c1c1c';
        c.beginPath(); c.arc(pointer.sx * W, pointer.sy * H, m * 0.075, 0, 7); c.fill();
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
    const D = 15, ACT = 0.1, DEC = 7.5, EV_LAT = 0.01, INF = 0.05, SHARP = 2, SLOW = 0.3, PRE = 1.2;
    const XC = 0, VIEW_X0 = -23, VIEW_W = 30, VIEW_Y0 = 2.6, VIEW_H = 8.6;
    const LANE_Y = 6.45, CHILD_Y0 = 9.3, CHILD_STOP = 6.9, CHILD_V = 3;
    let kmh = 50, fps = 30, t = -PRE, playing = false, phase = 0, started = false;

    const lanes = $$('.road-lane', wrap).map(el => ({
      el, kind: el.dataset.lane, cv: $('canvas', el), tl: $('[data-tl]', el), res: $('[data-result]', el),
      ctx: $('canvas', el).getContext('2d'), sparks: [], ghosts: [], tDet: 0, tBrake: 0, beeped: false, ended: false,
    }));

    const v = () => kmh / 3.6;
    function plan() {
      const period = 1 / fps;
      phase = Math.random() * period;
      for (const L of lanes) {
        // frame path: wait for the next capture, then SHARP more frames to confirm, then inference
        L.tDet = L.kind === 'event' ? EV_LAT : phase + SHARP * period + INF;
        L.tBrake = L.tDet + ACT;
        L.sparks = []; L.ghosts = []; L.beeped = false; L.ended = false;
        L.res.textContent = '…'; L.res.className = 'lane-result';
        buildTimeline(L);
      }
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

    const AX = 0.4; // timeline spans 0–400 ms
    function buildTimeline(L) {
      const pct = (x) => Math.min(100, x / AX * 100);
      let html = L.tDet / AX < 0.15 ? `<span class="mk" style="left:0"></span>` : `<span class="mk" style="left:0"><b>0 ms</b>child appears</span>`;
      if (L.kind === 'frame') {
        for (let k = 0; phase + k / fps < AX; k++) html += `<i class="tick" style="left:${pct(phase + k / fps)}%"></i>`;
      }
      const lab = (x, cls, title, sub) => `<span class="mk ${cls} ${x / AX > 0.72 ? 'flip' : ''}" data-at="${x}" style="left:${pct(x)}%;opacity:0"><b>${title}</b>${sub}</span>`;
      html += lab(L.tDet, 'det', `+${Math.round(L.tDet * 1000)} ms`, 'detected');
      html += lab(L.tBrake, 'brk', `+${Math.round(L.tBrake * 1000)} ms`, 'brakes');
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
      // car
      const len = 4.5, wid = 1.85;
      c.fillStyle = palette.ink; roundRect(c, X(fx - len), Y(LANE_Y - wid / 2), len * k, wid * k, k * 0.45); c.fill();
      c.fillStyle = palette.bg; c.globalAlpha = 0.25; roundRect(c, X(fx - 1.9), Y(LANE_Y - wid / 2 + 0.2), 0.9 * k, (wid - 0.4) * k, k * 0.2); c.fill(); c.globalAlpha = 1;
      c.fillStyle = braking && !L.ended ? '#ff3b2f' : palette.ink3;
      c.fillRect(X(fx - len) - k * 0.05, Y(LANE_Y - wid / 2 + 0.15), k * 0.18, k * 0.4);
      c.fillRect(X(fx - len) - k * 0.05, Y(LANE_Y + wid / 2 - 0.55), k * 0.18, k * 0.4);
      c.fillStyle = L.kind === 'event' ? palette.off : palette.bg;
      c.beginPath(); c.arc(X(fx - 0.25), Y(LANE_Y), k * 0.16, 0, 7); c.fill();
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
      if (playing) t += dtReal / 1000 * SLOW;
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

        if (!L.beeped && t >= L.tDet) { L.beeped = true; Sound.blip(L.kind === 'event' ? 1760 : 1100, 0.08, 0.035); }
        $$('.mk[data-at]', L.tl).forEach(m => { m.style.opacity = t >= +m.dataset.at ? 1 : 0; });
        if (!L.ended && t >= stopTime(L)) {
          L.ended = true;
          const margin = (XC - 0.34) - carFront(L, t);
          if (margin >= 0) { L.res.textContent = `Stops ${margin.toFixed(1)} m short`; L.res.className = 'lane-result good'; }
          else { L.res.textContent = `Reaches the child · ${(-margin).toFixed(1)} m too far`; L.res.className = 'lane-result bad'; Sound.blip(180, 0.25, 0.05, 'sawtooth'); }
        }
      }
      if (lanes.every(L => L.ended) && t > Math.max(...lanes.map(stopTime)) + 1.2) playing = false;
    }

    function replay() { t = -PRE; playing = true; plan(); }
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
      update(dt);
      lanes.forEach(draw);
    });
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
    try { await navigator.clipboard.writeText(addr); showToast('Copied — ' + addr); }
    catch { location.href = 'mailto:' + addr; }
  });

  /* Camera T-1 shutter on its hero image */
  $('#t1 .bleed').addEventListener('pointerdown', () => Sound.shutter());
})();
