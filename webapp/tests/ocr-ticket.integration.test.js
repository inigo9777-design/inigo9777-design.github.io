// tests/ocr-ticket.integration.test.js — CAPA INTEGRACIÓN (CODING_STANDARDS §6) para
// #epic-ocr-despensa-camara, propósito 2026-10-20: ESCANEAR EL TICKET → alimento + CANTIDAD.
// CONTRATO clave: NADA del ticket entra en la despensa por su cuenta —
//   · exacto ya en la despensa → la compra SUMA en-situ (sus criterios quedan como estaban);
//   · DUDOSO (¿es el mismo que uno de la despensa?→ variantes) → pendiente del ticket normal, arriba;
//   · NUEVO → pendiente SIN DEFINIR (fila atenuada + aviso): la importancia (prioridad) y el mínimo
//     se fijan EDITABLES en la propia fila; al definirlos la fila queda normal y se resuelve como
//     cualquier otra (🛒 Despensa? / ✅ comprado, el diálogo pre-cargado con lo definido).
//
// El motor Tesseract no corre en jsdom (¿para qué?): producción delega el TEXTO leído en la misma
// función que usa el file-picker (app.js delega data.text en procesarTextoOcr), así que los tests
// inyectan el texto del ticket por la inyección §6 `window.__mrcheffProcesarTextoOcr` — el mismo
// paso exacto que la producción tras el OCR real. La foto/motor quedan cubiertos por el e2e Brave
// (e2e/ocr-despensa.mjs, Tesseract REAL contra una foto sintética; y el vídeo gui de la feature).

const { bootApp } = require("./boot");

const TICKET = [
  "TICKET SUPER 20/10/2026",
  "3 Leche entera · 1,29 €",
  "2 x Yogur",
  "1 Pan de pueblo",
  "TOTAL 12,40 €",
  "GRACIAS POR SU VISITA"
].join("\n");

function appConDespensa() {
  return bootApp({
    seed: {
      foods: [
        { id: "a1", name: "Yogur natural", score: 5, qty: 2, min: 1, checked: false, createdAt: 1 },
        { id: "a2", name: "Pan", score: 3, qty: 1, min: 1, checked: false, createdAt: 2 }
      ],
      recipes: [], innov: [], cooked: []
    }
  });
}

function lsPend(window) {
  return JSON.parse(window.localStorage.getItem("mrcheff.compraTicket") || "[]");
}
function lsFoods(window) {
  return JSON.parse(window.localStorage.getItem("mrcheff.foods") || "[]");
}

describe("Escáner del ticket → despensa y pendientes (integración)", () => {
  it("el hook de inyección está disponible en el window de la app", () => {
    const { window } = appConDespensa();
    expect(typeof window.__mrcheffProcesarTextoOcr).toBe("function");
  });

  it("ticket: exacto SUMA (criterios intactos), nuevo y dudoso van a pendientes (nada entra solo)", async () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr(TICKET);

    // ASISTENTE 2 pasos (2026-10-20): paso 1 = lo ya exacto en la despensa (puro "Pan");
    // paso 2 = las dudas (Yogur dudoso, Leche nuevo). La CANTIDAD del ticket va prefijada por
    // línea en su fila del paso que toque: "3 Leche…" → 3, "2 x Yogur" → 2, "1 Pan…" → 1.
    expect(document.querySelector(".modal-content h2").textContent).toContain("se añaden a la despensa");
    expect(document.querySelectorAll(".modal-content .ocr-item")).toHaveLength(1);
    expect(document.getElementById("ocr-qty-2").value).toBe("1");

    document.querySelector("[data-ocr-siguiente]").click();
    expect(document.querySelector(".modal-content h2").textContent).toContain("tienen duda");
    expect(document.querySelectorAll(".modal-content .ocr-item")).toHaveLength(2);
    expect(document.getElementById("ocr-qty-1").value).toBe("2");
    expect(document.getElementById("ocr-qty-0").value).toBe("3");

    // al confirmar el asistente SALTA a la lista de la compra (sin toast de éxito)...
    document.querySelector("[data-ocr-guardar]").click();

    // ...la vista destino es Sugerencias con el destello sobre la lista recién repartida
    expect(document.querySelector("#view-suggest").classList.contains("active")).toBe(true);
    await new Promise(r => setTimeout(r, 60));                 // el destello entra vía rAF (2 frames)
    expect(document.getElementById("shopping-list").className).toContain("destello-suave");

    // despensa: SOLO "Pan" cambió (exacto → suma su compra); Leche y Yogur NO (sus veredicto falta)
    const foods = lsFoods(window);
    expect(foods.find(f => f.name === "Pan").qty).toBe(2);     // 1 en casa + 1 comprada
    expect(foods).toHaveLength(2);                             // ni "Leche" ni "Yogur" nuevos
    expect(foods.find(f => f.name === "Yogur natural").min).toBe(1);  // criterios intactos

    // pendientes del ticket, arriba de la lista: el nuevo LECHE queda SIN DEFINIR
    const pend = lsPend(window);
    expect(pend.map(p => p.nombre)).toEqual(["Leche", "Yogur"]);     // recién escaneado arriba
    expect(pend.find(p => p.nombre === "Leche").faltaDefinir).toBe(true);   // NUEVO: sin definir
    expect(pend.find(p => p.nombre === "Yogur").faltaDefinir).toBe(false);  // DUDOSO: fila normal
    expect(pend.find(p => p.nombre === "Leche").qty).toBe(3);               // qty leída del ticket
    expect(pend[0].escaneadoEn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("el NUEVO queda como fila ATENUADA con aviso e importancia/mínimo EDITABLES; al definirlos pasa a normal", () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr(TICKET);
    document.querySelector("[data-ocr-siguiente]").click();   // paso 1 (despensa) → paso 2 (dudas)
    document.querySelector("[data-ocr-guardar]").click();

    // sin definir: clase del fade + aviso + sus dos inputs + el botón; NO los botones de resolución aún
    const fila = document.querySelector("li[data-fila-ticket='Leche']");
    expect(fila).not.toBeNull();
    expect(fila.className).toContain("pendiente-sin-definir");
    expect(fila.textContent).toContain("IMPORTANCIA");
    const scoreIn = fila.querySelector(".tick-score");
    const minIn = fila.querySelector(".tick-min");
    expect(scoreIn).not.toBeNull();
    expect(minIn).not.toBeNull();
    expect(scoreIn.value).toBe("5");                    // valores por defecto VISIBLES (editables)
    expect(fila.querySelector("[data-buy]")).toBeNull(); // mientras no estén definidos, ni ✅ ni 🛒
    expect(fila.querySelector("[data-tick-definir]")).not.toBeNull();

    // la persona decide: importancia 8, mínimo 2 (la prioridad editable, como se pidió)
    scoreIn.value = "8";
    minIn.value = "2";
    fila.querySelector("[data-tick-definir]").click();

    const pend = lsPend(window).find(p => p.nombre === "Leche");
    expect(pend.faltaDefinir).toBe(false);
    expect(pend.min).toBe(2);
    expect(pend.score).toBe(8);

    // la fila queda NORMAL: fuera el fade/aviso, dentro los mismos botones de siempre...
    const filaNueva = document.querySelector("li[data-fila-ticket='Leche']");
    expect(filaNueva.className).not.toContain("pendiente-sin-definir");
    expect(filaNueva.querySelector(".tick-score")).toBeNull();
    const buyBtn = filaNueva.querySelector("[data-buy]");
    expect(buyBtn).not.toBeNull();
    // ...y el diálogo de resolución abre pre-cargado con lo DEFINIDO (qty 3 del ticket, min 2, score 8)
    buyBtn.click();
    expect(document.getElementById("compra-qty").value).toBe("3");
    expect(document.getElementById("compra-min").value).toBe("2");
    expect(document.getElementById("compra-score").value).toBe("8");
  });

  it("'✅ comprado' tras definir: alta en la despensa con los valores DEFINIDOS y la fila sale", () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr(TICKET);
    document.querySelector("[data-ocr-siguiente]").click();   // paso 1 (despensa) → paso 2 (dudas)
    document.querySelector("[data-ocr-guardar]").click();

    const filaLeche = document.querySelector("li[data-fila-ticket='Leche']");
    filaLeche.querySelector(".tick-score").value = "8";
    filaLeche.querySelector(".tick-min").value = "2";
    filaLeche.querySelector("[data-tick-definir]").click();

    document.querySelector("li[data-fila-ticket='Leche'] [data-buy]").click();
    document.querySelector("[data-buy-confirm]").click();

    // despensa: LECHE alta con la cantidad del ticket y los criterios que la persona definió
    const foods = lsFoods(window);
    const leche = foods.find(f => f.name === "Leche");
    expect(leche).toEqual(expect.objectContaining({ qty: 3, min: 2, score: 8 }));
    // pendientes: Leche RESUELTA sale; Yogur (dudoso) sigue esperando su veredicto
    expect(lsPend(window).map(p => p.nombre)).toEqual(["Yogur"]);
    expect(document.querySelector("li[data-fila-ticket='Leche']")).toBeNull();
  });

  it("el DUDOSO usa el MISMO botón 'Despensa?' de la lista: variante, diálogo con qty del ticket, fila fuera", () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr(TICKET);
    document.querySelector("[data-ocr-siguiente]").click();   // paso 1 (despensa) → paso 2 (dudas)
    document.querySelector("[data-ocr-guardar]").click();

    const fila = document.querySelector("li[data-fila-ticket='Yogur']");
    expect(fila).not.toBeNull();
    expect(fila.textContent).toContain("🎫 del ticket");
    const despensaBtn = fila.querySelector("[data-despensa]");
    expect(despensaBtn).not.toBeNull();                                  // hay variante: "Yogur natural"
    expect(despensaBtn.dataset.compraQty).toBe("2");                    // qty escaneada, para prefill

    // deslizar el flujo COMPLETO del botón "🛒 Despensa?" (mismo comportamiento de la lista):
    despensaBtn.click();
    const elegir = document.querySelector("[data-despensa-elegir='Yogur natural']");
    expect(elegir).not.toBeNull();
    elegir.click();
    // el modal de compra ABRE con la cantidad del TICKET prefijada (mismo dato escaneado)
    expect(document.getElementById("compra-qty").value).toBe("2");
    document.querySelector("[data-buy-confirm]").click();

    // resuelto: la compra fue IN-SITU a "Yogur natural" (sin alta nueva), el pendiente SALE
    // (y el NUEVO "Leche" sigue esperando SU decisión — no lo toca el veredicto del Yogur)
    const foods = lsFoods(window);
    expect(foods.some(f => f.name === "Yogur natural" && f.qty === 2)).toBe(true);
    expect(lsPend(window).map(p => p.nombre)).toEqual(["Leche"]);
    expect(document.querySelector("li[data-fila-ticket='Yogur']")).toBeNull();
    // sin plan aprobado y con pendientes sin resolver → la lista SIGUE visible: la fila de Leche manda
    expect(document.querySelector("li[data-fila-ticket='Leche']")).not.toBeNull();
  });

  it("ticket sin alimentos reconocibles → estado vacío del modal, despensa sin tocar, sin pendientes", () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr("TOTAL 3,50 €\nGracias por su visita");
    expect(document.querySelectorAll(".modal-content .ocr-item").length).toBe(0);
    expect(document.querySelector(".modal-content h2").textContent).toContain("No he detectado");
    expect(lsFoods(window)).toHaveLength(2);
    expect(window.localStorage.getItem("mrcheff.compraTicket")).toBe(null);
  });

  it("asistente: chips de destino por paso y el 'Volver' conserva lo ya dicho", () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr(TICKET);

    // PASO 1 (sólo exactos): la fila lleva el chip de suma; la fila del paso 2 no está aún
    expect(document.querySelector(".ocr-chip").textContent).toContain("se suma");
    expect(document.querySelector(".ocr-chip-duda")).toBeNull();
    document.querySelector("[data-ocr-siguiente]").click();

    // PASO 2: cada fila su chip — el dudoso pregunta, el nuevo anuncia que es nuevo
    const chips = [...document.querySelectorAll(".ocr-item .ocr-chip")].map(c => c.textContent);
    expect(chips).toContain("¿lo tienes?");
    expect(chips).toContain("nuevo en casa");

    // corregir el nuevo (nombre + cantidad) y VOLVER: al re-entrar, lo dicho sigue ahí
    document.getElementById("ocr-nombre-0").value = "Leche sin";
    document.getElementById("ocr-qty-0").value = "4";
    document.querySelector("[data-ocr-volver]").click();
    expect(document.querySelector(".modal-content h2").textContent).toContain("se añaden a la despensa");
    document.querySelector("[data-ocr-siguiente]").click();
    expect(document.getElementById("ocr-nombre-0").value).toBe("Leche sin");
    expect(document.getElementById("ocr-qty-0").value).toBe("4");

    // y la corrección llega hasta el final: el pendiente se llama como la persona lo corrigió
    document.querySelector("[data-ocr-guardar]").click();
    expect([...document.querySelectorAll("li[data-fila-ticket]")].map(f => f.dataset.filaTicket)).toContain("Leche sin");
  });

  it("ticket con TODO exacto → un solo paso (sin dudas) y el salto final es a la DESPENSA", async () => {
    const { document, window } = bootApp({
      seed: {
        foods: [
          { id: "a1", name: "Pan", score: 3, qty: 1, min: 1, checked: false, createdAt: 1 },
          { id: "a2", name: "Yogur", score: 5, qty: 2, min: 1, checked: false, createdAt: 2 }
        ],
        recipes: [], innov: [], cooked: []
      }
    });
    window.__mrcheffProcesarTextoOcr("2 Pan\n1 Yogur natural\nTOTAL 4,10 €");

    // PASO ÚNICO: botón "Añadir lo confirmado" está ya en el paso 1 (no hay dudas que revisar)
    expect(document.querySelector(".modal-content h2").textContent).toContain("se añaden a la despensa");
    expect(document.querySelectorAll(".modal-content .ocr-item")).toHaveLength(2);
    expect(document.querySelector("[data-ocr-siguiente]")).toBeNull();
    document.querySelector("[data-ocr-guardar]").click();

    expect(document.querySelector("#view-foods").classList.contains("active")).toBe(true);
    await new Promise(r => setTimeout(r, 60));                 // el destello entra vía rAF (2 frames)
    expect(document.getElementById("food-list").className).toContain("destello-suave");
    expect(lsFoods(window).find(f => f.name === "Pan").qty).toBe(3);   // 1 + 2 del ticket
    expect(window.localStorage.getItem("mrcheff.compraTicket")).toBe(null);   // nada para la lista
  });

  it("ticket SIN nada exacto → el asistente entra directo en el paso de dudas (no hay paso 1)", () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr("3 Leche entera\n2 x Yogur\nTOTAL 6,90 €");
    expect(document.querySelector(".modal-content h2").textContent).toContain("tienen duda");
    expect(document.querySelectorAll(".modal-content .ocr-item")).toHaveLength(2);
    expect(document.querySelector("[data-ocr-siguiente]")).toBeNull();
    document.querySelector("[data-ocr-guardar]").click();
    expect(lsFoods(window)).toHaveLength(2);                   // nada sumó: todo era duda/nuevo
    expect(lsPend(window).map(p => p.nombre)).toEqual(["Leche", "Yogur"]);
  });
});
