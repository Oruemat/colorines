// Pantallas, entrada táctil, deshacer, guardado y galería.
(function () {
  'use strict';
  const { S, K, M, makeCanvas, Scene, lineSVG, colorSVG } = ENGINE;
  const MS = M / S;
  const UNDO_STEPS = 8;
  const THUMB = 256;
  const SAVE_DELAY = 2500;
  const $ = (s) => document.querySelector(s);

  // ---------- Ajustes ----------
  const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch (_) { return {}; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* sin almacenamiento */ } };
  const settings = Object.assign({ left: false, clip: true, sound: true, voice: true }, readJSON('colorines.settings'));
  const ui = Object.assign({ cat: ART.categories[0].id }, readJSON('colorines.ui'));
  if (!ART.categories.some((c) => c.id === ui.cat)) ui.cat = ART.categories[0].id;

  const state = { tool: 'pencil', color: TOOLS.colors[0], sizeIdx: 1, sticker: TOOLS.stickers[0], hue: 0 };

  const stage = $('#stage');
  const paint = stage.querySelector('.paint');
  const stick = stage.querySelector('.stickers');
  const lines = stage.querySelector('.lines');
  const flash = stage.querySelector('.flash');
  const fx = stage.querySelector('.fx');
  const FX = 512;
  paint.width = paint.height = stick.width = stick.height = S;
  fx.width = fx.height = FX;
  const fctx = fx.getContext('2d');
  const pctx = paint.getContext('2d');
  const sctx = stick.getContext('2d');
  const seg = makeCanvas(S);
  const gctx = seg.getContext('2d');

  let scene = null;          // dibujo abierto
  let ready = false;         // progreso cargado; hasta entonces se ignora el dedo
  let stickersUsed = false;
  let dirty = false;
  let saveTimer = 0;
  let openToken = 0;
  const thumbs = new Map();  // id → URL de la miniatura del progreso

  const toBlob = (c, type = 'image/png', q) => new Promise((res) => c.toBlob(res, type, q));

  function svgImage(markup, size) {
    return new Promise((resolve, reject) => {
      const svg = markup.replace('<svg ', `<svg width="${size}" height="${size}" `);
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
      img.src = url;
    });
  }

  function button(cls, html, label) {
    const b = document.createElement('button');
    b.className = cls;
    b.innerHTML = html;
    if (label) b.setAttribute('aria-label', label);
    return b;
  }

  // ---------- Pantallas ----------
  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  }

  function route() {
    const h = decodeURIComponent(location.hash.slice(1));
    if (scene && h !== scene.drawing.id) {
      saveProgress();
      scene = null;
    }
    if (ART.byId[h]) {
      if (!scene) openDrawing(ART.byId[h]);
    } else if (h === 'galeria') {
      openGallery();
    } else {
      renderCards();
      show('home');
    }
  }

  // ---------- Inicio ----------
  function buildTabs() {
    const tabs = $('#tabs');
    for (const c of ART.categories) {
      const b = button('tab', `${c.icon}<span>${c.name}</span>`, c.name);
      b.dataset.cat = c.id;
      b.onclick = () => { ui.cat = c.id; writeJSON('colorines.ui', ui); renderCards(); };
      tabs.appendChild(b);
    }
  }

  function renderCards() {
    document.querySelectorAll('#tabs .tab').forEach((b) => b.classList.toggle('on', b.dataset.cat === ui.cat));
    const on = $('#tabs .tab.on');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'center' });
    const cat = ART.categories.find((c) => c.id === ui.cat);
    const cards = $('#cards');
    cards.innerHTML = '';
    for (const d of cat.drawings) {
      const html = thumbs.has(d.id) ? `<img src="${thumbs.get(d.id)}" alt="">` : colorSVG(d);
      const b = button('card', html, d.name);
      b.onclick = () => { location.hash = d.id; };
      cards.appendChild(b);
    }
  }

  function setThumb(id, blob) {
    if (thumbs.has(id)) URL.revokeObjectURL(thumbs.get(id));
    thumbs.set(id, URL.createObjectURL(blob));
  }

  $('#random').onclick = () => {
    const all = ART.all();
    location.hash = all[Math.floor(Math.random() * all.length)].id;
  };
  $('#gallery-btn').onclick = () => { location.hash = 'galeria'; };
  $('#gallery-back').onclick = () => { location.hash = ''; };

  // ---------- Abrir y guardar un dibujo ----------
  async function openDrawing(d) {
    const token = ++openToken;
    const sc = (scene = new Scene(d));
    ready = false;
    lines.innerHTML = lineSVG(d);
    pctx.fillStyle = '#fff';
    pctx.fillRect(0, 0, S, S);
    sctx.clearRect(0, 0, S, S);
    stickersUsed = false;
    dirty = false;
    clearUndo();
    show('play');
    AUDIO.say(d.name);

    svgImage(lineSVG(d), S).then((img) => { sc.lineImg = img; }).catch(() => {});
    try {
      const rec = await STORE.getProgress(d.id);
      if (rec && token === openToken) {
        await drawBlob(pctx, rec.paint, token);
        if (rec.stickers) {
          await drawBlob(sctx, rec.stickers, token);
          stickersUsed = true;
        }
      }
    } catch (_) { /* sin progreso guardado */ }
    if (token === openToken) ready = true;
  }

  async function drawBlob(g, blob, token) {
    const bmp = await createImageBitmap(blob);
    if (token === openToken) g.drawImage(bmp, 0, 0, S, S);
    bmp.close();
  }

  // Pintura + contorno + pegatinas en un solo lienzo.
  function composite(size) {
    const c = makeCanvas(size);
    const g = c.getContext('2d');
    g.drawImage(paint, 0, 0, size, size);
    if (scene.lineImg) g.drawImage(scene.lineImg, 0, 0, size, size);
    g.drawImage(stick, 0, 0, size, size);
    return c;
  }

  function markDirty() {
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveProgress, SAVE_DELAY);
  }

  // Las copias de los lienzos se toman al momento; codificar y guardar sigue en segundo plano.
  function saveProgress() {
    clearTimeout(saveTimer);
    if (!scene || !dirty) return Promise.resolve();
    finishSticker();
    dirty = false;
    const id = scene.drawing.id;
    return Promise.all([
      toBlob(paint),
      stickersUsed ? toBlob(stick) : null,
      toBlob(composite(THUMB), 'image/webp', 0.85),
    ])
      .then(([p, s, t]) => STORE.putProgress(id, { paint: p, stickers: s, thumb: t, updated: Date.now() })
        .then(() => {
          setThumb(id, t);
          if ($('#home').classList.contains('active')) renderCards();
        }))
      .catch(() => { /* sin almacenamiento: se pierde al cerrar */ });
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) saveProgress(); });
  window.addEventListener('pagehide', () => saveProgress());

  async function takePhoto() {
    if (!scene || !ready) return;
    finishSticker();
    flash.classList.remove('go');
    void flash.offsetWidth;
    flash.classList.add('go');
    AUDIO.shutter();
    setTimeout(AUDIO.cheer, 250);
    confetti();
    const blob = await toBlob(composite(S));
    try { await STORE.addArt({ drawing: scene.drawing.id, image: blob, created: Date.now() }); } catch (_) { /* sin almacenamiento */ }
  }
  $('#photo').onclick = takePhoto;

  // Confeti sobre el dibujo al guardarlo.
  let confettiRaf = 0;
  function confetti() {
    const colors = TOOLS.colors.slice(0, 9);
    const parts = Array.from({ length: 90 }, () => ({
      x: FX / 2, y: FX * 0.45,
      vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 13 - 4,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
      w: 8 + Math.random() * 8, h: 5 + Math.random() * 5,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    const t0 = performance.now();
    cancelAnimationFrame(confettiRaf);
    const frame = (now) => {
      fctx.clearRect(0, 0, FX, FX);
      if (now - t0 > 1800) return;
      for (const p of parts) {
        p.vy += 0.35; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        fctx.save();
        fctx.translate(p.x, p.y);
        fctx.rotate(p.r);
        fctx.fillStyle = p.c;
        fctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        fctx.restore();
      }
      confettiRaf = requestAnimationFrame(frame);
    };
    confettiRaf = requestAnimationFrame(frame);
  }

  // ---------- Deshacer ----------
  const undo = [];
  const pool = [];
  const take = () => pool.pop() || makeCanvas(S);
  function copy(src) {
    const c = take();
    const g = c.getContext('2d');
    g.clearRect(0, 0, S, S);
    g.drawImage(src, 0, 0);
    return c;
  }
  function release(u) { pool.push(u.p); if (u.s) pool.push(u.s); }

  function pushUndo() {
    undo.push({ p: copy(paint), s: stickersUsed ? copy(stick) : null });
    if (undo.length > UNDO_STEPS) release(undo.shift());
    $('#undo').disabled = false;
  }
  function popUndo() {
    finishSticker();
    const u = undo.pop();
    if (!u) return;
    AUDIO.undo();
    pctx.drawImage(u.p, 0, 0);
    sctx.clearRect(0, 0, S, S);
    if (u.s) sctx.drawImage(u.s, 0, 0);
    release(u);
    $('#undo').disabled = undo.length === 0;
    markDirty();
  }
  function clearUndo() {
    while (undo.length) release(undo.pop());
    $('#undo').disabled = true;
  }

  // ---------- Pintar ----------
  let active = null;
  let rect = null;
  const toArt = (e) => ({
    x: ((e.clientX - rect.left) / rect.width) * 400,
    y: ((e.clientY - rect.top) / rect.height) * 400,
  });

  stage.addEventListener('pointerdown', (e) => {
    if (active || !scene || !ready) return; // un solo dedo; se ignora la palma
    e.preventDefault();
    finishSticker();
    rect = stage.getBoundingClientRect();
    const p = toArt(e);
    if (state.tool === 'sticker') {
      stickersUsed = true;
      pushUndo();
      placeSticker(p);
      AUDIO.pop();
      markDirty();
      return;
    }
    pushUndo();
    AUDIO.scribbleStart();
    try { stage.setPointerCapture(e.pointerId); } catch (_) { /* puntero ya liberado */ }
    active = {
      id: e.pointerId,
      last: p,
      pts: [{ x: p.x * K, y: p.y * K }],
      base: undo[undo.length - 1].p,
      brush: TOOLS.brushes[state.tool],
      mask: settings.clip ? scene.mask(scene.regionAt(p.x, p.y)) : null,
    };
    if (active.brush.whole) renderWhole();
    else drawSeg(p, p);
  });

  stage.addEventListener('pointermove', (e) => {
    if (!active || e.pointerId !== active.id) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    let moved = 0;
    for (const ev of evs.length ? evs : [e]) {
      const p = toArt(ev);
      const dx = p.x - active.last.x, dy = p.y - active.last.y;
      if (dx * dx + dy * dy < 0.5) continue;
      moved += Math.hypot(dx, dy);
      if (active.brush.whole) active.pts.push({ x: p.x * K, y: p.y * K });
      else drawSeg(active.last, p);
      active.last = p;
    }
    if (active.brush.whole && !wholeRaf) wholeRaf = requestAnimationFrame(renderWhole);
    AUDIO.scribbleSpeed(moved);
  });

  const endStroke = (e) => {
    if (!active || e.pointerId !== active.id) return;
    if (active.brush.whole) renderWhole();
    AUDIO.scribbleStop();
    active = null;
    markDirty();
  };
  stage.addEventListener('pointerup', endStroke);
  stage.addEventListener('pointercancel', endStroke);

  function drawSeg(a, b) {
    const br = active.brush;
    const w = TOOLS.sizes[state.sizeIdx] * K * (br.scale || 1);
    const A = { x: a.x * K, y: a.y * K };
    const B = { x: b.x * K, y: b.y * K };
    const pad = w / 2 + 2;
    const x0 = Math.max(0, Math.floor(Math.min(A.x, B.x) - pad));
    const y0 = Math.max(0, Math.floor(Math.min(A.y, B.y) - pad));
    const x1 = Math.min(S, Math.ceil(Math.max(A.x, B.x) + pad));
    const y1 = Math.min(S, Math.ceil(Math.max(A.y, B.y) + pad));
    const bw = x1 - x0, bh = y1 - y0;
    if (bw <= 0 || bh <= 0) return;

    if (active.mask) {
      // El trazo se dibuja aparte y se recorta con la máscara de la zona inicial.
      br.seg(gctx, A, B, w, state);
      gctx.globalCompositeOperation = 'destination-in';
      gctx.drawImage(active.mask, x0 * MS, y0 * MS, bw * MS, bh * MS, x0, y0, bw, bh);
      gctx.globalCompositeOperation = 'source-over';
      pctx.drawImage(seg, x0, y0, bw, bh, x0, y0, bw, bh);
      gctx.clearRect(x0, y0, bw, bh);
    } else {
      br.seg(pctx, A, B, w, state);
    }

    if (br.erasesStickers && stickersUsed) {
      sctx.globalCompositeOperation = 'destination-out';
      TOOLS.line(sctx, A, B, w, '#000');
      sctx.globalCompositeOperation = 'source-over';
    }
  }

  // Pinceles de trazo completo: se repinta desde la copia previa al trazo.
  let wholeRaf = 0;
  function renderWhole() {
    if (wholeRaf) cancelAnimationFrame(wholeRaf);
    wholeRaf = 0;
    if (!active) return;
    const w = TOOLS.sizes[state.sizeIdx] * K;
    pctx.drawImage(active.base, 0, 0);
    if (active.mask) {
      gctx.clearRect(0, 0, S, S);
      active.brush.stroke(gctx, active.pts, w, state);
      gctx.globalCompositeOperation = 'destination-in';
      gctx.drawImage(active.mask, 0, 0, S, S);
      gctx.globalCompositeOperation = 'source-over';
      pctx.drawImage(seg, 0, 0);
      gctx.clearRect(0, 0, S, S);
    } else {
      active.brush.stroke(pctx, active.pts, w, state);
    }
  }

  // ---------- Pegatinas ----------
  let stickerAnim = null;
  const easeOutBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

  function drawEmoji(g, emoji, x, y, size) {
    g.font = `${size}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, x, y);
  }

  function placeSticker(p) {
    const base = undo[undo.length - 1].s;
    const emoji = state.sticker;
    const size = TOOLS.stickerSizes[state.sizeIdx] * K;
    const t0 = performance.now();
    const render = (s) => {
      sctx.clearRect(0, 0, S, S);
      sctx.drawImage(base, 0, 0);
      drawEmoji(sctx, emoji, p.x * K, p.y * K, size * s);
    };
    stickerAnim = { done: () => render(1) };
    const frame = (now) => {
      if (!stickerAnim) return;
      const t = Math.min(1, (now - t0) / 240);
      render(easeOutBack(t));
      if (t < 1) requestAnimationFrame(frame);
      else stickerAnim = null;
    };
    requestAnimationFrame(frame);
  }

  function finishSticker() {
    if (!stickerAnim) return;
    const a = stickerAnim;
    stickerAnim = null;
    a.done();
  }

  // ---------- Panel ----------
  function buildPanel() {
    const tools = $('#tools');
    for (const [id, br] of Object.entries(TOOLS.brushes)) {
      const b = button('btn', br.icon, id);
      b.dataset.tool = id;
      b.onclick = () => { state.tool = id; AUDIO.tap(); refresh(); };
      tools.appendChild(b);
    }
    const sizes = $('#sizes');
    [16, 28, 42].forEach((px, i) => {
      const b = button('btn', `<span class="size-dot" style="width:${px}px;height:${px}px"></span>`, `tamaño ${i + 1}`);
      b.dataset.size = i;
      b.onclick = () => { state.sizeIdx = i; AUDIO.tap(); refresh(); };
      sizes.appendChild(b);
    });
    refresh();
  }

  function refresh() {
    document.querySelectorAll('#tools .btn').forEach((b) => b.classList.toggle('on', b.dataset.tool === state.tool));
    document.querySelectorAll('#sizes .btn').forEach((b) => b.classList.toggle('on', +b.dataset.size === state.sizeIdx));
    const sw = $('#swatches');
    sw.innerHTML = '';
    if (state.tool === 'sticker') {
      for (const s of TOOLS.stickers) {
        const b = button('swatch emoji' + (s === state.sticker ? ' on' : ''), s);
        b.onclick = () => { state.sticker = s; AUDIO.tap(); refresh(); };
        sw.appendChild(b);
      }
    } else {
      for (const c of TOOLS.colors) {
        const b = button('swatch' + (c === state.color && state.tool !== 'eraser' ? ' on' : ''), '', c);
        b.style.background = c;
        b.onclick = () => {
          state.color = c;
          AUDIO.say(TOOLS.colorNames[c]);
          if (state.tool === 'eraser') state.tool = 'pencil';
          AUDIO.tap();
          refresh();
        };
        sw.appendChild(b);
      }
    }
  }

  // Mantener pulsado (evita que el niño salga o abra ajustes sin querer).
  function holdButton(btn, ms, fn) {
    let t0 = 0, raf = 0;
    const stop = () => { cancelAnimationFrame(raf); raf = 0; btn.style.setProperty('--p', 0); };
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      btn.style.setProperty('--p', (p * 100).toFixed(1));
      if (p >= 1) { stop(); fn(); } else raf = requestAnimationFrame(tick);
    };
    btn.addEventListener('pointerdown', () => { t0 = performance.now(); raf = requestAnimationFrame(tick); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => btn.addEventListener(ev, () => { if (raf) stop(); }));
  }

  // Doble toque para acciones que borran.
  function doubleTap(btn, fn) {
    let timer = 0;
    btn.addEventListener('click', () => {
      if (btn.classList.contains('armed')) {
        clearTimeout(timer);
        btn.classList.remove('armed');
        fn();
      } else {
        btn.classList.add('armed');
        timer = setTimeout(() => btn.classList.remove('armed'), 1500);
      }
    });
  }

  holdButton($('#back'), 700, () => { location.hash = ''; });
  $('#undo').onclick = popUndo;
  doubleTap($('#clear'), () => {
    finishSticker();
    pushUndo();
    AUDIO.whoosh();
    pctx.fillStyle = '#fff';
    pctx.fillRect(0, 0, S, S);
    sctx.clearRect(0, 0, S, S);
    markDirty();
  });

  // ---------- Galería ----------
  let galleryUrls = [];
  let viewing = null;

  async function openGallery() {
    show('gallery');
    galleryUrls.forEach((u) => URL.revokeObjectURL(u));
    galleryUrls = [];
    const grid = $('#gallery-grid');
    grid.innerHTML = '';
    let items = [];
    try { items = await STORE.listArt(); } catch (_) { /* sin almacenamiento */ }
    items.sort((a, b) => b.created - a.created);
    $('#gallery-empty').hidden = items.length > 0;
    for (const it of items) {
      const url = URL.createObjectURL(it.image);
      galleryUrls.push(url);
      const b = button('card', `<img src="${url}" alt="">`, 'Dibujo guardado');
      b.onclick = () => openViewer(it, url);
      grid.appendChild(b);
    }
  }

  const fileOf = (it) => new File([it.image], `colorines-${it.drawing}-${it.id}.png`, { type: 'image/png' });
  function canShareFiles() {
    try { return !!navigator.canShare && navigator.canShare({ files: [new File([''], 'x.png', { type: 'image/png' })] }); }
    catch (_) { return false; }
  }

  function openViewer(it, url) {
    viewing = it;
    $('#viewer-pic').innerHTML = `<img src="${url}" alt="Dibujo guardado">`;
    $('#share').hidden = !canShareFiles();
    $('#viewer').hidden = false;
  }
  function closeViewer() {
    $('#viewer').hidden = true;
    viewing = null;
  }

  $('#close-viewer').onclick = closeViewer;
  $('#share').onclick = async () => {
    if (!viewing) return;
    try { await navigator.share({ files: [fileOf(viewing)], title: 'Mi dibujo' }); } catch (_) { /* cancelado */ }
  };
  $('#download').onclick = () => {
    if (!viewing) return;
    const a = document.createElement('a');
    const url = URL.createObjectURL(viewing.image);
    a.href = url;
    a.download = fileOf(viewing).name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  doubleTap($('#delete-art'), async () => {
    if (!viewing) return;
    try { await STORE.deleteArt(viewing.id); } catch (_) { /* sin almacenamiento */ }
    closeViewer();
    openGallery();
  });

  // ---------- Ajustes de adulto ----------
  function applySettings() {
    $('#opt-left b').textContent = settings.left ? 'Izquierda' : 'Derecha';
    $('#opt-clip b').textContent = settings.clip ? 'Sí' : 'No';
    $('#opt-sound b').textContent = settings.sound ? 'Sí' : 'No';
    $('#opt-voice b').textContent = settings.voice ? 'Sí' : 'No';
    $('#play').classList.toggle('left', settings.left);
    AUDIO.enabled = settings.sound;
    AUDIO.voice = settings.voice;
  }
  function toggleSetting(key) {
    settings[key] = !settings[key];
    writeJSON('colorines.settings', settings);
    applySettings();
  }

  holdButton($('#settings-btn'), 2000, () => { $('#settings').hidden = false; });
  $('#close-settings').onclick = () => { $('#settings').hidden = true; };
  $('#opt-left').onclick = () => toggleSetting('left');
  $('#opt-clip').onclick = () => toggleSetting('clip');
  $('#opt-sound').onclick = () => toggleSetting('sound');
  $('#opt-voice').onclick = () => toggleSetting('voice');
  doubleTap($('#opt-wipe'), async () => {
    try { await STORE.clearProgress(); } catch (_) { /* sin almacenamiento */ }
    thumbs.forEach((u) => URL.revokeObjectURL(u));
    thumbs.clear();
    renderCards();
  });

  // ---------- Inicio de la app ----------
  document.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerdown', AUDIO.unlock, true);
  window.addEventListener('hashchange', route);

  // Funcionar sin internet (solo en https o localhost).
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo offline */ });
  }

  buildTabs();
  buildPanel();
  applySettings();
  route();
  STORE.allThumbs()
    .then((m) => {
      m.forEach((blob, id) => setThumb(id, blob));
      if (!scene) renderCards();
    })
    .catch(() => { /* sin almacenamiento */ });
})();
