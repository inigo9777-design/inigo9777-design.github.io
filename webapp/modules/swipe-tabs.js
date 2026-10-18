// modules/swipe-tabs.js — Lógica PURA del gesto "deslizar horizontalmente" (viewpager de
// Android, feature móvil 2026-10-18). Sin DOM, sin localStorage (CODING_STANDARDS.md §3,
// option A): aquí se decide SI un swipe es válido y HACIA QUÉ vista saltar; el wiring de los
// eventos touch y las exclusiones de elementos interactivos (inputs, botones, scrollers
// internos) viven en app.js, que es el composition-root.
//
// Motivo: en el PWA standalone del móvil la página se movía entera horizontalmente al
// arrastrar el dedo. El usuario pidió "comportamiento viewpager": deslizar de lado cambia de
// pestaña en vez de mover toda la pantalla (y el scroll-x accidental se bloquea por CSS).
//
// API PÚBLICA CERRADA (2 funciones, sin fugas de helpers internos):
//   dirDeGesto(dx, dy) → 1 (avanzar a la vista siguiente: deslizar a la IZQUIERDA),
//                        -1 (retroceder a la anterior: deslizar a la DERECHA), 0 (no es swipe).
//                        Es un swipe si |dx| >= UMBRAL_DX y |dy| < UMBRAL_DY (y |dx| manda
//                        claramente sobre |dy|: el viewpager ni arranca tras un scroll
//                        vertical real).
//   vecina(orden, actual, dir) → id de la vista vecina en `orden` con wrap-around
//                        (la última avanza a la primera y viceversa); null si `actual` no
//                        está en el orden, si dir es 0 o si la lista es inválida.

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Jest / Node: require() directo desde test aislado.
  root.MRCheff = root.MRCheff || {};
  root.MRCheff.swipeTabs = api;                                           // Navegador: window.MRCheff.swipeTabs
})(typeof self !== "undefined" ? self : this, function () {

  // Umbrales del viewpager: el swipe debe ser claramente horizontal. 60px de avance evita
  // que un toque torpe "salte de pestaña"; 48px vertical: un scroll con un pelín de deriva
  // horizontal NO cambia de vista. Exposición como constantes públicas permite ajustarlas
  // (y en tests, referenciarlas) sin duplicar los números.
  const UMBRAL_DX = 60;
  const UMBRAL_DY = 48;

  function dirDeGesto(dx, dy) {
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (adx < UMBRAL_DX) return 0;      // demasiado corto: no es swipe
    if (ady >= UMBRAL_DY) return 0;     // demasiado vertical: es scroll, no swipe
    if (ady * 1.5 >= adx) return 0;     // diagonal ladrón: la vertical manda, se descarta
    return dx < 0 ? 1 : -1;             // izquierda → siguiente (viewpager estándar)
  }

  function vecina(orden, actual, dir) {
    if (!Array.isArray(orden) || orden.length === 0 || !dir) return null;
    const i = orden.indexOf(actual);
    if (i < 0) return null;
    const j = (i + dir + orden.length) % orden.length;
    return orden[j];
  }

  return { dirDeGesto, vecina, UMBRAL_DX, UMBRAL_DY };
});
