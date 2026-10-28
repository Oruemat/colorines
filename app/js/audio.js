// Sonidos sintetizados con Web Audio (sin archivos), vibración y voz.
(function () {
  'use strict';
  const A = (window.AUDIO = { enabled: true, voice: true });
  let ctx = null, master = null, noiseBuf = null, scribble = null;

  function ensure() {
    if (!A.enabled) return null;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noise() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  function tone(freq, dur, { type = 'sine', gain = 0.3, to = 0, delay = 0 } = {}) {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function hiss(dur, from, to, gain) {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noise();
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(from, t);
    bp.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  A.vibrate = (ms) => {
    if (A.enabled && navigator.vibrate) { try { navigator.vibrate(ms); } catch (_) { /* no disponible */ } }
  };

  // El navegador solo deja sonar tras un toque: se llama en cada pointerdown.
  A.unlock = () => { ensure(); };

  A.tap = () => tone(880, 0.06, { type: 'triangle', gain: 0.12 });
  A.pop = () => { tone(420, 0.14, { to: 1200, gain: 0.35 }); A.vibrate(12); };
  A.undo = () => tone(660, 0.12, { type: 'triangle', to: 420, gain: 0.2 });
  A.whoosh = () => hiss(0.45, 2500, 300, 0.35);
  A.shutter = () => { hiss(0.08, 4000, 2000, 0.4); A.vibrate(30); };
  A.cheer = () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, { type: 'triangle', gain: 0.22, delay: i * 0.1 }));

  // Rasgueo suave mientras se pinta; el volumen sigue a la velocidad del dedo.
  A.scribbleStart = () => {
    const c = ensure();
    if (!c) return;
    A.scribbleStop();
    const src = c.createBufferSource();
    src.buffer = noise();
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500;
    bp.Q.value = 0.8;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(bp).connect(g).connect(master);
    src.start();
    scribble = { src, g, bp };
  };
  A.scribbleSpeed = (v) => {
    if (!scribble) return;
    const t = ctx.currentTime;
    scribble.g.gain.setTargetAtTime(Math.min(0.18, v * 0.015), t, 0.03);
    scribble.bp.frequency.setTargetAtTime(1100 + Math.min(v, 20) * 70, t, 0.05);
  };
  A.scribbleStop = () => {
    if (!scribble) return;
    const s = scribble;
    scribble = null;
    s.g.gain.setTargetAtTime(0, ctx.currentTime, 0.04);
    s.src.stop(ctx.currentTime + 0.25);
  };

  A.say = (text) => {
    if (!A.enabled || !A.voice || !('speechSynthesis' in window)) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'es-ES';
      const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.toLowerCase().startsWith('es'));
      if (v) u.voice = v;
      u.rate = 0.9;
      u.pitch = 1.2;
      speechSynthesis.speak(u);
    } catch (_) { /* sin voz */ }
  };
})();
