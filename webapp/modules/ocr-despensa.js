// modules/ocr-despensa.js — Lógica del ESCÁNER DEL TICKET DE LA COMPRA (OCR en el navegador, #epic-ocr-despensa-camara).
// Toda la DECISIÓN del flujo vive aquí, puro y testeado (§3 CODING_STANDARDS): detectar alimentos de un
// texto OCR contra el vocabulario FOOD_TYPES, sacar la CANTIDAD comprada de cada línea del ticket, decidir
// si el dispositivo es móvil (la cámara sólo se muestra en móvil) y fusionar lo confirmado con la despensa
// existente. LA REGLA DE ORO (petición 2026-10-20): NADA del ticket entra en la despensa por su cuenta —
//   · nombre EXACTO ya en la despensa → la compra SUMA en-situ (lo que ya está, se le apila lo comprado);
//   · DUDOSOS (¿es el mismo que uno de la despensa? → variantes por tokens) → pendientes del ticket;
//   · NUEVOS (nada parecido en casa) → pendientes del ticket SIN DEFINIR (fade + aviso) hasta que la
//     persona fije IMPORTANCIA y MÍNIMO — editables desde la propia fila — con definirTicketPendiente;
//     entonces la fila queda normal, lista para resolverse con 🛒 Despensa? o ✅ comprado.
// Los pendientes viven en la LISTA DE LA COMPRA, arriba de todo. La imagen (el "cómo se saca la
// foto") y el motor Tesseract.js son infra de vista → app.js.
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

  // ─── ¿La foto llega en HEIC/HEIF? El formato POR DEFECTO de la cámara del iPhone (y algún ".png"
  // mal etiquetado que en realidad es HEIF — la vista detecta ese camuflado al fallar el decodificador).
  // Los navegadores de base Chromium no decodifican HEIC: el canvas y el motor del OCR se quedan a
  // cero ("No se ha podido escanear la foto"). La vista convierte esos ficheros a JPEG ANTES de darlos
  // al OCR. Chequeo PURO sobre nombre y tipo del fichero — nada de lectura ni I/O.
  function esHeic(archivo) {
    const nombre = String((archivo && archivo.name) || "").toLowerCase();
    const tipo = String((archivo && archivo.type) || "").toLowerCase();
    return tipo.includes("heic") || tipo.includes("heif") || nombre.endsWith(".heic") || nombre.endsWith(".heif");
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

  // ─── Fusión con la despensa: lo que el usuario CONFIRMA (nombre editable incluido) se reparte en
  // tres salidas — y NINGUNA alta se hace sola (la despensa no se inventa alimentos):
  //   · nombre YA en la despensa (comparación case-insensitive exacta, como el formulario manual) →
  //     se AÑADE la compra sobre UNA COPIA en-situ: qty = la que había + la comprada (el ticket
  //     dice lo que ENTRA en casa, no la pisa). Su min/importancia se QUEDAN COMO ESTÁN: ya eran
  //     decisiones de la persona sobre ese alimento, el escaneo no las toca;
  //   · nombre con VARIANTES en la despensa (los mismos que el botón "🛒 Despensa?" de la lista: se
  //     inyectan vía deps.candidatosDespensa, la misma máquina del módulo menu-semanal) → DUDOSO:
  //     sale en `dudosos` como pendiente del ticket (fila normal, con su botón);
  //   · nombre nuevo sin variantes → NUEVO: sale en `nuevos` con faltaDefinir:true como pendiente
  //     SIN DEFINIR (fila atenuada + aviso) — la importancia (prioridad) y el mínimo se deciden
  //     DESPUÉS, editables desde la propia fila, y sólo entonces queda lista para la despensa.
  // El modal de confirmación ya no pide min/importancia: la cantidad es lo único que sabe el
  // ticket; los criterios de alerta se fijan donde corresponden (la lista de la compra).
  // Devuelve { foods, actualizados, dudosos, nuevos } — array NUEVO con objetos NUEVOS: ni el
  // array ni los alimentos de entrada del llamador se tocan (§3 pureza; la app reasigna foods).
  // Sin deps.candidatosDespensa la duda no se puede distinguir del nuevo: todo lo desconocido cae
  // en `nuevos` (pendiente sin definir) — nadie entra en la despensa sin su veredicto.
  function guardarCandidatos(despensa, seleccion, deps) {
    const variantes = (deps && typeof deps.candidatosDespensa === "function") ? deps.candidatosDespensa : null;
    const validos = (Array.isArray(seleccion) ? seleccion : []).filter(c => {
      if (!String(c && c.nombre || "").trim()) return false;         // renombrado a "" → fuera
      if (!Number.isFinite(c.qty) || c.qty < 0) return false;        // la vista valida antes; esto es el último filtro
      return true;
    });
    const salida = Array.isArray(despensa) ? despensa.map(f => ({ ...f })) : [];   // copias: los originales no se tocan
    let actualizados = 0;
    const dudosos = [], nuevos = [];
    validos.forEach(c => {
      const nombre = String(c.nombre).trim();
      const ya = salida.find(f => String(f.name || "").toLowerCase() === nombre.toLowerCase());
      if (ya) {
        ya.qty = Math.max(0, Math.round((Number(ya.qty) || 0) + c.qty));   // el ticket SUMA a lo que había; min/score intactos
        actualizados += 1;
      } else if (variantes && variantes(nombre, salida).length > 0) {
        // DUDOSO: "¿es el mismo que uno de la despensa?" — pendiente con su botón en la lista.
        dudosos.push({ nombre, qty: Math.max(0, Math.round(c.qty)), tipo: c.tipo || null });
      } else {
        // NUEVO: no entra todavía — falta la decisión de importancia y mínimo (ver header).
        nuevos.push({ nombre, qty: Math.max(0, Math.round(c.qty)), tipo: c.tipo || null, faltaDefinir: true });
      }
    });
    return { foods: salida, actualizados, dudosos, nuevos };
  }

  // ─── Pendientes DEL TICKET en la lista de la compra: dudosos y nuevos entran como filas en la
  // parte SUPERIOR —en el ORDEN DEL TICKET, el lote no se invierte— con { nombre, qty, tipo,
  // escaneadoEn, faltaDefinir, min, score } y salen en cuanto se resuelven (🛒 Despensa? o
  // ✅ comprado, decidido igual que cualquier fila de la lista). Dedup por nombre normalizado:
  // re-escanear lo mismo lo ACTUALIZA (qty nueva) y lo re-promueve arriba, no lo duplica. Los
  // estados "sin definir" (faltaDefinir) y la pareja min/score viajan CON la fila.
  function añadirTicketPendientes(pendientes, entrantes, ahora) {
    const marca = ahora != null ? ahora : Date.now();
    const lista = (Array.isArray(pendientes) ? pendientes : [])
      .filter(p => p && String(p.nombre || "").trim())
      .map(p => ({
        nombre: String(p.nombre).trim(),
        qty: Number.isFinite(p.qty) ? Math.max(0, Math.round(p.qty)) : 1,
        tipo: p.tipo || null,
        escaneadoEn: p.escaneadoEn != null ? p.escaneadoEn : marca,
        faltaDefinir: p.faltaDefinir === true,
        min: p.min != null && Number.isFinite(p.min) ? Math.max(0, Math.round(p.min)) : null,
        score: p.score != null && Number.isFinite(p.score) ? Math.min(10, Math.max(1, Math.round(p.score))) : null
      }));
    const entrada = [];
    (Array.isArray(entrantes) ? entrantes : []).forEach(nuevo => {
      const nombre = String((nuevo && nuevo.nombre) || "").trim();
      if (!nombre) return;
      const previa = lista.find(p => norm(p.nombre) === norm(nombre));
      entrada.push({
        nombre,
        qty: Number.isFinite(nuevo && nuevo.qty) ? Math.max(0, Math.round(nuevo.qty)) : 1,
        tipo: (nuevo && nuevo.tipo) || null,
        escaneadoEn: marca,
        // la DECISIÓN de la persona es sticky: faltaDefinir y su pareja min/score ya definidos
        // sobreviven al re-escaneo (sólo la qty nueva del ticket y la posición se refrescan)
        faltaDefinir: previa ? previa.faltaDefinir : !!(nuevo && nuevo.faltaDefinir),
        min: previa ? previa.min
          : (nuevo && nuevo.min != null && Number.isFinite(nuevo.min)) ? Math.max(0, Math.round(nuevo.min)) : null,
        score: previa ? previa.score
          : (nuevo && nuevo.score != null && Number.isFinite(nuevo.score)) ? Math.min(10, Math.max(1, Math.round(nuevo.score))) : null
      });
    });
    // Los del ticket ARRIBA, EN EL ORDEN DEL TICKET (lote sin invertir); fuera los deduplicados.
    const claves = new Set(entrada.map(e => norm(e.nombre)));
    const resto = lista.filter(p => !claves.has(norm(p.nombre)));
    return [...entrada, ...resto];
  }

  // ─── Definir un pendiente: la persona fija IMPORTANCIA (prioridad, 1–10) y MÍNIMO desde la propia
  // fila (ver filaTicket en app.js); con ello la fila pierde el estado "sin definir" —se va el fade
  // y el aviso— y queda como pendiente normal, lista para resolverse con 🛒 Despensa? o ✅ comprado
  // (ese diálogo abrirá ya pre-cargado con estos valores). Min ausente → 1 (el mínimo clásico del
  // alta manual); score es OBLIGATORIO válido — si no, nada cambia (definido:false).
  function definirTicketPendiente(pendientes, nombre, definicion) {
    const score = definicion && Number.isFinite(definicion.score) ? Math.min(10, Math.max(1, Math.round(definicion.score))) : null;
    const min = definicion && Number.isFinite(definicion.min) ? Math.max(0, Math.round(definicion.min)) : 1;
    const copia = (Array.isArray(pendientes) ? pendientes : []).map(p => ({ ...(p || {}) }));
    if (score == null) return { lista: copia, definido: false };
    const clave = norm(nombre);
    let encontrado = false;
    const lista = copia.map(p => {
      if (norm(p.nombre) === clave) { encontrado = true; return { ...p, faltaDefinir: false, min, score }; }
      return p;
    });
    return { lista, definido: encontrado };
  }

  function quitarTicketPendiente(pendientes, nombre) {
    const clave = norm(nombre);
    const lista = (Array.isArray(pendientes) ? pendientes : []).filter(p => norm(p && p.nombre) !== clave);
    return { lista, quitado: lista.length !== (Array.isArray(pendientes) ? pendientes.length : 0) };
  }

  return { esMovil, esHeic, extraerCandidatos, guardarCandidatos, añadirTicketPendientes, definirTicketPendiente, quitarTicketPendiente, norm, capitaliza };
});
