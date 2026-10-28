// Motor: zonas de un dibujo, máscaras para no salirse y SVG del contorno.
(function () {
  'use strict';
  const U = 400;      // unidades del dibujo
  const S = 1024;     // resolución del lienzo de pintura
  const M = 512;      // resolución de las máscaras de zona
  const K = S / U;
  const INK = '#2b2d42';
  const LINE = 7;

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h || w;
    return c;
  }

  class Scene {
    constructor(drawing) {
      this.drawing = drawing;
      this.regions = drawing.parts
        .filter((p) => p.t === 'r')
        .map((p) => ({ path: new Path2D(p.d), rule: p.rule || 'nonzero', color: p.c }));
      this.hit = makeCanvas(1).getContext('2d');
      this.masks = new Map();
    }

    // Zona más alta bajo el punto (en unidades del dibujo); -1 es el fondo.
    regionAt(x, y) {
      for (let i = this.regions.length - 1; i >= 0; i--) {
        const r = this.regions[i];
        if (this.hit.isPointInPath(r.path, x, y, r.rule)) return i;
      }
      return -1;
    }

    // Máscara de la parte visible de una zona: su forma menos las zonas que tiene encima.
    mask(i) {
      if (this.masks.has(i)) {
        const m = this.masks.get(i);
        this.masks.delete(i);
        this.masks.set(i, m);
        return m;
      }
      const c = makeCanvas(M);
      const g = c.getContext('2d');
      g.setTransform(M / U, 0, 0, M / U, 0, 0);
      if (i < 0) g.fillRect(0, 0, U, U);
      else g.fill(this.regions[i].path, this.regions[i].rule);
      g.globalCompositeOperation = 'destination-out';
      for (let j = i + 1; j < this.regions.length; j++) g.fill(this.regions[j].path, this.regions[j].rule);
      this.masks.set(i, c);
      if (this.masks.size > 8) this.masks.delete(this.masks.keys().next().value);
      return c;
    }
  }

  function el(p, extra) {
    const rule = p.rule ? ` fill-rule="${p.rule}"` : '';
    switch (p.t) {
      case 'r': return `<path d="${p.d}"${rule} fill="none" stroke="${INK}" stroke-width="${LINE}"${extra}/>`;
      case 'l': return `<path d="${p.d}" fill="none" stroke="${INK}" stroke-width="${p.w || 5}"${extra}/>`;
      case 'i': return `<path d="${p.d}" fill="${INK}"${extra}/>`;
      case 'w': return `<path d="${p.d}" fill="#fff"${extra}/>`;
      default: return '';
    }
  }

  const svgOpen = '<svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" stroke-linecap="round" stroke-linejoin="round">';
  let uid = 0;

  // Contorno transparente: cada pieza se oculta bajo las zonas que tiene encima.
  function lineSVG(drawing) {
    const id = `m${++uid}_`;
    const parts = drawing.parts;
    const regs = [];
    parts.forEach((p, i) => { if (p.t === 'r') regs.push(i); });
    const made = new Set();
    let defs = '', body = '';
    parts.forEach((p, i) => {
      const later = regs.filter((j) => j > i);
      let extra = '';
      if (later.length) {
        const key = later[0];
        if (!made.has(key)) {
          made.add(key);
          defs += `<mask id="${id}${key}" maskUnits="userSpaceOnUse" x="-20" y="-20" width="440" height="440">` +
            '<rect x="-20" y="-20" width="440" height="440" fill="#fff"/>' +
            later.map((j) => `<path d="${parts[j].d}" fill="#000"/>`).join('') + '</mask>';
        }
        extra = ` mask="url(#${id}${key})"`;
      }
      body += el(p, extra);
    });
    return `${svgOpen}<defs>${defs}</defs>${body}</svg>`;
  }

  // Versión coloreada (miniaturas).
  function colorSVG(drawing) {
    let body = `<rect width="400" height="400" fill="${drawing.bg || '#fff'}"/>`;
    for (const p of drawing.parts) {
      if (p.t === 'r') {
        const rule = p.rule ? ` fill-rule="${p.rule}"` : '';
        body += `<path d="${p.d}"${rule} fill="${p.c}" stroke="${INK}" stroke-width="${LINE}"/>`;
      } else body += el(p, '');
    }
    return `${svgOpen}${body}</svg>`;
  }

  window.ENGINE = { U, S, M, K, makeCanvas, Scene, lineSVG, colorSVG };
})();
