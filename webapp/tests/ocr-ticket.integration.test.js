// tests/ocr-ticket.integration.test.js — CAPA INTEGRACIÓN (Capa 2, CODING_STANDARDS.md §6) para
// #epic-ocr-despensa-camara con propósito de 2026-10-20: ESCANEAR EL TICKET → alimento + CANTIDAD
// a la despensa; los DUDOSOS (¿es el mismo que uno de la despensa?) NO entran: van arriba a la
// lista de la compra con "🛒 Despensa?" y su mismo comportamiento, y salen al resolverse.
//
// El motor Tesseract no corre en jsdom (¿para qué?): producción delega el TEXTO leído en la misma
// función que usa el file-picker (app.js delega data.text en procesarTextoOcr), así que los tests
// inyectan el texto del ticket por la inyección §6 `window.__mrcheffProcesarTextoOcr` — el mismo
// paso exacto que la producción después del OCR real. La foto/motor quedan cubiertos por el e2e
// Brave (e2e/ocr-despensa.mjs, Tesseract REAL contra una foto sintética de canvas).

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

describe("Escáner del ticket → despensa y dudosos a la lista (integración)", () => {
  it("el hook de inyección está disponible en el window de la app", () => {
    const { window } = appConDespensa();
    expect(typeof window.__mrcheffProcesarTextoOcr).toBe("function");
  });

  it("ticket completo: qty leída por línea, exacto SUMA, nuevo entra y DUDOSO NO entra (a pendientes)", () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr(TICKET);

    // modal de confirmación con los 3 candidatos reales (TOTAL/GRACIAS no crean candidatos)
    const filas = [...document.querySelectorAll(".modal-content .ocr-item")];
    expect(filas).toHaveLength(3);

    // la CANTIDAD del ticket va prefijada por línea: "3 Leche…" → 3, "2 x Yogur" → 2, "1 Pan…" → 1
    expect(document.getElementById("ocr-qty-0").value).toBe("3");
    expect(document.getElementById("ocr-qty-1").value).toBe("2");
    expect(document.getElementById("ocr-qty-2").value).toBe("1");

    document.querySelector("[data-ocr-guardar]").click();

    // despensa: Leche ALTA (el candidato lleva el nombre del VOCABULARIO, "Leche"; sin variantes en casa),
    // Pan SUMA su compra (1 + 1 = 2), "Yogur natural" INTOCADO (el dudoso "Yogur" no se coló como alta nueva)
    const foods = JSON.parse(window.localStorage.getItem("mrcheff.foods"));
    expect(foods.find(f => f.name === "Leche").qty).toBe(3);
    expect(foods.find(f => f.name === "Pan").qty).toBe(2);
    expect(foods.find(f => f.name === "Yogur natural").qty).toBe(2);
    expect(foods.some(f => f.name === "Yogur")).toBe(false);           // NINGUNA alta nueva dudosa

    // pendiente DEL TICKET persistido para la lista de la compra
    const pend = JSON.parse(window.localStorage.getItem("mrcheff.compraTicket"));
    expect(pend).toEqual([{ nombre: "Yogur", qty: 2, tipo: "lacteo", escaneadoEn: pend[0].escaneadoEn }]);
    expect(pend[0].escaneadoEn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("el dudoso aparece como fila ARRIBA de la lista de la compra con 'Despensa?' (variantes de la despensa)", () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr(TICKET);
    document.querySelector("[data-ocr-guardar]").click();

    const fila = document.querySelector("li[data-fila-ticket='Yogur']");
    expect(fila).not.toBeNull();
    expect(fila.textContent).toContain("🎫 del ticket");
    const despensaBtn = fila.querySelector("[data-despensa]");
    expect(despensaBtn).not.toBeNull();                                  // hay variante: "Yogur natural"
    expect(despensaBtn.dataset.compraQty).toBe("2");                    // qty leída del ticket, para prefill

    // deslizar el flujo COMPLETO del botón "🛒 Despensa?" (mismo comportamiento de la lista):
    despensaBtn.click();
    const elegir = document.querySelector("[data-despensa-elegir='Yogur natural']");
    expect(elegir).not.toBeNull();                                       // el modal lista la variante real
    elegir.click();

    // el modal de compra ABRE con la cantidad del TICKET prefijada (mismo dato escaneado)
    expect(document.getElementById("compra-qty").value).toBe("2");
    document.querySelector("[data-buy-confirm]").click();

    // resuelto: la compra fue IN-SITU a "Yogur natural" (sin alta nueva), el pendiente SALE
    const foods = JSON.parse(window.localStorage.getItem("mrcheff.foods"));
    expect(foods.some(f => f.name === "Yogur natural" && f.qty === 2)).toBe(true);
    expect(JSON.parse(window.localStorage.getItem("mrcheff.compraTicket"))).toEqual([]);
    expect(document.querySelector("li[data-fila-ticket='Yogur']")).toBeNull();
    // sin plan aprobado y sin pendientes → la lista vuelve a esconderse (guard del render)
    expect(document.getElementById("shopping-list").classList.contains("hidden")).toBe(true);
  });

  it("'✅ comprado' resuelve el pendiente del ticket igual (sin variantes del todo, alta directa)", () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr("4 Huevos");
    document.querySelector("[data-ocr-guardar]").click();
    // "Huevos" NO existe en la despensa ni comparte tokens con "Yogur natural"/"Pan" → NO es duda:
    // NO debería haber pendientes; el row del ticket no existe y la lista queda escondida.
    expect(JSON.parse(window.localStorage.getItem("mrcheff.compraTicket") || "[]")).toEqual([]);
    expect(document.querySelector("li[data-fila-ticket]")).toBeNull();
    const foods = JSON.parse(window.localStorage.getItem("mrcheff.foods"));
    expect(foods.find(f => f.name === "Huevos").qty).toBe(4);
  });

  it("ticket sin alimentos reconocibles → estado vacío del modal, despensa sin tocar", () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr("TOTAL 3,50 €\nGracias por su visita");
    expect(document.querySelectorAll(".modal-content .ocr-item").length).toBe(0);
    expect(document.querySelector(".modal-content h2").textContent).toContain("No he detectado");
    const foods = JSON.parse(window.localStorage.getItem("mrcheff.foods"));
    expect(foods).toHaveLength(2);
    expect(window.localStorage.getItem("mrcheff.compraTicket")).toBe(null);
  });
});
