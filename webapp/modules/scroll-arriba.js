// modules/scroll-arriba.js — botón FLOTANTE "subir encima" (feature 2026-10-21, petición del
// usuario: con listas verticales muy largas, al bajar por la pestaña aparece abajo a la derecha
// un círculo con flecha, que con animación devuelve AL PRINCIPIO de la pestaña EN LA que esté).
// Lógica PURA (el window va inyectado): regla de visibilidad, ejecución del salto y
// consulta de reduce-motion. El listener de scroll y el molde son de app.js
// (CODING_STANDARDS §3 / patrón swipe-tabs).
// API PÚBLICA (3 funciones):
//   debeMostrarseBoton(subida, umbral?) → true cuando el documento ya se bajó MÁS de `umbral`
//                                         (oculto al estar arriba del todo y hasta el umbral).
//   subirEncima(win, opts?)             → el salto real a y=0: animado ("smooth" tal como
//                                         pidió el usuario) salvo reduce-motion ("auto") y con
//                                         fallback para WebViews sin options object — la MISMA
//                                         mecánica probada del click del topbar en activarVista.
//   movimientoReducido(win)             → prefers-reduced-motion activo (falso sin matchMedia).
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // Jest / Node directo.
  root.MRCheff = root.MRCheff || {};        // Namespace global único, igual que los demás módulos.
  Object.assign(root.MRCheff, { scrollArriba: api });
})(typeof self !== "undefined" ? self : this, function () {

  // ---------------------------------------------------------------------------
  // Visibilidad: aparece cuando el scroll del documento supera el umbral (app.js pasa una
  // pantallita) y se OCULTA al volver arriba del todo (y ≤ umbral). Tolerante a valores raros
  // (NaN/Infinity e inferiores a 0 se toman como 0): ningún muro mata al botón pegado a top.
  // ---------------------------------------------------------------------------
  function debeMostrarseBoton(subida, umbral) {
    const y = Number.isFinite(subida) && subida >= 0 ? subida : 0;
    const lim = Number.isFinite(umbral) && umbral >= 0 ? umbral : 0;
    return y > lim;
  }

  // ---------------------------------------------------------------------------
  // Salto: options object ANIMADO y, si el motor lo rechaza (WebViews viejos), salto sin
  // animación — línea por línea lo mismo que arriba en activarVista (§6 del swipe):
  //   * sin `reducido` → "smooth" (la ANIMACIÓN que pidió el usuario);
  //   * con `reducido` (prefers-reduced-motion) → "auto" (sin empujar a quien pidió calmado);
  //   * `win` inyectable para tests (un espía basta, no hay window global).
  // ---------------------------------------------------------------------------
  function subirEncima(win, opts) {
    const reduce = !!(opts && opts.reducido);
    try {
      win.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    } catch (e) {
      win.scrollTo(0, 0);
    }
  }

  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // reduce-motion como pregunta tolerante: en entornos sin matchMedia responde falso;
  // sólo computa cuando la preferencia EXISTE y va activada.
  // ---------------------------------------------------------------------------
  function movimientoReducido(win) {
    return !!(win && typeof win.matchMedia === "function" && win.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  return { debeMostrarseBoton, subirEncima, movimientoReducido };
});
