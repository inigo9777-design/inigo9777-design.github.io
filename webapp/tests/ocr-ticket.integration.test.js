// tests/ocr-ticket.integration.test.js — CAPA INTEGRACIÓN (CODING_STANDARDS §6) para
// #epic-ocr-despensa-camara, REWORK 2026-10-21: la compra ya está hecha → el escáner mete lo
// comprado EN el "Inventario actual" y NUNCA sale de la pestaña de Alimentos (se retiró la
// implementación de pendientes del ticket en la lista de la compra, y con ella `mrcheff.compraTicket`).
// Dos diálogos seguidos, con el reparto decidido por el módulo puro:
//   1º) EXACTOS ya en el inventario: nombre FIJO + cantidad comprada editable → al confirmar la
//       compra SUMA en-situ y sus criterios de alerta quedan como estaban;
//   2º) REVISIÓN en dos secciones — Nuevos (nombre/cantidad/IMPORTANCIA/MÍNIMO definidos EN la
//       fila, alta directa) y Dudas (desplegable "¿es ESE alimento de casa?": variante = suma y
//       sus campos de alerta se deshabilitan; "es nuevo" = alta con lo escrito en la fila).
// Cada diálogo compromete SU confirmación; Cancelar después no deshace lo ya guardado.
//
// El motor Tesseract no corre en jsdom (¿para qué?): producción delega el TEXTO leído en la misma
// función que usa el file-picker (app.js delega data.text en procesarTextoOcr), así que los tests
// inyectan el texto del ticket por la inyección §6 `window.__mrcheffProcesarTextoOcr` — el mismo
// paso exacto que la producción tras el OCR real. La foto/motor quedan cubiertos por el e2e Brave
// (e2e/ocr-despensa.mjs, Tesseract REAL contra una foto sintética).

const { bootApp } = require("./boot");

// El TEXTO es lo que el PARSER ESTRUCTURAL (modules/ocr-ticket-parser.js) ve del ticket real —
// líneas ancladas a precios. El "2 x Yogur" de la era vocabulario ya no miente producto (sin
// precio no hay línea), así que la DUDA se ejercita con "2 Yogur 1,35": el desplegable de
// variantes (port del casador de menu-semanal) es quien la conecta con «Yogur natural» de casa.
const TICKET = [
  "TICKET SUPER 20/10/2026",
  "3 Leche entera 1,29",
  "2 Yogur 1,35",
  "1 Pan 1,10",
  "TOTAL 12,40 €",
  "GRACIAS POR SU VISITA"
].join("\n");

function appConDespensa() {
  return bootApp({
    seed: {
      foods: [
        { id: "a1", name: "Yogur natural", score: 7, qty: 2, min: 3, checked: false, createdAt: 1 },
        { id: "a2", name: "Pan", score: 3, qty: 1, min: 1, checked: false, createdAt: 2 }
      ],
      recipes: [], innov: [], cooked: []
    }
  });
}

function lsFoods(window) {
  return JSON.parse(window.localStorage.getItem("mrcheff.foods") || "[]");
}

// El destello del inventario entra vía rAF (frames de ~16ms con pretendToBeVisual) y la app lo
// retira con un timer a los 2200ms. Bajo carga el frame se retrasa y un sleep fijo de 60ms
// da flake (falló 2 veces en la suite completa nunca en aislado). Sondeo con techo ~1.6s:
// SIEMPRE cae el destello antes de que el 2200ms lo retire — sondeo y 2200 nunca se crucan.
async function esperaDestello(document) {
  for (let i = 0; i < 80; i++) {
    if (document.getElementById("food-list").classList.contains("destello-suave")) return true;
    await new Promise(r => setTimeout(r, 20));
  }
  return document.getElementById("food-list").classList.contains("destello-suave");
}

describe("Escáner del ticket → los dos diálogos dentro de Alimentos (integración)", () => {
  it("el hook de inyección está disponible en el window de la app", () => {
    const { window } = appConDespensa();
    expect(typeof window.__mrcheffProcesarTextoOcr).toBe("function");
  });

  it("diálogo 1 (exactos): nombre FIJO con 'ya tienes N en el inventario' y cantidad editable; al confirmar la suma entra y pasa a la revisión", () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr(TICKET);

    // DIALOGO 1 — sólo el exacto ("Pan" ya está en casa, con la qty leída de su línea del ticket)
    expect(document.querySelector(".modal-content h2").textContent).toContain("Ya lo tienes en el inventario");
    expect(document.querySelectorAll(".modal-content .ocr-item")).toHaveLength(1);
    const fila = document.querySelector(".modal-content .ocr-item");
    expect(fila.querySelector(".ocr-nombre strong").textContent).toBe("Pan");
    expect(fila.textContent).toContain("Ya tienes 1 en el inventario");
    expect(fila.querySelector(".exact-qty").value).toBe("1");
    expect(document.querySelector("[data-revision-guardar]")).toBeNull();   // aún no: primero los exactos

    // la persona corrige la cantidad comprada y confirma SU decisión...
    fila.querySelector(".exact-qty").value = "4";
    document.querySelector("[data-confirmar-exactos]").click();

    // ...la compra SUMA en el acto (criterios intactos) y se abre la revisión
    const foods = lsFoods(window);
    expect(foods.find(f => f.name === "Pan").qty).toBe(5);                  // 1 en casa + 4 compradas
    expect(foods.find(f => f.name === "Pan").score).toBe(3);               // el criterio, sin pisar
    expect(foods).toHaveLength(2);                                          // Leche/Yogur NO entran aquí
    expect(document.querySelector(".modal-content h2").textContent).toContain("Añade lo nuevo");
  });

  it("diálogo 2: secciones NUEVOS (arriba) y DUDAS (debajo) con TODO definible en fila — acaba EN la despensa, la lista de la compra NUNCA", async () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr(TICKET);
    document.querySelector("[data-confirmar-exactos]").click();             // exactos → revisión

    // DOS secciones, Nuevos ENCIMA de Dudas; cada fila lleva el criterio completo
    const secciones = [...document.querySelectorAll(".rev-seccion h3")].map(h => h.textContent);
    expect(secciones).toEqual(["Nuevos", "Dudas"]);
    expect(document.getElementById("rev-nombre-0")).not.toBeNull();          // Leche (nueva)
    expect(document.getElementById("rev-qty-0").value).toBe("3");           // qty leída del ticket
    expect(document.getElementById("rev-variante-1")).not.toBeNull();        // Yogur (duda): desplegable
    expect(document.getElementById("rev-variante-1").textContent).toContain("Yogur natural");

    // la persona renombra la Leche y define SU criterio ahí mismo (importancia + mínimo)...
    document.getElementById("rev-nombre-0").value = "Leche sin";
    document.getElementById("rev-qty-0").value = "2";
    document.getElementById("rev-score-0").value = "8";
    document.getElementById("rev-min-0").value = "2";
    // ...y resuelve la duda: ES "Yogur natural" → la fila DEJA DE PEDIR SU criterio y muestra
    // YA la alerta REAL del alimento (7/3) — pantalla e inventario dicen lo mismo
    const sel = document.getElementById("rev-variante-1");
    sel.value = "a1";
    sel.dispatchEvent(new window.Event("change", { bubbles: true }));
    expect(document.getElementById("rev-score-1").value).toBe("7");       // la alerta REAL, no los 5/1 de la alta
    expect(document.getElementById("rev-min-1").value).toBe("3");
    expect(document.getElementById("rev-score-1").disabled).toBe(true);
    expect(document.getElementById("rev-min-1").disabled).toBe(true);
    expect(document.getElementById("rev-qty-1").disabled).toBe(false);    // la CANTIDAD sigue siendo editable

    document.querySelector("[data-revision-guardar]").click();

    // TODO acaba en la despensa — la compra ya estaba hecha y de la lista NADA
    const foods = lsFoods(window);
    expect(foods).toHaveLength(3);
    expect(foods.find(f => f.name === "Leche sin")).toEqual(expect.objectContaining({ qty: 2, score: 8, min: 2 }));
    const yo = foods.find(f => f.name === "Yogur natural");
    expect(yo.qty).toBe(4);                                                  // 2 en casa + 2 del ticket (variante)
    expect(yo.min).toBe(3); expect(yo.score).toBe(7);                        // SU alerta, sin pisar (la que la fila mostró)
    // aterrizaje: el escáner NUNCA cambia de pestaña y el inventario destella una vez
    expect(document.getElementById("modal").classList.contains("hidden")).toBe(true);   // modal cerrado, sin toasts de éxito
    expect(document.querySelector("#view-foods").classList.contains("active")).toBe(true);
    await new Promise(r => setTimeout(r, 60));                // el destello entra vía rAF (frames de ~16ms)
    expect(await esperaDestello(document)).toBe(true);        // sondeo con techo — el sleep fijo daba flake
    // la clave de pendientes del ticket JAMÁS se escribe (implementación retirada)
    expect(window.localStorage.getItem("mrcheff.compraTicket")).toBe(null);
  });

  it("duda resuelta como 'es nuevo' → ALTA con lo escrito en la fila (el desplegable vacío manda)", () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr(TICKET);
    document.querySelector("[data-confirmar-exactos]").click();
    // el desplegable por defecto es "es nuevo: se define aquí" → la alerta de la fila es EDITABLE
    expect(document.getElementById("rev-score-1").disabled).toBe(false);
    document.getElementById("rev-score-1").value = "7";
    document.getElementById("rev-min-1").value = "3";
    document.querySelector("[data-revision-guardar]").click();

    const foods = lsFoods(window);
    expect(foods.find(f => f.name === "Yogur")).toEqual(expect.objectContaining({ qty: 2, score: 7, min: 3 }));
    expect(foods.find(f => f.name === "Yogur natural").qty).toBe(2);         // sin variante: no suma a lo existente
    expect(window.localStorage.getItem("mrcheff.compraTicket")).toBe(null);
  });

  it("Cancelar el 2º diálogo: lo confirmado en el 1º SE QUEDA (compromiso por diálogo) y la revisión no entra", () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr(TICKET);
    document.querySelector("[data-confirmar-exactos]").click();
    document.querySelector("[data-close]").click();                          // cancelar la revisión
    const foods = lsFoods(window);
    expect(foods.find(f => f.name === "Pan").qty).toBe(2);                   // el diálogo 1 comprometió SU suma
    expect(foods.some(f => f.name === "Leche sin" || f.name === "Leche")).toBe(false);
    expect(foods.some(f => f.name === "Yogur")).toBe(false);
    expect(window.localStorage.getItem("mrcheff.compraTicket")).toBe(null);
  });

  it("duda: elegir variante carga la alerta REAL del alimento en la fila; volver a 'es nuevo' restaura lo suyo editable", () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr(TICKET);
    document.querySelector("[data-confirmar-exactos]").click();
    // por defecto la fila ofrece su ALTA (5/1) editable — antes de resolver, nada de nada raro
    expect(document.getElementById("rev-score-1").value).toBe("5");
    expect(document.getElementById("rev-min-1").value).toBe("1");
    expect(document.getElementById("rev-score-1").disabled).toBe(false);
    // elige "Yogur natural" → los campos muestran SU alerta real (7/3) y se apagan...
    const sel = document.getElementById("rev-variante-1");
    sel.value = "a1";
    sel.dispatchEvent(new window.Event("change", { bubbles: true }));
    expect(document.getElementById("rev-score-1").value).toBe("7");
    expect(document.getElementById("rev-min-1").value).toBe("3");
    expect(document.getElementById("rev-score-1").disabled).toBe(true);
    expect(document.getElementById("rev-min-1").disabled).toBe(true);
    // ...y si se repite y vuelve a "es nuevo: se define aquí", lo suyo vuelve y es editable
    sel.value = "";
    sel.dispatchEvent(new window.Event("change", { bubbles: true }));
    expect(document.getElementById("rev-score-1").value).toBe("5");
    expect(document.getElementById("rev-min-1").value).toBe("1");
    expect(document.getElementById("rev-score-1").disabled).toBe(false);
    expect(document.getElementById("rev-min-1").disabled).toBe(false);
    // por si acaso: con lo suyo restaurado la ALTA sale con esos mismos valores
    document.getElementById("rev-variante-1").value = "";
    document.querySelector("[data-revision-guardar]").click();
    const foods = lsFoods(window);
    expect(foods.find(f => f.name === "Yogur")).toEqual(expect.objectContaining({ qty: 2, score: 5, min: 1 }));
  });

  it("ticket con TODO exacto → UN solo diálogo: confirmar y fuera, destello sobre el inventario", async () => {
    const { document, window } = bootApp({
      seed: {
        foods: [
          { id: "a1", name: "Pan", score: 3, qty: 1, min: 1, checked: false, createdAt: 1 },
          { id: "a2", name: "Yogur", score: 5, qty: 2, min: 1, checked: false, createdAt: 2 }
        ],
        recipes: [], innov: [], cooked: []
      }
    });
    window.__mrcheffProcesarTextoOcr("2 Pan 0,60\n1 Yogur 0,95\nTOTAL 4,10 €");

    // DIÁLOGO ÚNICO (fase exactos): el botón del pie YA es el final, no hay revisión que abrir
    expect(document.querySelector(".modal-content h2").textContent).toContain("Ya lo tienes en el inventario");
    expect(document.querySelectorAll(".modal-content .ocr-item")).toHaveLength(2);
    expect(document.querySelector(".rev-seccion")).toBeNull();
    expect(document.querySelector("[data-revision-guardar]")).toBeNull();
    document.querySelector("[data-confirmar-exactos]").click();

    expect(document.querySelector("#view-foods").classList.contains("active")).toBe(true);
    await new Promise(r => setTimeout(r, 60));
    expect(await esperaDestello(document)).toBe(true);
    const foods = lsFoods(window);
    expect(foods.find(f => f.name === "Pan").qty).toBe(3);                   // 1 en casa + 2 compradas
    expect(foods.find(f => f.name === "Yogur").qty).toBe(3);                 // 2 en casa + 1 comprada
    expect(window.localStorage.getItem("mrcheff.compraTicket")).toBe(null);
  });

  it("ticket SIN nada exacto → la revisión ES el primer diálogo (sin paso de exactos)", () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr("3 Leche entera 1,29\n2 Yogur 1,45\nTOTAL 6,90 €");
    expect(document.querySelector(".modal-content h2").textContent).toContain("Añade lo nuevo");
    expect([...document.querySelectorAll(".rev-seccion h3")].map(h => h.textContent)).toEqual(["Nuevos", "Dudas"]);
    expect(document.querySelector("[data-confirmar-exactos]")).toBeNull();
    // confirmar sin tocar nada: los valores que la fila trae (qty del ticket, criterio 5/1)
    document.querySelector("[data-revision-guardar]").click();
    const foods = lsFoods(window);
    expect(foods.find(f => f.name === "Leche entera")).toEqual(expect.objectContaining({ qty: 3, score: 5, min: 1 }));
    expect(foods.find(f => f.name === "Yogur")).toEqual(expect.objectContaining({ qty: 2, score: 5, min: 1 }));
    expect(foods.find(f => f.name === "Yogur natural").qty).toBe(2);         // sin variante: nada sumó ahí
  });

  it("ticket sin alimentos reconocibles → estado vacío del modal, despensa sin tocar y nada que pendiente", () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr("TOTAL 3,50 €\nGracias por su visita");
    expect(document.querySelectorAll(".modal-content .ocr-item").length).toBe(0);
    expect(document.querySelector(".modal-content h2").textContent).toContain("No he detectado");
    expect(lsFoods(window)).toHaveLength(2);
    expect(window.localStorage.getItem("mrcheff.compraTicket")).toBe(null);
  });
});

// REQUISITO 95% (2026-10-22): el PARSER ESTRUCTURAL del ticket (modules/ocr-ticket-parser.js) manda
// en la extracción — CADA línea-producto llega a la revisión (se conoce o no su nombre), la
// cantidad viene de la columna de Mercadona o de las auxiliares de ALDI, el granel va en lotes de
// 500 g con su sufijo "(500gr)" y los productos de hogar (etiqueta alimento/no-alimentario) NO
// piden importancia ni mínimo: alta fija madre casa → sección aparte del Inventario.
describe("Escáner parser-first (requisito 95%): el ticket completo llega a la revisión", () => {
  // Bloque de líneas del TICKET REAL de Mercadona (reports/OCR/IMG_0162.HEIC vía e2e/ocr-inspeccion.mjs)
  const REAL_MERCADONA = [
    "MERCADONA S.A.",
    "FACTURA SIMPLIFICADA: 3931-017-372431",
    "2 BEBIDA AVELLANAS 2,50",
    "4 BEBIDA COCO 1,60 6,40",
    "1 SALMON NATURAL 3,55",
    "2 LECHE FRESCA",                      // línea con el precio comido por el OCR: la columna de qty sobrevive
    "3 PAÑUELO 4,05",                      // producto de hogar: sin importancia ni mínimo
    "1 HIGIÉNICO DOBLE ROLL 4,60",         // producto de hogar (papel higiénico)
    "TOTAL 72,45",
    "TARJETA BANCARIA"
  ].join("\n");

  it("todo el ticket entra: cantidades de la columna, línea sin precio sobrevive y los HOGAREÑOS van sin criterio", () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr(REAL_MERCADONA);

    // Sin un nombre exacto de despensa: la revisión ES el primer diálogo, con TODO el ítem
    expect(document.querySelector(".modal-content h2").textContent).toContain("Añade lo nuevo");
    const filas = [...document.querySelectorAll(".rev-fila-nueva")];
    // 5 en NUEVOS: "SALMON NATURAL" cae en DUDAS — comparte la palabra "natural" con
    // «Yogur natural» de la despensa sembrada (el mis mo casador de tokens de siempre)
    expect(filas).toHaveLength(5);
    const nombreDe = f => f.querySelector(".rev-campo-nombre").value;         // textContent NO lee los value

    const deCoco = filas.find(f => nombreDe(f) === "Bebida coco");
    expect(deCoco.querySelector(".rev-campo-qty").value).toBe("4");          // la columna de cantidad del ticket
    const deLeche = filas.find(f => nombreDe(f) === "Leche fresca");
    expect(deLeche.querySelector(".rev-campo-qty").value).toBe("2");         // sin precio, la qty de la columna basta
    const deDuda = [...document.querySelectorAll(".rev-fila-duda")];
    expect(deDuda).toHaveLength(1);
    expect(nombreDe(deDuda[0])).toBe("Salmon natural");

    // HOGAR: la pinta de la fila cambia — etiqueta "Producto" y las celdas de criterio fijas
    const dePaniuelo = filas.find(f => nombreDe(f) === "Pañuelo");
    expect(dePaniuelo.querySelector(".rev-etiqueta").textContent).toBe("Producto");
    expect(dePaniuelo.querySelector(".rev-sub .ocr-tipo").textContent).toBe("🏠 Producto de hogar");
    expect(dePaniuelo.querySelector(".rev-campo-score").disabled).toBe(true);
    expect(dePaniuelo.querySelector(".rev-campo-score").value).toBe("5");
    expect(dePaniuelo.querySelector(".rev-campo-min").disabled).toBe(true);
    expect(dePaniuelo.querySelector(".rev-campo-min").value).toBe("0");

    // El TEXTO RECONOCIDO queda a la vista (diagnóstico del requisito 95%)
    const crudo = document.querySelector(".ocr-crudo pre");
    expect(crudo).not.toBeNull();
    expect(crudo.textContent).toContain("FACTURA SIMPLIFICADA");

    document.querySelector("[data-revision-guardar]").click();
    const foods = lsFoods(window);
    expect(foods).toHaveLength(8);                                           // 2 sembrados + 6 del ticket (duda = alta por defecto)
    expect(foods.find(f => f.name === "Bebida coco").qty).toBe(4);
    const hogar = foods.filter(f => f.categoria === "hogar");
    expect(hogar.map(f => f.name)).toEqual(
      expect.arrayContaining([expect.stringContaining("Pañuelo"), expect.stringContaining("Higiénico doble roll")])
    );
    hogar.forEach(h => {
      expect(h.min).toBe(0);                                                 // avisan al agotarse
      expect(h.score).toBe(5);                                               // urgencia neutra
    });
  });

  it("ALDI: el granel va en LOTES de 500 g — '(500gr)' en el nombre y la auxiliar '4x' alimenta la cantidad", () => {
    const { document, window } = appConDespensa();
    const ALDI = [
      "ALDI",
      "Horario de apertura:",
      "0,680 kg x 13,99 €/kg",
      "SPECIAL COSTILLAR 9,51",        // 0,680 kg → 1 lote de 500 g
      "4x 1,73",
      "ECO HUEVOS 11,00",              // la línea auxiliar "4x" da SU cantidad al producto de abajo
      "TOTAL 71,34"
    ].join("\n");
    window.__mrcheffProcesarTextoOcr(ALDI);

    const filas = [...document.querySelectorAll(".rev-fila-nueva")];
    expect(filas).toHaveLength(2);                                   // el peso ("0,680…") y el "4x" NO son filas
    const nombreDe = f => f.querySelector(".rev-campo-nombre").value;
    const costillar = filas.find(f => nombreDe(f).includes("Special costillar"));
    expect(costillar.querySelector(".rev-campo-nombre").value).toContain("(500gr)");
    expect(costillar.querySelector(".rev-campo-qty").value).toBe("1");
    const huevos = filas.find(f => nombreDe(f).includes("Eco huevos"));
    expect(huevos.querySelector(".rev-campo-qty").value).toBe("4");

    document.querySelector("[data-revision-guardar]").click();
    const foods = lsFoods(window);
    expect(foods.find(f => f.name.includes("Special costillar (500gr)"))).toBeTruthy();
  });

  it("el conmutador del formulario: productos de hogar sin pedir importancia/mínimo (grupo oculto y alta con el tag)", () => {
    const { document, window } = appConDespensa();
    document.getElementById("food-cat-hogar").click();
    const food = document.getElementById("food-name");
    food.value = "Detergente líquido";
    document.getElementById("food-qty").value = "1";
    // al activar HOGAR los grupos de mínimo/importancia se OSCultan (no se piden)
    expect(document.getElementById("food-min").closest(".qty-group").classList.contains("hidden")).toBe(true);
    foodFormSubmit(document);
    const foods = lsFoods(window);
    const det = foods.find(f => f.name === "Detergente líquido");
    expect(det.categoria).toBe("hogar");
    expect(det.min).toBe(0);
    expect(det.score).toBe(5);
    // su fila vive en la SECCIÓN de hogar, no en la lista de alimentos
    expect([...document.querySelectorAll("#hogar-list .food-name")].map(e => e.textContent)).toContain("Detergente líquido");
    expect([...document.querySelectorAll("#food-list .food-name")].map(e => e.textContent)).not.toContain("Detergente líquido");
    // y la sección de hogar se destapa (antes estaba vacía y oculta)
    expect(document.getElementById("hogar-seccion").classList.contains("hidden")).toBe(false);
  });

  it("las filas NUEVAS llevan el conmutador 🍎/🏠: el autodiagnóstico sólo PRESELECCIONA y el alta usa la categoría elegida", () => {
    const TEXTO = [
      "TICKET SUPER 20/10/2026",
      "2 PAÑUELO 4,05",        // el vocabulario lo dará por 🏠 (petición: la persona decide encima)
      "3 LECHUGA 1,80",        // → 🍎
      "TOTAL 5,85 €",
      "GRACIAS POR SU VISITA"
    ].join("\n");
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr(TEXTO);
    // sin exactos: la revisión ES el primer diálogo
    const filaHogar = document.querySelector(".rev-fila-nueva[data-o='0']");
    const filaComida = document.querySelector(".rev-fila-nueva[data-o='1']");

    // PRESELECCIÓN del autodiagnóstico: PAÑUELO nace 🏠 (criterio fijo 5/0 deshabilitado) y
    // LECHUGA nace 🍎 (criterio editable)
    expect(filaHogar.querySelector(".rev-cat-btn[data-cat='hogar']").getAttribute("aria-pressed")).toBe("true");
    expect(filaHogar.querySelector(".rev-cat-btn[data-cat='alimento']").getAttribute("aria-pressed")).toBe("false");
    expect(filaHogar.querySelector(".rev-campo-score").disabled).toBe(true);
    expect(filaHogar.querySelector(".rev-campo-min").disabled).toBe(true);
    expect(filaHogar.querySelector(".rev-campo-min").value).toBe("0");
    expect(filaHogar.querySelector(".rev-celda-nombre .rev-etiqueta").textContent).toBe("Producto");
    expect(filaComida.querySelector(".rev-cat-btn[data-cat='alimento']").getAttribute("aria-pressed")).toBe("true");
    expect(filaComida.querySelector(".rev-campo-score").disabled).toBe(false);

    // LA PERSONA MANDA: LECHUGA pasa a 🏠 (criterio fijo, fila renombrada) y vuelve a 🍎
    filaComida.querySelector(".rev-cat-btn[data-cat='hogar']").click();
    expect(filaComida.querySelector(".rev-cat-btn[data-cat='hogar']").getAttribute("aria-pressed")).toBe("true");
    expect(filaComida.querySelector(".rev-campo-score").disabled).toBe(true);
    expect(filaComida.querySelector(".rev-campo-min").value).toBe("0");
    expect(filaComida.querySelector(".rev-celda-nombre .rev-etiqueta").textContent).toBe("Producto");
    expect(filaComida.querySelector(".rev-sub .ocr-tipo").textContent).toContain("Producto de hogar");
    filaComida.querySelector(".rev-cat-btn[data-cat='alimento']").click();
    expect(filaComida.querySelector(".rev-campo-score").disabled).toBe(false);
    expect(filaComida.querySelector(".rev-celda-nombre .rev-etiqueta").textContent).toBe("Alimento");

    // el ALTA usa la categoría del conmutador: la persona deja la LECHUGA en hogar
    filaComida.querySelector(".rev-cat-btn[data-cat='hogar']").click();
    document.querySelector("[data-revision-guardar]").click();
    const foods = lsFoods(window);
    expect(foods.find(f => f.name === "Pañuelo").categoria).toBe("hogar");
    const lechuga = foods.find(f => f.name === "Lechuga");
    expect(lechuga.categoria).toBe("hogar");                 // elegido EN el diálogo, no el autodiagnóstico
    expect(lechuga.min).toBe(0);
    expect(lechuga.score).toBe(5);
  });

  it("en DUDAS el conmutador 🍎/🏠 duerme con la variante resuelta y despierta al volver a 'es nuevo'", () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr(TICKET);                    // "2 Yogur 1,35" → duda con la despensa
    document.querySelector("[data-confirmar-exactos]").click();  // exactos → revisión
    const duda = document.querySelector(".rev-fila-duda");
    const btnHogar = duda.querySelector(".rev-cat-btn[data-cat='hogar']");
    expect(btnHogar.disabled).toBe(false);                       // 'es nuevo': la etiqueta se decide

    // resuelta con casa: la compra va a ESE alimento, su categoría ya está decidida en casa
    const sel = document.getElementById("rev-variante-1");
    sel.value = "a1";
    sel.dispatchEvent(new window.Event("change", { bubbles: true }));
    expect(btnHogar.disabled).toBe(true);
    expect(duda.querySelector(".rev-cat-btn[data-cat='alimento']").disabled).toBe(true);
    // vuelta a 'es nuevo': el conmutador despierta y decide la categoría del ALTA
    sel.value = "";
    sel.dispatchEvent(new window.Event("change", { bubbles: true }));
    expect(btnHogar.disabled).toBe(false);
    btnHogar.click();
    expect(btnHogar.getAttribute("aria-pressed")).toBe("true");
    document.querySelector("[data-revision-guardar]").click();
    const alta = lsFoods(window).find(f => f.name === "Yogur");
    expect(alta.categoria).toBe("hogar");
    expect(alta.min).toBe(0);
  });

  it("el diálogo 1 (exactos) no lleva conmutador — los ya-en-casa no cambian de categoría", () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr(TICKET);
    expect(document.querySelector(".ocr-item .rev-cat-btn")).toBeNull();
  });

  function foodFormSubmit(document) {
    document.getElementById("food-form").dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true }));
  }
});

// FEATURE 2026-10-21 (lista de la compra DINÁMICA): las dos confirmaciones del escáner (exactos
// y revisión) tocan el Inventario → la Card 3 se repinta al instante. El despensa sembrado tiene
// el plan aprobado con UN needy por cada salida posible: «Pan» y «Yogur» acabarán cubiertos por
// lo comprado (qty > su min) y «Semillas de calabaza» SIGUE — en la tienda no la había.
describe("Escáner → la lista de la compra DINÁMICA se repinta en cada confirmación (integración)", () => {
  const conPlanAprobado = () => bootApp({
    seed: {
      foods: [
        { id: "a1", name: "Yogur natural", score: 7, qty: 2, min: 3, checked: false, createdAt: 1 },
        { id: "a2", name: "Pan", score: 3, qty: 1, min: 1, checked: false, createdAt: 2 }
      ],
      recipes: [], innov: [], cooked: [],
      weekmenu: {
        approved: true, generatedOn: "2026-10-21", includeUnavailable: false,
        plan: Array.from({ length: 7 }, () => ({ dayLabel: "Lunes", meals: [] })),
        needyFoods: [{ name: "Pan" }, { name: "Yogur" }, { name: "Semillas de calabaza" }]
      }
    }
  });

  const filas = document =>
    [...document.querySelectorAll("#shopping-list li.alert-row .alert-name strong")].map(e => e.textContent);

  it("antes de confirmar: las 3 filas pendientes; tras los EXACTOS «Pan» sale (2 > su min 1); tras la REVISIÓN «Yogur» sale (4 > min 3) y «Semillas» sigue sin comprarla", async () => {
    const { document, window } = conPlanAprobado();
    window.__mrcheffProcesarTextoOcr(TICKET);
    // Orden por PRIORIDAD (bugfix 2026-10-21): Yogur (score 7 → naranja), Pan (score 3 → verde)
    // y «Semillas» SIN registro en el Inventario → neutra, SIEMPRE al final.
    expect(filas(document)).toEqual(["Yogur", "Pan", "Semillas de calabaza"]);   // aún sin comprar

    // La OTRA cara de la copy del diálogo (2026-10-24): el aviso de REPUESTOS de la semana
    // también libera al alimento cubierto — el mismo repinta (renderWeeklyAlert) tras cada
    // confirmación: la compra suma y, con más de lo que hace falta, el alimento sale solo.
    const restock = () => [...document.querySelectorAll("#weekly-alert .alert-row .alert-name strong")].map(e => e.textContent);
    expect(restock()).toEqual(["Yogur natural", "Pan"]);        // ambos piden reposición (qty <= min)

    document.querySelector("[data-confirmar-exactos]").click();             // diálogo 1: Pan +1 (qty 1 → 2)
    expect(filas(document)).toEqual(["Yogur", "Semillas de calabaza"]);     // Pan: 2 > su min 1 → SALE ya
    expect(restock()).toEqual(["Yogur natural"]);                            // también del aviso semanal

    const sel = document.getElementById("rev-variante-1");
    sel.value = "a1";                                                        // la duda del Yogur → su variante
    sel.dispatchEvent(new window.Event("change", { bubbles: true }));
    document.querySelector("[data-revision-guardar]").click();               // diálogo 2: Yogur +2 (2 → 4)
    expect(filas(document)).toEqual(["Semillas de calabaza"]);               // Yogur: 4 > 3; Semillas: la tienda no la tenía
    expect(restock()).toEqual([]);                                           // Yogur cubierto: aviso vacío
    expect(document.getElementById("weekly-alert").classList.contains("hidden")).toBe(true);

    // needyFoods PERSISTE íntegro: el borrado es de la Card (en vivo), no del plan — si el ítem
    // se vuelve a gastar, la fila reaparece (sólo el ✅ comprado lo retira pa siempre).
    const seman = JSON.parse(window.localStorage.getItem("mrcheff.weekmenu"));
    expect(seman.needyFoods.map(f => f.name)).toEqual(["Pan", "Yogur", "Semillas de calabaza"]);
  });
});
