// modules/categoria-producto.js — ETIQUETA alimento / producto no alimentario del Inventario
// (petición del requisito 95%: el ticket trae detergentes, papel, lejía… y el Inventario ahora
// los acoge con su propio tag). Reglas del producto NO alimentario (fijadas con el usuario):
//   · en el Inventario actual viven en su SECCIÓN propia, agrupados y separados de los alimentos;
//   · entran en las ALERTAS semanales (reponer cuando se agotan — sin importancia ni mínimo pedido);
//   · en el ESCÁNER del ticket salen por la zona de DUDAS/revisión, sin pedir importancia/mínimo;
//   · NO se usan para NADA más: ni recetas, ni sugerencias, ni menú semanal, ni la comprobación
//     contra la despensa de la lista de la compra (esa lista es del plan semanal, sólo alimentos).
// Módulo PURO (§3): el shape §5 de Food gana un campo OPCIONAL `categoria: "hogar"` — equivale a
// "alimento" cuando falta (retro-compatible con backups v2, sync diff3 y todos los foods existentes).
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;   // Jest / Node
  root.MRCheff = root.MRCheff || {};
  Object.assign(root.MRCheff, { categoriaProducto: api });
})(typeof self !== "undefined" ? self : this, function () {

  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // ─── Palabras del LIMPIA/hogar (el OCR las lee tal cual en el ticket; comparamos por token en
  // norma, prefijo con palabra ≥5 letras igual que el matcher compartido — "papeles"→"papel",
  // "detergentes"→"detergente"; "gel" (3) sólo exacto para no tragar "gelatina" ni "gelificante").
  const PALABRAS_HOGAR = [
    "papel", "pañuelo", "panuelo", "higienico", "higiénico", "detergente", "lejia", "lejía",
    "suavizante", "amoniaco", "limpiador", "fregasuelos", "fregonas", "fregona", "bayeta",
    "esponja", "champu", "champú", "jabon", "jabón", "acondicionador", "crema dental",
    "cepillo", "desodorante", "colonia", "pañal", "panal", "toallita", "compresa", "tapon",
    "tapón", "preservativo", "purificante", "ambientador", "insecticida", "bolsa", "bolsas",
    "papelera", "aluminio", "film", "pilas", "bateria", "batería", "encendedor", "cerillas",
    "vaso", "vasos", "servilleta", "mantel", "fertilizante", "maceta"
  ];
  function esPalabraHogar(palabra) {
    const p = norm(palabra);
    return PALABRAS_HOGAR.some(h => {
      const clave = norm(h);
      return p === clave || (clave.length >= 5 && (p.startsWith(clave) || p.endsWith(clave)));
    });
  }

  // ─── ¿El NOMBRE de un candidato del ticket es producto de hogar? Un token del náme basta
  // (basta una señal del producto — "Papel Higiénico Doble"; falso-negativo improbable: ningún
  // alimento del vocabulario FOOD_TYPES comparte estas palabras). El troceo va por LETRA unicode
  // (\p{L}): con \W los acentos É/Ñ parirían el token ("HIGIÉNICO" → "HIGI"+"NICO").
  function esProductoHogar(nombre) {
    return String(nombre || "").split(/[^\p{L}]+/u).filter(Boolean).some(esPalabraHogar);
  }

  // ─── Contratos rápidos sobre la despensa. `esHogar` es LA pregunta única: un food SIN el campo
  // es alimento (todas las despensas anteriores siguen siendo despensas de alimentos).
  const esHogar = f => String(f && f.categoria || "").trim().toLowerCase() === "hogar";
  const esAlimento = f => !esHogar(f);
  const alimentos = foods => (Array.isArray(foods) ? foods : []).filter(esAlimento);
  const hogares = foods => (Array.isArray(foods) ? foods : []).filter(esHogar);

  // Alta de un candidato del ticket: el hogar NO pide criterio (petición del usuario) — importancia
  // fija 5 (única de urgencia neutra cuando salte su alerta) y mínimo 0 (avisa cuando se acabe).
  function criterioDeAlta(hogar, criterio) {
    if (!hogar) return criterio;
    return { score: 5, min: 0, ...(criterio || {}) };
  }

  return { esProductoHogar, esPalabraHogar, PALABRAS_HOGAR, esHogar, esAlimento, alimentos, hogares, criterioDeAlta };
});
