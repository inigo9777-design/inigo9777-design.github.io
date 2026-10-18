// modules/ocr-despensa.js — Lógica del escáner de despensa (OCR en el navegador, #epic-ocr-despensa-camara).
// Toda la DECISIÓN del flujo vive aquí, puro y testeado (§3 CODING_STANDARDS): detectar alimentos de un
// texto OCR contra el vocabulario FOOD_TYPES, decidir si el dispositivo es móvil (la opción de la cámara
// sólo se muestra en móvil) y fusionar lo confirmado con la despensa existente. La imagen (el "cómo se
// saca la foto") y el motor Tesseract.js son infra de vista → app.js.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;   // Jest / Node: require() directo.
  root.MRCheff = root.MRCheff || {};                                        // namespace global único de la app.
  Object.assign(root.MRCheff, { ocrDespensa: api });
})(typeof self !== "undefined" ? self : this, function () {

  // Normaliza como el resto de la app (modules/classify.js): minúsculas + quitar acentos (NFD + combining marks).
  const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const capitaliza = s => {
    const t = String(s || "").trim();
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  };

  // ─── ¿Dispositivo móvil? La opción de abrir la CÁMARA SÓLO aparece en la vista móvil (requisito del
  // epic). Se decide por el user agent del navegador: Android / iPhone / iPad / iPod / Windows Phone o
  // cualquier UA que se declare "Mobile". En escritorio el flujo sigue disponible por otra vía: elegir
  // una FOTO del frigorífico desde el disco (el botón de cámara ni siquiera se pinta).
  function esMovil(userAgent) {
    return /Android|iPhone|iPod|iPad|Mobile|Windows Phone/i.test(String(userAgent || ""));
  }

  // ─── Detección: del texto libre que saca el OCR (con ruido de envases, precios, tildes fallidas)
  // → candidatos de alimentos, contra el vocabulario compartido FOOD_TYPES de modules/classify.js
  // (se lo inyecta el llamador: módulo puro, sin dependencia dura en tiempo de carga).
  //
  // Reglas del matcher (contrato, mismas heurísticas que classifyFood):
  //   · el texto y las palabras del vocabulario se comparan EN NORMA (sin tildes, minúsculas);
  //   · igualdad de token, o prefijo/sufijo si la palabra del vocabulario tiene ≥4 letras
  //     ("Cebollas"→"cebolla", "yogures"→"yogur", "Macarrones"→"macarron"); palabras de <4
  //     letras ("pan", "sal", "ajo") sólo igualdad exacta — "ensalada" NO es "sal";
  //   · un token del texto alimenta UNA sola palabra del vocabulario (la más larga que lo reclama):
  //     "lentejas" no da a la vez "lenteja" y "lentejas";
  //   · cada palabra del vocabulario declara UN candidato aunque aparezca varias veces (se cuenta en `veces`);
  //   · el orden de salida es el del documento OCR (primera línea donde aparece), determinista.
  function extraerCandidatos(texto, vocabulario) {
    const lineas = String(texto || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const porClave = new Map();            // palabra del vocabulario → candidato con su primera línea
    lineas.forEach((linea, idxLinea) => {
      const tokens = norm(linea).split(/\W+/).filter(Boolean);
      tokens.forEach(token => {
        let mejor = null;                  // la palabra más larga que reclama este token
        for (const tipo of Object.keys(vocabulario || {})) {
          for (const palabra of vocabulario[tipo]) {
            const p = norm(palabra);
            if (p.length < 2) continue;    // por contrato: nada de claves de 1 letra
            const gana = token === p || (p.length >= 4 && (token.startsWith(p) || token.endsWith(p)));
            if (gana && (!mejor || p.length > mejor.p.length)) mejor = { tipo, palabra, p };
          }
        }
        if (!mejor) return;
        const previo = porClave.get(mejor.palabra);
        if (previo) { previo.veces += 1; return; }
        porClave.set(mejor.palabra, {
          nombre: capitaliza(mejor.palabra),   // el nombre sale editable en el modal; se guarda lo que escriba el usuario
          tipo: mejor.tipo,
          linea,                                // primera línea OCR donde apareció (contexto, sólo informativo)
          veces: 1,
          idx: idxLinea
        });
      });
    });
    const conIdx = [...porClave.values()];
    conIdx.sort((a, b) => a.idx - b.idx);   // orden del documento, determinista
    return conIdx.map(({ idx, ...resto }) => resto);   // el idx es accesorio: sale fuera del contrato
  }

  // ─── Fusión con la despensa: lo que el usuario CONFIRMA (nombre editable incluido) entra así:
  //   · nombre ya en la despensa (comparación case-insensitive exacta, como el formulario manual) →
  //     se ACTUALIZA en-situ SOBRE UNA COPIA: qty y score nuevos; `min` sólo si el usuario ha puesto uno;
  //   · nombre nuevo → alta con { id, name, score, qty, min, checked:false, createdAt } (mismo shape
  //     que el formulario manual de la sección ALIMENTOS de app.js).
  // Devuelve { foods, añadidos, actualizados } — array NUEVO con objetos NUEVOS: ni el array ni los
  // alimentos de entrada del llamador se tocan (§3 pureza; la app reasigna `foods = result.foods`).
  function guardarCandidatos(despensa, seleccion, deps) {
    const uidGen = (deps && deps.uid) || (() => Math.random().toString(36).slice(2, 12));
    const ahora = (deps && deps.ahora) || Date.now();
    const validos = (Array.isArray(seleccion) ? seleccion : []).filter(c => {
      if (!String(c && c.nombre || "").trim()) return false;         // renombrado a "" → fuera
      if (!Number.isFinite(c.qty) || c.qty < 0) return false;        // la vista valida antes; esto es el último filtro
      if (!Number.isFinite(c.score) || c.score < 1 || c.score > 10) return false;
      if (c.min != null && (!Number.isFinite(c.min) || c.min < 0)) return false;
      return true;
    });
    const salida = Array.isArray(despensa) ? despensa.map(f => ({ ...f })) : [];   // copias: los originales no se tocan
    let añadidos = 0, actualizados = 0;
    validos.forEach(c => {
      const nombre = String(c.nombre).trim();
      const ya = salida.find(f => String(f.name || "").toLowerCase() === nombre.toLowerCase());
      if (ya) {
        ya.qty = Math.max(0, Math.round(c.qty));
        ya.score = Math.round(c.score);
        if (c.min != null) ya.min = Math.max(0, Math.round(c.min));
        actualizados += 1;
      } else {
        salida.push({
          id: uidGen(),
          name: nombre,
          score: Math.round(c.score),
          qty: Math.max(0, Math.round(c.qty)),
          min: c.min != null ? Math.max(0, Math.round(c.min)) : 1,
          checked: false,
          createdAt: ahora
        });
        añadidos += 1;
      }
    });
    return { foods: salida, añadidos, actualizados };
  }

  return { esMovil, extraerCandidatos, guardarCandidatos, norm, capitaliza };
});
