// modules/ocr-despensa.js — Lógica del ESCÁNER DEL TICKET DE LA COMPRA (OCR en el navegador, #epic-ocr-despensa-camara).
// Toda la DECISIÓN del flujo vive aquí, puro y testeado (§3 CODING_STANDARDS): detectar alimentos de un
// texto OCR contra el vocabulario FOOD_TYPES, sacar la CANTIDAD comprada de cada línea del ticket, decidir
// si el dispositivo es móvil (la cámara sólo se muestra en móvil) y fusionar lo confirmado con la despensa
// existente — separando lo CLARO (entra ya) de los DUDOSOS (¿es el mismo que uno de la despensa? → no
// entran: quedan como pendientes del ticket en la LISTA DE LA COMPRA, arriba con "🛒 Despensa?").
// La imagen (el "cómo se saca la foto") y el motor Tesseract.js son infra de vista → app.js.
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

  // ─── parseaCantidad: la CANTIDAD comprada que viaja en la línea del ticket. Patrones (case-insens):
  //   A) cifra + UNIDAD DE CUENTA — "2 x Leche", "3 UD Huevos", "2 bolsas Cebolla", "1 brik Leche";
  //   B) cifra al FINAL con x — "Yogur x4", "Tomates x2";
  //   C) la línea EMPIEZA con cifra seguida de letra — "2 Leche entera" (muy común en tickets).
  // Ignora a propósito los pesos del ENVASE ("500 g", "1 kg", "1L" — no es "cuántas unidades llevas")
  // y los precios ("1,29 €": la cifra no va pegada a una letra ni a una unidad de cuenta). Devuelve
  // la cifra redondeada a entero (los decimales del peso no son unidades; en el modal se sube/baja) o null.
  function parseaCantidad(linea) {
    const t = String(linea || "");
    const NUM = "\\d+(?:[.,]\\d+)?";
    // unidades de CUENTA, unidades de peso/volumen (g/kg/l: esas hablan del envase, no de la compra)
    const UDS = "x|ud|uds|uni|unid(?:ad(?:es)?)?|u|pz|pzas?|paq(?:uetes?)?|briks?|bolsas?|latas?|cajas?|botellas?";
    const busca = re => (t.match(re) || [])[1];
    let n = busca(new RegExp(NUM + "\\s*(?:" + UDS + ")\\b", "i"));
    if (n == null) n = busca(new RegExp("\\bx\\s*(" + NUM + ")\\s*$", "i"));
    if (n == null) n = busca(new RegExp("^(" + NUM + ")\\s+[a-záéíóúñüA-Z]", ""));
    if (n == null) return null;
    const v = Math.round(parseFloat(String(n).replace(",", ".")));
    if (!Number.isFinite(v) || v < 1 || v > 999) return null;
    return v;
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
          qty: parseaCantidad(linea),          // la cantidad comprada que viajaba en ESA línea (null si no se leía)
          veces: 1,
          idx: idxLinea
        });
      });
    });
    const conIdx = [...porClave.values()];
    conIdx.sort((a, b) => a.idx - b.idx);   // orden del documento, determinista
    return conIdx.map(({ idx, ...resto }) => resto);   // el idx es accesorio: sale fuera del contrato
  }

  // ─── Fusión con la despensa: lo que el usuario CONFIRMA (nombre editable incluido) se reparte:
  //   · nombre YA en la despensa (comparación case-insensitive exacta, como el formulario manual) →
  //     se AÑADE la compra sobre UNA COPIA en-situ: qty = la que había + la comprada (el ticket
  //     dice lo que ENTRA en casa, no la pisca); score se fija con lo confirmado; `min` sólo si
  //     el usuario ha puesto uno;
  //   · nombre con VARIANTES en la despensa (los mismos que el botón "🛒 Despensa?" de la lista: se
  //     inyectan vía deps.candidatosDespensa, la misma máquina del módulo menu-semanal) → DUDOSO:
  //     no entra en la despensa de golpe. Sale en `dudosos` para que la vista lo ponga como
  //     pendiente del ticket EN LA LISTA DE LA COMPRA, arriba, con ese mismo botón y su
  //     comportamiento (la ÚLTIMA PALABRA la tiene la persona, no el OCR);
  //   · nombre nuevo sin variantes → alta con { id, name, score, qty, min, checked:false, createdAt }
  //     (mismo shape que el formulario manual de la sección ALIMENTOS de app.js).
  // Devuelve { foods, añadidos, actualizados, dudosos } — array NUEVO con objetos NUEVOS: ni el
  // array ni los alimentos de entrada del llamador se tocan (§3 pureza; la app reasigna foods).
  // Sin deps.candidatosDespensa la duda no se puede decidir: se cae al comportamiento antiguo
  // (alta directa) — la degradación del legado, nunca silencio confuso.
  function guardarCandidatos(despensa, seleccion, deps) {
    const uidGen = (deps && deps.uid) || (() => Math.random().toString(36).slice(2, 12));
    const ahora = (deps && deps.ahora) || Date.now();
    const variantes = (deps && typeof deps.candidatosDespensa === "function") ? deps.candidatosDespensa : null;
    const validos = (Array.isArray(seleccion) ? seleccion : []).filter(c => {
      if (!String(c && c.nombre || "").trim()) return false;         // renombrado a "" → fuera
      if (!Number.isFinite(c.qty) || c.qty < 0) return false;        // la vista valida antes; esto es el último filtro
      if (!Number.isFinite(c.score) || c.score < 1 || c.score > 10) return false;
      if (c.min != null && (!Number.isFinite(c.min) || c.min < 0)) return false;
      return true;
    });
    const salida = Array.isArray(despensa) ? despensa.map(f => ({ ...f })) : [];   // copias: los originales no se tocan
    let añadidos = 0, actualizados = 0;
    const dudosos = [];
    validos.forEach(c => {
      const nombre = String(c.nombre).trim();
      const ya = salida.find(f => String(f.name || "").toLowerCase() === nombre.toLowerCase());
      if (ya) {
        ya.qty = Math.max(0, Math.round((Number(ya.qty) || 0) + c.qty));   // el ticket SUMA a lo que había
        ya.score = Math.round(c.score);
        if (c.min != null) ya.min = Math.max(0, Math.round(c.min));
        actualizados += 1;
      } else if (variantes && variantes(nombre, salida).length > 0) {
        // DUDOSO: "¿es el mismo que uno de la despensa?" — lo lleva la lista de la compra a decidir.
        dudosos.push({ nombre, qty: Math.max(0, Math.round(c.qty)), tipo: c.tipo || null });
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
    return { foods: salida, añadidos, actualizados, dudosos };
  }

  // ─── Pendientes DEL TICKET en la lista de la compra: los dudosos entran como fila en la parte
  // SUPERIOR (nuevo escaneado arriba) con { nombre, qty, tipo, escaneadoEn } y salen en cuanto se
  // resuelven (🛒 Despensa? o ✅ comprado, decidido igual que cualquier fila de la lista). Dedup por
  // nombre normalizado: re-escanear lo mismo lo ACTUALIZA y lo sube, no lo duplica.
  function añadirTicketPendientes(pendientes, entrantes, ahora) {
    const marca = ahora != null ? ahora : Date.now();
    let lista = (Array.isArray(pendientes) ? pendientes : [])
      .filter(p => p && String(p.nombre || "").trim())
      .map(p => ({ nombre: String(p.nombre).trim(), qty: Number.isFinite(p.qty) ? Math.max(0, Math.round(p.qty)) : 1,
        tipo: p.tipo || null, escaneadoEn: p.escaneadoEn != null ? p.escaneadoEn : marca }));
    (Array.isArray(entrantes) ? entrantes : []).forEach(nuevo => {
      const nombre = String((nuevo && nuevo.nombre) || "").trim();
      if (!nombre) return;
      const qty = Number.isFinite(nuevo && nuevo.qty) ? Math.max(0, Math.round(nuevo.qty)) : 1;
      lista = lista.filter(p => norm(p.nombre) !== norm(nombre));    // re-escaneado → una sola fila (la de arriba)
      lista.unshift({ nombre, qty, tipo: (nuevo && nuevo.tipo) || null, escaneadoEn: marca });
    });
    return lista;
  }

  function quitarTicketPendiente(pendientes, nombre) {
    const clave = norm(nombre);
    const lista = (Array.isArray(pendientes) ? pendientes : []).filter(p => norm(p && p.nombre) !== clave);
    return { lista, quitado: lista.length !== (Array.isArray(pendientes) ? pendientes.length : 0) };
  }

  return { esMovil, extraerCandidatos, guardarCandidatos, añadirTicketPendientes, quitarTicketPendiente, norm, capitaliza };
});
