// Colores, tamaños, pinceles y pegatinas.
(function () {
  'use strict';
  const { K } = ENGINE;

  function line(g, a, b, w, color) {
    g.strokeStyle = color;
    g.lineWidth = w;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
  }

  window.TOOLS = {
    line,

    colors: [
      '#ff3b30', '#ff9500', '#ffd60a',
      '#8bd346', '#20b25a', '#5ac8fa',
      '#0a6cff', '#a05cf0', '#ff6fb5',
      '#a2694b', '#2b2d42', '#ffffff',
    ],

    stickers: ['⭐', '❤️', '🌸', '🦋', '🐞', '🌈', '☀️', '🎈', '🐟', '🍎', '🚗', '🐶'],

    // Grosor del trazo y tamaño de las pegatinas, en unidades del dibujo.
    sizes: [14, 26, 44],
    stickerSizes: [55, 80, 115],

    brushes: {
      pencil: {
        icon: '✏️',
        seg(g, a, b, w, st) { line(g, a, b, w, st.color); },
      },
      // Se dibuja el trazo completo de una vez para que el centro blanco no quede cortado.
      glow: {
        icon: '✨',
        whole: true,
        stroke(g, pts, w, st) {
          g.save();
          g.lineCap = 'round';
          g.lineJoin = 'round';
          g.beginPath();
          g.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
          if (pts.length === 1) g.lineTo(pts[0].x + 0.1, pts[0].y);
          g.shadowColor = st.color;
          g.shadowBlur = 14 * K;
          g.strokeStyle = st.color;
          g.lineWidth = w * 0.8;
          g.stroke();
          g.shadowBlur = 0;
          g.strokeStyle = 'rgba(255,255,255,0.9)';
          g.lineWidth = w * 0.3;
          g.stroke();
          g.restore();
        },
      },
      rainbow: {
        icon: '🌈',
        seg(g, a, b, w, st) {
          st.hue = (st.hue + Math.hypot(b.x - a.x, b.y - a.y) * 0.25) % 360;
          line(g, a, b, w, `hsl(${st.hue.toFixed(0)} 90% 58%)`);
        },
      },
      sticker: { icon: '⭐', tap: true },
      eraser: {
        icon: '🧽',
        scale: 1.3,
        erasesStickers: true,
        seg(g, a, b, w) { line(g, a, b, w, '#ffffff'); },
      },
    },
  };
})();
