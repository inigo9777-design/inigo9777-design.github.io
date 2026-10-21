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
    await new Promise(r => setTimeout(r, 60));                // el destello entra vía rAF (2 frames)
    expect(document.getElementById("food-list").className).toContain("destello-suave");
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
    window.__mrcheffProcesarTextoOcr("2 Pan\n1 Yogur natural\nTOTAL 4,10 €");

    // DIÁLOGO ÚNICO (fase exactos): el botón del pie YA es el final, no hay revisión que abrir
    expect(document.querySelector(".modal-content h2").textContent).toContain("Ya lo tienes en el inventario");
    expect(document.querySelectorAll(".modal-content .ocr-item")).toHaveLength(2);
    expect(document.querySelector(".rev-seccion")).toBeNull();
    expect(document.querySelector("[data-revision-guardar]")).toBeNull();
    document.querySelector("[data-confirmar-exactos]").click();

    expect(document.querySelector("#view-foods").classList.contains("active")).toBe(true);
    await new Promise(r => setTimeout(r, 60));
    expect(document.getElementById("food-list").className).toContain("destello-suave");
    const foods = lsFoods(window);
    expect(foods.find(f => f.name === "Pan").qty).toBe(3);                   // 1 en casa + 2 compradas
    expect(foods.find(f => f.name === "Yogur").qty).toBe(3);                 // 2 en casa + 1 comprada
    expect(window.localStorage.getItem("mrcheff.compraTicket")).toBe(null);
  });

  it("ticket SIN nada exacto → la revisión ES el primer diálogo (sin paso de exactos)", () => {
    const { document, window } = appConDespensa();
    window.__mrcheffProcesarTextoOcr("3 Leche entera\n2 x Yogur\nTOTAL 6,90 €");
    expect(document.querySelector(".modal-content h2").textContent).toContain("Añade lo nuevo");
    expect([...document.querySelectorAll(".rev-seccion h3")].map(h => h.textContent)).toEqual(["Nuevos", "Dudas"]);
    expect(document.querySelector("[data-confirmar-exactos]")).toBeNull();
    // confirmar sin tocar nada: los valores que la fila trae (qty del ticket, criterio 5/1)
    document.querySelector("[data-revision-guardar]").click();
    const foods = lsFoods(window);
    expect(foods.find(f => f.name === "Leche")).toEqual(expect.objectContaining({ qty: 3, score: 5, min: 1 }));
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
