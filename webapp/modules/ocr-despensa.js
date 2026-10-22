// modules/ocr-despensa.js — Lógica del ESCÁNER DEL TICKET DE LA COMPRA (OCR en el navegador, #epic-ocr-despensa-camara).
// Toda la DECISIÓN del flujo vive aquí, puro y testeado (§3 CODING_STANDARDS): detectar alimentos de un
// texto OCR contra el vocabulario FOOD_TYPES, sacar la CANTIDAD comprada de cada línea del ticket, decidir
// si el dispositivo es móvil (la cámara sólo se muestra en móvil) y fusionar lo confirmado con la despensa
// existente.
//
// REGLA DE ORO (2026-10-21: la compra ya está hecha — el escáner sólo mete lo comprado en el
// "Inventario Actual" de la pestaña de Alimentos):
//   · nombre EXACTO ya en la despensa → la compra SUMA en-situ (lo que ya está, se le apila lo comprado);
//   · DUDOSO (¿es el mismo que uno de la despensa? → variantes por tokens) → se resuelve EN EL DIÁLOGO:
//     elegir variante = suma a ese alimento (su alerta queda como estaba) o "es nuevo" = alta;
//   · NUEVO (nada parecido en casa) → alta directa con el criterio definido EN el diálogo (importancia
//     y mínimo que la app no inventa).
// La lista de la compra NO participa en nada de esto: se retiró la implementación de pendientes del
// ticket (`mrcheff.compraTicket`) — su sitio son los alimentos del plan, no una compra ya hecha.
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
  //     sale en `dudosos` para que el diálogo de revisión pregunte de quién es esta compra;
  //   · nombre nuevo sin variantes → NUEVO: sale en `nuevos` para que el diálogo de revisión reciba
  //     su alta con el criterio que la persona define allí (importancia y mínimo).
  // Devuelve { foods, actualizados, directos, dudosos, nuevos } — array NUEVO con objetos NUEVOS: ni el
  // array ni los alimentos de entrada del llamador se tocan (§3 pureza; la app reasigna foods).
  // `directos` son los que casaron exacto (filas del 1er diálogo del asistente); `dudosos` y `nuevos`
  // son las secciones del 2º. Sin deps.candidatosDespensa la duda no se puede distinguir del nuevo:
  // todo lo desconocido cae en `nuevos`. El candidato puede llevar `hogar: true` (etiqueta
  // alimento/no-alimentario del ticket — modules/categoria-producto.js): viaja ADITIVAMENTE en las
  // tres salidas para que la vista la pinte y la alta la use (sin importancia ni mínimo pedido).
  function guardarCandidatos(despensa, seleccion, deps) {
    const variantes = (deps && typeof deps.candidatosDespensa === "function") ? deps.candidatosDespensa : null;
    const validos = (Array.isArray(seleccion) ? seleccion : []).filter(c => {
      if (!String(c && c.nombre || "").trim()) return false;         // renombrado a "" → fuera
      if (!Number.isFinite(c.qty) || c.qty < 0) return false;        // la vista valida antes; esto es el último filtro
      return true;
    });
    const salida = Array.isArray(despensa) ? despensa.map(f => ({ ...f })) : [];   // copias: los originales no se tocan
    let actualizados = 0;
    const directos = [], dudosos = [], nuevos = [];
    validos.forEach(c => {
      const nombre = String(c.nombre).trim();
      const etiqueta = { hogar: !!(c && c.hogar) };
      const ya = salida.find(f => String(f.name || "").toLowerCase() === nombre.toLowerCase());
      if (ya) {
        ya.qty = Math.max(0, Math.round((Number(ya.qty) || 0) + c.qty));   // el ticket SUMA a lo que había; min/score intactos
        actualizados += 1;
        directos.push({ nombre, qty: Math.max(0, Math.round(c.qty)), tipo: c.tipo || null, ...etiqueta });
      } else if (variantes && variantes(nombre, salida).length > 0) {
        // DUDOSO: "¿es el mismo que uno de la despensa?" — el diálogo de revisión pregunta.
        dudosos.push({ nombre, qty: Math.max(0, Math.round(c.qty)), tipo: c.tipo || null, ...etiqueta });
      } else {
        // NUEVO: el diálogo de revisión pide su alta con el criterio que defina la persona.
        nuevos.push({ nombre, qty: Math.max(0, Math.round(c.qty)), tipo: c.tipo || null, ...etiqueta });
      }
    });
    return { foods: salida, actualizados, directos, dudosos, nuevos };
  }

  // ─── Los PASOS del escáner (ver app.js): la persona confirma PRIMERO lo que ya tiene en casa —
  // nombres exactos, la compra suma sin preguntas— y DESPUÉS revisa el resto (nuevos y dudas) en el
  // segundo diálogo. El orden es fijo: despensa → revisar; cada paso SÓLO sale si tiene filas (un
  // ticket con todo exacto no abre el diálogo de revisión con cero filas).
  function pasosDeConfirmacion(reparto) {
    const r = reparto || {};
    const pasos = [];
    if (Array.isArray(r.directos) && r.directos.length) pasos.push("despensa");
    if ((Array.isArray(r.dudosos) && r.dudosos.length) || (Array.isArray(r.nuevos) && r.nuevos.length)) pasos.push("revisar");
    return pasos;
  }

  // ─── CONFIRMAR LA REVISIÓN (2º diálogo del escáner): lo nuevo y las dudas dejen de ser estados
  // intermedios y ACABAN EN LA DESPENSA (la compra ya está hecha, nada va a la lista de la compra):
  //   · fila con `varianteId` (duda resuelta: "es ESE alimento de casa") → SUMA de qty sobre COPIA
  //     en-situ; su min/importancia quedan como estaban (igual que los exactos del paso 1);
  //   · fila sin variante (nueva, o duda resuelta como nueva) → ALTA con { nombre, qty, score, min }
  //     tal cual se definieron EN el diálogo; si su nombre casa EXACTO (case-insensitive, como el
  //     formulario manual) con un alimento ya en casa, suma en su lugar en vez de crear un duplicado;
  //   · filas sin nombre válido se saltan — la vista valida antes; esto es el filtro final.
  // Los productos de HOGAR (`hogar: true`) no pidieron criterio en el diálogo (petición del
  // usuario): alta con score 5 (urgencia neutra) y min 0 (avisa cuando se acabe) y el tag
  // `categoria: "hogar"` en el food — el resto de la app los deja fuera de recetas/menús/lista.
  // Devuelve { foods, creados, sumados }: nombres de las altas y de las sumas (el aviso de la vista
  // los cuenta). Array NUEVO con objetos NUEVOS: la despensa de entrada no se toca (§3). uid/ahora
  // INYECTADOS (§6): nada de reloj ni random propios.
  function confirmarRevision(despensa, nuevas, dudas, deps) {
    const salida = (Array.isArray(despensa) ? despensa : []).map(f => ({ ...(f || {}) }));
    const creados = [], sumados = [];
    const entero = v => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) ? n : null;
    };

    function alta(d) {
      const nombre = String(d && d.nombre || "").trim();
      if (!nombre) return null;
      const esHogar = !!(d && d.hogar);
      const qty = Math.max(0, entero(d.qty) != null ? entero(d.qty) : 1);
      const score = (v => Number.isFinite(v) ? Math.min(10, Math.max(1, v)) : 5)(entero(d.score));
      const minDefecto = esHogar ? 0 : 1;
      const min = Math.max(0, entero(d.min) != null ? entero(d.min) : minDefecto);
      const ya = salida.find(f => String(f.name || "").toLowerCase() === nombre.toLowerCase());
      if (ya) {
        ya.qty = Math.max(0, Math.round((Number(ya.qty) || 0) + qty));
        return { sumado: ya.name };
      }
      const food = { id: String((deps && deps.uid)()), name: nombre, score, qty, min, checked: false, createdAt: (deps && deps.ahora) || 0 };
      if (esHogar) food.categoria = "hogar";
      salida.push(food);
      return { creado: nombre };
    }

    (Array.isArray(nuevas) ? nuevas : []).forEach(d => {
      const resultado = alta(d);
      if (!resultado) return;
      if (resultado.creado) creados.push(resultado.creado);
      else sumados.push(resultado.sumado);
    });
    (Array.isArray(dudas) ? dudas : []).forEach(d => {
      if (!d) return;
      const varianteId = d.varianteId != null ? String(d.varianteId) : "";
      if (varianteId) {
        // Resuelta con lo ya vivido: la compra entra en ese alimento, sin tocar su alerta.
        const objetivo = salida.find(f => String(f.id || "") === varianteId);
        if (objetivo) {
          const qty = Math.max(0, entero(d.qty) != null ? entero(d.qty) : 1);
          objetivo.qty = Math.max(0, Math.round((Number(objetivo.qty) || 0) + qty));
          sumados.push(String(objetivo.name));
          return;
        }
        // id que ya no existe (despensa cambiada en medio): cae como alta de la fila.
      }
      const resultado = alta(d);
      if (!resultado) return;
      if (resultado.creado) creados.push(resultado.creado);
      else sumados.push(resultado.sumado);
    });
    return { foods: salida, creados, sumados };
  }

  // ─── Datos de la DEMO del escáner dentro del tutorial (petición 2026-10-22): un ticket de
  // ejemplo con tres casos — UN EXACTO (¿"Leche entera" ya en casa?: diálogo 1), UNA DUDA
  // ("YOGUR" casa con "Yogur natural" por tokens: desplegable de variantes) y UN NUEVO de
  // HOGAR ("GEL HIGIEN": el conmutador 🍎/🏠 sale preseleccionado). La despensa es de juguete
  // y vive AQUI porque es data del dominio, testeado: el reparto real sobre ella sale
  // ["despensa", "revisar"] — los DOS diálogos que enseña la visita guiada. Cada llamada
  // devuelve clones frescos: la app de demo no puede mutar esta fuente.
  const DESPENSA_DEMO = [
    { id: "demo-leche", name: "Leche entera", score: 6, qty: 1, min: 2, checked: false, createdAt: 0 },
    { id: "demo-yogur", name: "Yogur natural", score: 7, qty: 2, min: 3, checked: false, createdAt: 0 },
  ];
  const TEXTO_DEMO = "2 LECHE ENTERA 1,29\n2 YOGUR 1,15\n1 GEL HIGIEN 2,90";

  function datosDemoEscaner() {
    return { texto: TEXTO_DEMO, despensa: DESPENSA_DEMO.map(f => ({ ...f })) };
  }

  return { esMovil, esHeic, extraerCandidatos, guardarCandidatos, pasosDeConfirmacion, confirmarRevision, datosDemoEscaner, norm, capitaliza };
});
