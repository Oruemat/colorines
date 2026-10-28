# Colorines — Plan de implementación

App de colorear **original** para un niño de ~2 años. PWA para tablet **Android**, pensada para
**pintar con el dedo**. Sin internet, sin pagos, sin cuentas, sin anuncios.

## Decisiones

| Tema | Decisión |
|---|---|
| Tecnología | HTML + CSS + JavaScript sin frameworks ni compilación |
| Dibujos | SVG 400×400 con zonas (regiones) + contorno grueso |
| Pintura | Canvas 1024×1024 debajo del contorno SVG; el trazo no se sale de la zona donde empezó |
| Guardado | IndexedDB (en la tablet) |
| Sonido | Web Audio sintetizado (sin archivos) |
| Offline | Service worker + manifest |
| Publicación | GitHub Pages con la cuenta del usuario (solo la carpeta `app/`) |

### Adaptaciones para 2 años
- Botones de 72 px o más, iconos en vez de texto.
- "No salirse de la zona" activado por defecto.
- Pinceles gruesos por defecto; solo 3 tamaños.
- Salir del dibujo exige **mantener pulsado** 🏠; borrar todo exige **doble toque** 🗑️.
- Se ignora un segundo dedo o la palma.
- Ajustes solo para adultos (pulsación larga de 2 s).

## Estructura

```
Aplicacion Dibujo/
├── PLAN.md
├── input/                 ← XAPK de referencia; NO se usa ni se publica (.gitignore)
└── app/                   ← lo único que se publica
    ├── index.html
    ├── css/styles.css
    ├── js/art.js          utilidades para definir dibujos (C, E, R, P, L, eye…)
    ├── js/drawings/*.js   un archivo por tema
    ├── js/engine.js       zonas, máscaras, SVG del contorno
    ├── js/tools.js        colores, pinceles, pegatinas
    └── js/app.js          pantallas, entrada táctil, deshacer
```

## Fases

| # | Fase | Contenido | Estado |
|---|---|---|---|
| 0 | Base | Estructura, HTML, diseño adaptable (horizontal/vertical) | ✅ |
| 1 | Motor | Zonas, pintar con el dedo sin salirse, deshacer (8 pasos), borrar todo | ✅ |
| 2 | Herramientas | 12 colores, lápiz / brillo / arcoíris, 3 tamaños, borrador, pegatinas | ✅ |
| 3 | Contenido | 12 temas × 5 dibujos (60) + página de vista previa (`app/preview.html`) | ✅ |
| 4 | Pantallas | Inicio con pestañas por tema, 🎲 sorpresa, ajustes de adulto (⚙️ 2 s), zurdo/diestro | ✅ |
| 5 | Guardado | Autoguardado por dibujo (IndexedDB), miniaturas, galería 📷, compartir/descargar/eliminar | ✅ |
| 6 | Sonido | Rasgueo al pintar, sonidos de pegatinas/deshacer/borrar/foto, confeti, vibración, voz con el nombre | ✅ |
| 7 | PWA | Manifest, service worker (`sw.js`), iconos 192/512, pantalla completa, modo avión probado | ✅ |
| 8 | Publicación | GitHub Pages con Actions (`.github/workflows/pages.yml`), instalación en la tablet | ⏳ |

## Publicar y actualizar
1. Repositorio público `colorines` en GitHub, con Pages → Source: **GitHub Actions**.
2. Cada `git push` a `main` publica `app/` en `https://<usuario>.github.io/colorines/`.
3. **Al cambiar la app, subir `VERSION` en `app/sw.js`** (p. ej. `colorines-v2`); si no, la tablet
   sigue usando la copia guardada.
4. En la tablet: abrir la dirección en Chrome → menú ⋮ → **Instalar aplicación**.

### Entregas
1. **Fases 0–2** con 3 dibujos de prueba (pez, coche, pollito) → validar que pintar se siente bien.
2. **Fases 3–5**: todo el contenido y el guardado.
3. **Fases 6–8**: acabado, PWA y publicación.

### Temas previstos (fase 3)
Granja, selva, dinosaurios, mar, vehículos, espacio, comida, insectos, naturaleza, juguetes,
mascotas, polo norte. Dibujos originales con trazo grueso y zonas grandes.

## Formato de un dibujo

```js
ART.category({ id: 'mar', name: 'Mar', icon: '🐠', drawings: [
  { id: 'pez', name: 'Pez', bg: '#a0e7ff', parts: [
    ART.E(215, 200, 135, 95, '#ffd166'),   // zona (elipse) con su color de referencia
    ART.eye(285, 175, 22),                 // ojo: zona blanca + pupila + brillo
    ART.L('M300 225 Q320 240 338 222'),    // línea de detalle (no es zona)
  ]},
]});
```
Las zonas posteriores quedan encima de las anteriores.

## Criterios de terminado
- Se instala en la tablet y funciona en modo avión.
- Pintar responde al instante, sin retraso visible.
- Un niño de 2 años la usa solo: nada de texto imprescindible ni salidas accidentales.
- Progreso y galería se conservan al cerrar la app.

## Cómo probar en local
```
cd app
python -m http.server 8080
```
Abrir `http://localhost:8080`. También funciona abriendo `app/index.html` directamente.
