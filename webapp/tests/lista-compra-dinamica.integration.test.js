// tests/lista-compra-dinamica.integration.test.js — integración (CODING_STANDARDS.md §6).
// Feature 2026-10-21: la Card 3 "Lista de la compra" se actualiza DINÁMICAMENTE contra el
// Inventario actual. La regla de COBERTURA vive en el módulo puro (shoppingListFor: sale el
// ítem cuyo alimento de casa case por tokens y tenga qty > SU min — la persona viene del
// ticket, ya compró; si algo no se encontró en la tienda, la fila SIGUE); aquí se comprueba
// que la VISTA repinta la Card en cada suceso de despensa: ➕/➖/🗑 del inventario y alta
// manual del formulario (#food-form) — y que needyFoods PERSISTE íntegro: el filtro es vivo,
// si el ítem vuelve a gastarse reaparece (a la explicita ✅ comprado sí lo retira pa simpre).
// jsdom no mide layout: aquí sólo filas visibles — semáforo y candado, e2e y unit lo cubren.

const { bootApp } = require("./boot");

const dias = () => Array.from({ length: 7 }, (_, i) => ({ dayLabel: "Lunes", meals: [] }));

const mkApp = foods => bootApp({
  seed: {
    foods,
    weekmenu: {
      approved: true,
      generatedOn: "2026-10-21",
      includeUnavailable: false,
      plan: dias(),
      needyFoods: [{ name: "Yogur" }, { name: "Merluza" }]
    }
  }
});

const despensaBase = [
  { id: "y1", name: "Yogur natural", qty: 2, min: 3, score: 7, checked: false }, // 2 ≤ 3: "Yogur" SIGUE en la lista
  { id: "q1", name: "Queso rallado", qty: 5, min: 1, score: 5, checked: false }  // relleno sin voz en la lista
];

// Textos de las filas actuales de la Card 3.
const nombresDe = app =>
  [...app.document.querySelectorAll("#shopping-list li.alert-row .alert-name strong")].map(el => el.textContent);

// Los DOS botones ⏬⏫ del inventario comparten data-inc (el id); se distinguen por data-step.
const botonesQty = (app, paso) =>
  [...app.document.querySelectorAll(`[data-inc="y1"][data-step="${paso}"]`)] || [];

describe("🛒 Lista de la compra DINÁMICA — Card 3 repinta al cambiar el Inventario actual", () => {
  it("estado sembrado: 2 ≤ min 3 → «Yogur» SIGUE en la lista (tener algo en casa no la tapa)", () => {
    const app = mkApp(despensaBase);
    // ambas green (plan vacío, sin fecha) → el orden de salida conserva el de needyFoods sembrado
    expect(nombresDe(app)).toEqual(["Yogur", "Merluza"]);
  });

  it("➕ hasta pasar el mínimo: «Yogur» SALE al momento — y needyFoods PERSISTE intacto (filtro en vivo)", () => {
    const app = mkApp(despensaBase);
    const sumar = botonesQty(app, 1);
    expect(sumar).toHaveLength(1);
    sumar[0].click();               // 2 → 3 (igual al min: sigue)
    expect(nombresDe(app)).toEqual(["Yogur", "Merluza"]);
    sumar[0].click();               // 3 → 4 > 3: cubierta
    expect(nombresDe(app)).toEqual(["Merluza"]);
    const seman = JSON.parse(app.localStorage.getItem("mrcheff.weekmenu"));
    expect(seman.needyFoods.map(f => f.name)).toEqual(["Yogur", "Merluza"]);   // nada se borró del plan
  });

  it("➖ bajo de nuevo el mínimo: la fila REAPARECE — la dinámica corre en los DOS sentidos", () => {
    const app = mkApp([{ ...despensaBase[0], qty: 4 }, despensaBase[1]]);       // ya cubierta al arrancar
    expect(nombresDe(app)).toEqual(["Merluza"]);
    const restar = botonesQty(app, "-1");
    expect(restar).toHaveLength(1);
    restar[0].click(); restar[0].click(); restar[0].click();                    // 4 → 1 ≤ 3
    expect(nombresDe(app)).toEqual(["Yogur", "Merluza"]);
  });

  it("alta manual por el formulario: «Merluza congelada» (3 de un min 1) cubre «Merluza» y su fila sale", () => {
    const app = mkApp(despensaBase);
    const doc = app.document;
    doc.getElementById("food-name").value = "Merluza congelada";
    doc.getElementById("food-qty").value = "3";
    doc.getElementById("food-min").value = "1";
    const form = doc.getElementById("food-form");
    if (typeof form.requestSubmit === "function") form.requestSubmit();
    else form.dispatchEvent(new app.window.Event("submit", { bubbles: true, cancelable: true }));
    expect(nombresDe(app)).toEqual(["Yogur"]);                                  // Merluza ya en casa de sobra
    const guardado = JSON.parse(app.localStorage.getItem("mrcheff.foods"));
    const merluza = guardado.find(f => f.name === "Merluza congelada");
    expect(merluza.qty).toBe(3);                                                // el alta llegó a la despensa de verdad
  });

  it("🗑 elimina el alimento que cubría: «Yogur» VUELVE a la lista — nada lo tapa ya", () => {
    const app = mkApp([{ ...despensaBase[0], qty: 4 }, despensaBase[1]]);        // cubierta al arrancar
    expect(nombresDe(app)).toEqual(["Merluza"]);
    app.document.querySelector('[data-del="y1"]').click();
    expect(nombresDe(app)).toEqual(["Yogur", "Merluza"]);
    const guardado = JSON.parse(app.localStorage.getItem("mrcheff.foods"));
    expect(guardado.some(f => f.id === "y1")).toBe(false);                      // borrado persistido
  });
});
