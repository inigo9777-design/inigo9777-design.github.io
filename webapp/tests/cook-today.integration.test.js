// tests/cook-today.integration.test.js — CAPA INTEGRACIÓN (Capa 2, §6 de .opencode/rules/CODING_STANDARDS.md).
// Ejerce el flujo "🍳 Cocinar hoy" desde la vista RECETAS (feature 2026-10-18):
//   1) La tarjeta de Mis Recetas lleva el botón EN SOLO ICONO (🍳) y, al pulsarlo, registra la
//      entrada en mrcheff.cooked (título + keyFingerprint + ancla on=HOY) SIN abrir el modal.
//   2) El modal de detalle (abrir con click en la tarjeta) lleva el botón con ICONO + TEXTO
//      "🍳 Cocinar hoy" en el pie y aplica la MISMA lógica (helper compartido en app.js sobre
//      menuSemanal.cookEntry — mismo fingerprint que cooldown de 7 días de Sugerencias/Menú).
// Arranca la app REAL vía bootApp() e interacciona sólo por DOM, como un usuario.

const { bootApp } = require("./boot");

const recetaSeed = {
  id: "r-1",
  title: "Tortilla de patatas",
  meal: "comida",
  ingredients: ["Patata", "Huevo"],
  method: ["Pela la patata", "Cuaja la tortilla"],
  createdAt: 1700000000000,
};

const hoy = new Date().toISOString().slice(0, 10);   // misma fórmula que app.js (const today)

describe('Vista Recetas — botón "🍳 Cocinar hoy" (icono en tarjeta, icono+texto en el modal)', () => {
  it("la tarjeta lleva el botón SOLO ICONO y al pulsarlo anota mrcheff.cooked (fingerprint + on=HOY) sin abrir el modal", () => {
    const { document, localStorage } = bootApp({ seed: { foods: [], recipes: [recetaSeed], innov: [], cooked: [] } });

    const card = document.querySelector("#recipe-list .recipe-card");
    expect(card).not.toBeNull();
    const btnCook = card.querySelector("[data-cook]");
    expect(btnCook).not.toBeNull();
    expect(btnCook.textContent.trim()).toBe("🍳");          // versión SOLO ICONO en la tarjeta
    expect(btnCook.getAttribute("title")).toBe("Cocinar hoy");

    btnCook.click();

    // No se abre el modal (acción directa de la tarjeta) y SÍ se persiste la entrada:
    expect(document.getElementById("modal").classList.contains("hidden")).toBe(true);
    const cooked = JSON.parse(localStorage.getItem("mrcheff.cooked") || "[]");
    expect(cooked.length).toBe(1);
    expect(cooked[0].title).toBe("Tortilla de patatas");
    expect(cooked[0].on).toBe(hoy);
    expect(typeof cooked[0].keyFingerprint).toBe("string");
    expect(cooked[0].keyFingerprint.length).toBeGreaterThan(0);
  });

  it("el modal de detalle lleva el botón ICONO + TEXTO '🍳 Cocinar hoy' y aplica la MISMA lógica al pulsarlo", () => {
    const { document, localStorage } = bootApp({ seed: { foods: [], recipes: [recetaSeed], innov: [], cooked: [] } });

    document.querySelector("#recipe-list .recipe-card").click();   // abre el detalle
    const modal = document.getElementById("modal");
    expect(modal.classList.contains("hidden")).toBe(false);

    const btnCook = document.querySelector("#modal-content [data-cook]");
    expect(btnCook).not.toBeNull();
    expect(btnCook.textContent.trim()).toBe("🍳 Cocinar hoy");     // versión ICONO + TEXTO en el modal

    btnCook.click();

    const cooked = JSON.parse(localStorage.getItem("mrcheff.cooked") || "[]");
    expect(cooked.length).toBe(1);
    expect(cooked[0].title).toBe("Tortilla de patatas");
    expect(cooked[0].on).toBe(hoy);
  });

  it("tarjeta y modal dejan la MISMA huella que el flujo de Sugerencias: fingerprint igual para el mismo plato", () => {
    const a = bootApp({ seed: { foods: [], recipes: [recetaSeed], innov: [], cooked: [] } });
    a.document.querySelector("#recipe-list .recipe-card [data-cook]").click();
    const porTarjeta = JSON.parse(a.localStorage.getItem("mrcheff.cooked"))[0];

    const b = bootApp({ seed: { foods: [], recipes: [recetaSeed], innov: [], cooked: [] } });
    b.document.querySelector("#recipe-list .recipe-card").click();
    b.document.querySelector("#modal-content [data-cook]").click();
    const porModal = JSON.parse(b.localStorage.getItem("mrcheff.cooked"))[0];

    expect(porTarjeta.keyFingerprint).toBe(porModal.keyFingerprint);   // cooldown cross-vista garantizado
  });
});
