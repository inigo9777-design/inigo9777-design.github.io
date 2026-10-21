// modules/ocr-ticket-parser.js — PARSER ESTRUCTURAL del TICKET (requisito 95% de ítems, épica
// ocr-despensa-camara). Hasta ahora el escáner sólo encontraba lo que el vocabulario FOOD_TYPES
// conocía (~120 palabras — el pico del iceberg) y colapsaba variantes al mismo término; aquí el
// ticket se LEE por líneas ancladas a lo que mejor casa el OCR: los PRECIOS.
//
// Formato real (corpus en reports/OCR, texto volcado por e2e/ocr-inspeccion.mjs):
//   · MERCADONA — cada línea de producto empieza por la CANTIDAD y acaba en dinero:
//       "2 BEBIDA AVELLANAS   2,50" · "4 BEBIDA COCO 1,60 6,40" (unit + total) · "1H. CORDERO… 3,50";
//     los echos de cantidades perdidas no matan el ítem (el nombre ya sobra para el diálogo).
//   · ALDI — la cantdad/peso viajan en una línea AUXILIAR ANTERIOR que se empareja con el producto:
//       "4x 1,73 €" → qty 4 · "0,680 kg x 13,99 €/kg" → granel (se convierte a lotes de 500 g) ·
//       "SPECIAL COSTILLAR 9,51 €3" (la letra tras el precio es el código de IVA de ALDI, ruido).
//   · Descuentos ("Desc. -0,19 €") y todo lo reservado de cabecera/pie (MERCADONA, TELÉFONO, TOTAL,
//     IVA, TARJETA, FECHA, GRACIAS…) se descartan con su motivo, nunca contaminan al producto.
// La salida son ITEMS con lo que la persona ya puede revisar/editar en los diálogos: un producto
// que no casara con la despensa NO SE PIERDE — va como "nuevo" (alta con criterio definido allí),
// y los de PESO entran en lotes de 500 g con el sufijo "(500gr)" (petición del usuario: 1,5 kg →
// 3 unidades, nombre "Carne picada (500gr)", vale para cualquier alimento a peso).
// Módulo PURO (§3): sin DOM sin localStorage; el OCR crudo entra, los ítems salen.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;   // Jest / Node
  root.MRCheff = root.MRCheff || {};
  Object.assign(root.MRCheff, { ticketParser: api });
})(typeof self !== "undefined" ? self : this, function () {

  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // ─── PALABRAS RESERVADAS de cabecera/pie (se descartan con motivo, no son productos). Los acentos
  // fuera: comparamos en norma. La fecha y el "%" cubren los resúmenes de IVA de ambas cadenas.
  const RESERVADAS = [
    "mercadona", "hacendado", "descr", "telefono", "factura", "imp", "base", "cuota", "total",
    "tarj", "visa", "debit", "credit", "import", "aut", "arc", "aid", "horario", "apertura",
    "gracias", "cambi", "efectivo", "promoc", "desc", "ticket", "caja", "operador", "nif", "cif",
    "fecha", "pago", "saldo", "listado", "contiene su nombre"
  ];
  const FECHA = /\d{1,2}\s*[/.\-]\s*\d{1,2}\s*[/.\-]\s*\d{2,4}/;
  // Código de IVA de ALDI pegado al precio ("9,51 €3"): una letra/dígito tras el símbolo.
  const CODIGO_TRAS_EURO = /[€E]\s*[a-zA-Z0-9]?\s*$/;

  // ─── MUROS de línea auxiliar. Peso (granel): "0,680 kg x 13,99 €/kg" (el "x" a veces lo come el
  // OCR — "0,267 kg 39,95 €/kg" — y la x puede venir doblada "xX"). Cantidad: "4x 1,73 €" / "2x 1,43€"
  // (sin letras reales entre medias — "2 XADO? €" con letras grandes NO es auxiliar y muere como
  // producto sin precio).
  const PESO = /^-?\d+(?:[.,]\d+)?\s*kg\b(?:\s*[xXx]{1,3}\s*\d+(?:[.,]\d+)?)?\s*(?:€|e)?\s*(?:\/?\s*kg)?\s*[a-z]?\s*$/i;
  const kgDe = linea => {
    const m = linea.match(/^(-?\d+(?:[.,]\d+)?)/);
    return m ? parseFloat(m[1].replace(",", ".")) : null;
  };
  const CANTIDAD_AUX = /^(\d{1,3})\s*[xXx]{1,3}\s*(\d+(?:[.,]\d+)?)?\s*(?:€|e)?\s*$/;
  // VERSIÓN FLOJA para ALDI (calibrada con el corpus, "2 XADO? €" = mangle de "2x 1,5?"): la cifra
  // y la x sobreviven aunque el precio venga comido. Residuo corto (≤9) EN MAYÚSCULAS o sin letras
  // ("ADO", "€") — una línea con palabra larga tipo "4 x EXTRA" no es auxiliar y muere como producto.
  const PACK_FLOJO = /^(\d{1,3})\s*[x×X]\s*[\p{Lu}\W]{1,9}$/u;
  // Cifra numerica decimal del ticket: "9,51" "6.72" "3,5" (1-2 decimales), también pegada al €/e.
  const PRECIO_STD = /(\d+(?:[.,]\d{1,2}))\b/g;
  // Precio DEGRADADO por el OCR ("375eZ" de "3,75", "41€" de "4,10 €"): 2-3 dígitos sin separador
  // justo al final con el símbolo comido — sólo se acepta cuando no queda precio estándar.
  const PRECIO_DEGRADADO = /(\d{2,4})\s*(?:€|[eE][zZ]?|[eE])\s*$/;

  const tieneLetras = s => /[A-ZÁÉÍÓÚÑÜa-z]/.test(s);
  const tokensDe = s => String(s || "").split(/\s+/).filter(Boolean);
  const esReservada = linea => {
    const n = norm(linea);
    return n.includes("%") || FECHA.test(linea) || RESERVADAS.some(p => n.includes(p));
  };

  // ─── LOTERÍA del granel → 500 g (petición del usuario): 0,5 kg = 1 lote, 1,5 kg = 3, y un peso
  // mínimo de 1 lote aunque la cifra del OCR sea basura; redondeo al lote más cercano.
  const LOTE_GR = 500;
  function unidadesDePeso(kg) {
    const n = Math.round((Number(kg) || 0) * 1000 / LOTE_GR);
    return Math.max(1, n);
  }

  // ─── NOMBRE del ítem desde el prefijo (todo antes del precio): sólo tokens con ≥2 letras, así
  // caen los ruidos de una letra ("a UU", "y", "ñ", "E") y quedan "BEBIDA AVELLANAS" o "MC TAPADA".
  function nombreDePrefijo(prefijo) {
    const limpio = String(prefijo || "").replace(/^[\s:;,.|—\-–]+/, "");
    let tokens = tokensDe(limpio)
      .map(t => t.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ""))     // la coma pegada del OCR fuera
      .filter(t => /[A-ZÁÉÍÓÚÑÜ]{2,}|[a-záéíóúñü]{2,}/i.test(t) && tieneLetras(t));
    // BASURA DE CABEZA: el OCR mete residuos de 1-2 letras delante del nombre ("BE LOBICHA…",
    // "y RA…"); mientras queden ≥2 tokens reales detrás, se botan — nunca el único recuerdo.
    while (tokens.length >= 2 && tokens[0].replace(/[^\p{L}]/gu, "").length <= 2) tokens = tokens.slice(1);
    return tokens.join(" ").trim();
  }

  // ─── EXTRAER (precio, unit, descuento) del TALÓN de la línea: el último precio estándar es el
  // total; el penúltimo (si hay dos) la unidad; si el carácter previo es "-" es un descuento. Con
  // ninguna cifra estándar se prueba la degradada — siempre ADJUDICADA con posición para cortar el
  // nombre ANTES del precio y no tragarse los códigos de IVA.
  function precioDeTalon(cola) {
    const m2 = [...String(cola || "").matchAll(PRECIO_STD)];
    const lanzadas = m2.filter(m => !/-\s*$/.test(String(cola).slice(Math.max(0, m.index - 1), m.index)));
    if (lanzadas.length) {
      const total = lanzadas[lanzadas.length - 1];
      const unit = lanzadas.length >= 2 ? lanzadas[lanzadas.length - 2] : null;
      return {
        precio: parseFloat(total[1].replace(",", ".")),
        pos: total.index,
        unit: unit ? parseFloat(unit[1].replace(",", ".")) : null,
        degradado: false
      };
    }
    const mD = String(cola || "").match(PRECIO_DEGRADADO);
    if (mD) {
      const v = parseInt(mD[1], 10);
      if (Number.isFinite(v) && v >= 20 && v <= 999)   // "375"→3,75; "41"→? — el 2-dígito puro NO
        return { precio: v / 100, pos: mD.index, unit: null, degradado: true };
    }
    return null;
  }

  // ─── CANTIDAD inicial de la línea (Mercadona): la columna de qty es el primer token ENTERO, pero
  // el OCR a veces pone basura de una letra delante ("a     3 PAÑUELO", "E     1 ATUN…") y a veces
  // pega cifra+nombre ("1H. CORDERO…"). Escaneo de tokens: salto la basura, me quedo el primer
  // entero 1-99 y PARO en la primera cifra decimal (ahí empieza el dinero, no la cantidad).
  function qtyInicial(linea) {
    for (const t of tokensDe(String(linea || ""))) {
      const solo = t.replace(/^[^\dA-Za-zÁÉÍÓÚÑÜáéíóúñü]+/, "").replace(/[^\dA-Za-zÁÉÍÓÚÑÜáéíóúñü]+$/, "");
      if (!/\d/.test(solo) && solo.length <= 1) continue;                 // basura suelta del OCR
      if (/^\d{1,2}$/.test(solo)) {                                       // "3", "02"→entero del ticket
        const n = parseInt(solo, 10);
        return n >= 1 && n <= 99 ? n : null;
      }
      if (/^\d+[.,]\d/.test(solo)) return null;                           // "2,05": aquí está el dinero
      const pegada = solo.match(/^(\d{1,2})(?=[A-ZÁÉÍÓÚÑÜa-z])/);          // "1H." / "2BEBIDA"
      if (pegada) {
        const n = parseInt(pegada[1], 10);
        return n >= 1 && n <= 99 ? n : null;
      }
      return null;                                                        // primer token real sin cifra inicial
    }
    return null;
  }

  // ─── PARSE: texto OCR completo → { origen, items[], descartadas[] }. El origenanson SOLO cambia
  // las palabras reservadas de cabecera/pie; las reglas de línea son las mismas (aunque Mercadona
  // exige su cantidad inicial para sobrevivir sin precio — su ticket pierde sumas por el OCR).
  const ORIGENES = {
    mercadona: { clave: ["mercadona", "factura simplificada", "hacendado"], sinPrecioConQty: true },
    aldi: { clave: ["aldi", "horario de apertura", "lu.-sa"] },
    generico: {}
  };
  function detectarOrigen(texto) {
    const n = norm(texto);
    for (const [nombre, def] of Object.entries(ORIGENES)) {
      if ((def.clave || []).some(k => n.includes(k))) return nombre;
    }
    return "generico";
  }

  function parsearTicket(texto) {
    const origen = detectarOrigen(texto);
    const regla = ORIGENES[origen] || ORIGENES.generico;
    const lineas = String(texto || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);

    const items = [], descartadas = [];
    let aux = null;                       // la línea de peso/cantidad pendiente de su producto

    lineas.forEach(linea => {
      if (esReservada(linea)) { aux = null; descartadas.push({ linea, motivo: "cabecera/pie reservado" }); return; }
      if (PESO.test(linea)) { aux = { ...(aux || {}), pesoKg: kgDe(linea) }; descartadas.push({ linea, motivo: "peso del granel (apuntado)" }); return; }
      const mAuxQty = linea.match(CANTIDAD_AUX);
      if (mAuxQty && !tieneLetrasReal(linea.slice(0, mAuxQty.index || 0))) {
        const qty = parseInt(mAuxQty[1], 10);
        if (qty >= 1 && qty <= 99) {
          aux = { ...(aux || {}), qtyLinea: qty };
          descartadas.push({ linea, motivo: "cantidad del pack (apuntada)" });
          return;
        }
      }
      // ALDI con el símbolo de pack meado por el OCR: la cifra y la x BASTAN para apuntar la
      // cantidad del producto que viene debajo ("2 XADO? €" — el corpus la lee así de "2x 1,5?").
      if (origen === "aldi") {
        const mFlojo = linea.match(PACK_FLOJO);
        if (mFlojo) {
          const qty = parseInt(mFlojo[1], 10);
          if (qty >= 1 && qty <= 99) {
            aux = { ...(aux || {}), qtyLinea: qty };
            descartadas.push({ linea, motivo: "cantidad del pack (apuntada, mangle suelto)" });
            return;
          }
        }
      }
      const talon = precioDeTalon(linea);
      if (talon && talon.degradado) {
        // Precio degradado: exige además el código de IVA/símbolo pegado — "375eZ" pasa, "230" (talla
        // del paquete de pizza) no, porque no trae restos del símbolo.
        if (!CODIGO_TRAS_EURO.test(linea.slice(talon.pos)) && !/[€Ez]\s*$/i.test(linea.slice(talon.pos))) {
          descartadas.push({ linea, motivo: talon ? "sin precio legible" : "sin precio" });
          return;
        }
      }
      const qtyInicialDeLinea = qtyInicial(linea);
      // MERCADONA sobrevive sin precio si la línea nace de la columna de cantidad; ALDI/generico
      // exigen precio (su formato lo contiene SIEMPRE — el eco de cifras no mienta productos).
      // Único rescate sin precio fuera de Mercadona: una línea MAYÚSCULA de producto cuyo dinero
      // el OCR se comió entero ("ECO PATATA MALLA 2KG KO" — ≥3 tokens y ≥2 en mayúsculas), nunca
      // líneas cortas tipo "EX IDA" (2 tokens) ni texto en minúsculas de una nevera fotografiada.
      // SÍ se rescata con la línea de PESO pendiente: el granel de ALDI ("PIMIENTO DULCE ITALIAN
      // 077201€") lleva SU precio mangleado, pero el peso de arriba es SU cantidad (no viaja).
      // En MERCADONA NUNCA rescata: la columna de cantidad sostiene sus líneas y el rescate de
      // mayúsculas es demasiado generoso con la cabecera FIJA en 100% mayúsculas ("CL ALBERT
      // EINSTEIN, 13" — dirección de tienda que el OCR de la cabecera lee como producto).
      const rescateAlfa = !talon && !(regla.sinPrecioConQty && qtyInicialDeLinea && tieneLetrasReal(linea)) &&
        origen !== "mercadona" &&
        (() => {
          const limpios = tokensDe(linea);
          // la cabecera ESPEJO de ALDI (el papel casi volteado se lee invertido) trae tokens con
          // el dígito ENTRE letras ("oj9EjUOO", "ElJUO9"→"ElJUO"): un nombre del ticket NO — las
          // cifras de producto van SUELTAS al final ("FINA, 230", "MALLA 2KG") o pegadas (“1H.”).
          if (limpios.some(t => /\p{L}\d+\p{L}/u.test(t))) return false;
          const mayus = limpios.filter(t => /^[A-ZÁÉÍÓÚÑÜ]{2,}$/.test(t.replace(/[^\p{L}]/gu, "")));
          return mayus.length >= 2 && limpios.filter(t => /[A-ZÁÉÍÓÚÑÜ]{2,}/.test(t)).length >= 3;
        })();
      if (!talon && !(regla.sinPrecioConQty && qtyInicialDeLinea && tieneLetrasReal(linea)) && !rescateAlfa) {
        aux = null;                        // la auxiliar pendiente era de ESTE producto fallido: no viaja
        descartadas.push({ linea, motivo: "sin precio legible" });
        return;
      }
      const nombreLeido = nombreDePrefijo(talon ? linea.slice(0, talon.pos) : linea);
      if (!nombreLeido || nombreLeido.length < 3) {
        aux = null;
        descartadas.push({ linea, motivo: "sin nombre legible" });
        return;
      }
      // CANTIDAD: la línea inicial manda; en su falta, la auxiliar del pack; con granel, el peso
      // convertido a lotes de 500 g; si ni eso, la pareja unit×total del propio talón.
      let qty = qtyInicialDeLinea;
      let pesoKg = null;
      let nombre = nombreLeido;
      if (aux && aux.pesoKg != null) {
        pesoKg = aux.pesoKg;
        qty = unidadesDePeso(pesoKg);
        nombre = nombre + " (500gr)";
      } else if (aux && aux.qtyLinea) {
        qty = aux.qtyLinea;
      } else if (!qty && talon && talon.unit && talon.precio) {
        const porPareja = Math.round(talon.precio / talon.unit);
        if (Number.isFinite(porPareja) && porPareja >= 1 && porPareja <= 99) qty = porPareja;
      }
      if (!Number.isFinite(qty) || qty < 1) qty = 1;
      items.push({
        nombre,
        qty,
        precio: talon ? talon.precio : null,
        precioUnit: talon ? talon.unit : null,
        pesoKg,
        linea: linea,                       // cruda: clave del eco EXACTA ("LoMO…"≠"LOMO…" — 2 compras reales)
        origen
      });
      aux = null;                          // consumida: la siguiente auxiliar arranca limpia
    });

    // Echos del OCR (la MISMA línea impresa dos veces por el motor): nos quedamos con la PRIMERA —
    // sumar cantidades multiplicaría una compra de una vez. La clave es la LÍNEA CRUDA exacta:
    // "1 LoMO CEBO IBÉRICO 6,21" y "1 LOMO CEBO IBÉRICO 6,21" (corpus Mercadona) son DOS compras
    // reales del mismo producto; sólo el duplicado byte a byte es eco.
    const vistas = new Set();
    const sinEcho = [];
    items.forEach(item => {
      if (vistas.has(item.linea)) { descartadas.push({ linea: item.linea, motivo: "echo del OCR (duplicado)" }); return; }
      vistas.add(item.linea);
      sinEcho.push(item);
    });
    return { origen, items: sinEcho.map(({ linea, ...resto }) => resto), descartadas };
  }

  function tieneLetrasReal(s) {
    return tokensDe(String(s || "")).filter(t => /[A-ZÁÉÍÓÚÑÜ]{2,}|[a-záéíóúñü]{2,}/i.test(t)).length >= 2;
  }

  return { parsearTicket, detectarOrigen, unidadesDePeso, nombreDePrefijo, precioDeTalon, qtyInicial, RESERVADAS, LOTE_GR };
});
