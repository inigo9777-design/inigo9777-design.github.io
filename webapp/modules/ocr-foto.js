// modules/ocr-foto.js — La MÁQUINA DE LA FOTO del escáner del ticket (OCR, #epic-ocr-despensa-camara).
// puro y testeado (§3 CODING_STANDARDS: sin DOM, sin localStorage): aquí viven las DECISIONES sobre el
// fichero que la persona eligió — si necesita conversión HEIC, la geometría del giro por cara y el
// CICLO DE CARAS (de frente → girada 90° → girada 270°) hasta que una lee alimentos. La I/O la aporta
// la vista (app.js) por ctx inyectable (§6, patrón __mrcheffEsMovil/__mrcheffCryptoImpl):
//   · esHeic(archivo) → boolean        la decisión del módulo del ticket (modules/ocr-despensa.js);
//   · decodificar(blob) → Promise      sondeo con el decodificador REAL del navegador
//                                      (createImageBitmap); si la vista pasa null (entorno sin
//                                      decodificador, p. ej. jsdom) la foto pasa SIN conversión;
//   · convertir(archivo) → Promise     conversión HEIC/HEIF → JPEG (heic2any por CDN con el
//                                      gancho de test window.__mrcheffHeicConvertir);
//   · abierta() → boolean              el escaneo que retrata: el usuario puede cerrar el modal
//                                      en medio (closeModal sólo lo OCULTA);
//   · lienzoDe(grados) → lienzo|null   el canvas de la cara (app.js: createElement + contexto 2d);
//   · reconocer(lienzo, grados) → Promise<texto>   la pasada del motor (Tesseract real);
//   · hayAlimentos(texto) → boolean    el vocabulario decide (extraerCandidatos, módulo del ticket).
// Los tickets se fotografían con el móvil y el papel suele caer de lado: el motor no reorienta el
// texto por su cuenta, así que la propia máquina gira la foto y PRUEBA OTRA CARA hasta leer.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;   // Jest / Node: require() directo.
  root.MRCheff = root.MRCheff || {};                                        // namespace global único de la app.
  Object.assign(root.MRCheff, { ocrFoto: api });
})(typeof self !== "undefined" ? self : this, function () {

  // ─── PREPARAR la foto: deja en el resultado lo que el decodificador del canvas sí pueda leer.
  //   · HEIC declarado (por nombre/MIME, módulo del ticket) → conversión directa;
  //   · el resto pasa al sondeo: si el decodificador real lo rechaza (HEIC camuflado de ".png",
  //     exactamente el caso real del e2e — bytes HEIF con extensión mentirosa), también va al
  //     conversor; si sondea bien (JPG/PNG/WebP/AVIF de toda la vida) se queda como está.
  // Devuelve { foto, convertido } — la foto lista y si se pagó conversión (contrato testeable).
  async function prepararFoto(archivo, ctx) {
    ctx = ctx || {};
    if (ctx.esHeic && ctx.esHeic(archivo)) return { foto: await ctx.convertir(archivo), convertido: true };
    if (typeof ctx.decodificar !== "function") return { foto: archivo, convertido: false };   // sin sondeo posible: pasaporte
    try {
      await ctx.decodificar(archivo);
      return { foto: archivo, convertido: false };
    } catch {
      return { foto: await ctx.convertir(archivo), convertido: true };   // el decodificador la rechaza: a convertir
    }
  }

  // ─── GEOMETRÍA del lienzo por cara (pura): la cara girada 90/270 intercambia los lados; la
  // resolución se limita a LADO_MAX px por el lado mayor — el OCR no gana con más (a 4.000px cada
  // pasada tarda mucho en el wasm) y los tickets se leen bien a esa escala. Sin dimensiones → null.
  const LADO_MAX = 1600;
  function geometriaDeLienzo(bitmap, grados) {
    const ancho = (bitmap && bitmap.width) || 0;
    const alto = (bitmap && bitmap.height) || 0;
    if (!ancho || !alto) return null;
    const gira = grados % 180 !== 0;
    const escala = Math.min(1, LADO_MAX / Math.max(ancho, alto));
    return {
      ancho: Math.round((gira ? alto : ancho) * escala),
      alto: Math.round((gira ? ancho : alto) * escala),
      escala
    };
  }

  // ─── CARAS a probar, en orden: fotos de móvil con el OBJETO girado son la moda, no la excepción.
  const CARAS = [0, 90, 270];

  // ─── CICLO DE CARAS: reconoce de frente; si no lee alimentos, prueba la foto girada 90° y 270°.
  // Se corta a la primera cara con candidatos (normal: 1 sola pasada; el giro sólo paga la foto
  // de lado). Devuelve { texto, caras }:
  //   texto: null  → el usuario cerró el modal en medio: NO procesar nada;
  //   texto: ""    → ninguna cara leyó alimentos (la vista muestra su aviso clásico);
  //   texto: "…"   → lo leído de la cara buena;
  //   caras: cuántas pasadas de motor se dispararon de verdad (0 si fue cancelado antes).
  async function escanearCaras(ctx) {
    const abierta = ctx.abierta || (() => true);
    const hay = ctx.hayAlimentos || (() => true);
    let caras = 0;
    for (const grados of CARAS) {
      if (!abierta()) return { texto: null, caras };
      const lienzo = ctx.lienzoDe ? ctx.lienzoDe(grados) : null;
      if (!lienzo) break;                                  // esa cara no se puede pintar: nada que reconocer
      const texto = String((await ctx.reconocer(lienzo, grados)) || "");
      caras += 1;
      if (!abierta()) return { texto: null, caras };        // cerró el modal mientras reconocía: ahí se acaba
      if (hay(texto)) return { texto, caras };              // esta cara leyó: FIN
      // cara sin nada reconocible: siguiente giro; agotadas las tres, el aviso clásico
    }
    return { texto: "", caras };
  }

  return { prepararFoto, geometriaDeLienzo, escanearCaras, CARAS, LADO_MAX };
});
