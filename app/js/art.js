// Utilidades para definir dibujos en un lienzo de 400x400.
// Tipos de pieza: 'r' zona coloreable, 'l' línea de detalle, 'i' relleno de tinta, 'w' brillo blanco.
(function () {
  'use strict';
  const f = (n) => +n.toFixed(2);

  const A = (window.ART = { categories: [], byId: {} });

  A.P = (d, c, rule) => ({ t: 'r', d, c, rule });

  A.C = (cx, cy, r, c) =>
    A.P(`M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`, c);

  A.E = (cx, cy, rx, ry, c, rot = 0) => {
    const a = (rot * Math.PI) / 180;
    const dx = rx * Math.cos(a), dy = rx * Math.sin(a);
    return A.P(
      `M${f(cx - dx)} ${f(cy - dy)}A${f(rx)} ${f(ry)} ${rot} 1 0 ${f(cx + dx)} ${f(cy + dy)}` +
      `A${f(rx)} ${f(ry)} ${rot} 1 0 ${f(cx - dx)} ${f(cy - dy)}Z`, c);
  };

  A.R = (x, y, w, h, r, c) =>
    A.P(`M${f(x + r)} ${f(y)}H${f(x + w - r)}Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)}` +
      `V${f(y + h - r)}Q${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)}H${f(x + r)}` +
      `Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)}V${f(y + r)}Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)}Z`, c);

  A.L = (d, w) => ({ t: 'l', d, w });
  A.I = (d) => ({ t: 'i', d });
  A.dot = (cx, cy, r) => A.I(A.C(cx, cy, r).d);
  A.shine = (cx, cy, r) => ({ t: 'w', d: A.C(cx, cy, r).d });

  // Ojo: zona blanca + pupila + brillo.
  A.eye = (cx, cy, r) => [
    A.C(cx, cy, r, '#ffffff'),
    A.dot(cx + r * 0.15, cy + r * 0.1, r * 0.58),
    A.shine(cx - r * 0.02, cy - r * 0.12, r * 0.2),
  ];

  A.category = (cat) => {
    cat.drawings.forEach((d) => {
      d.parts = d.parts.flat(Infinity);
      d.cat = cat.id;
      A.byId[d.id] = d;
    });
    A.categories.push(cat);
  };

  A.all = () => A.categories.flatMap((c) => c.drawings);
})();
