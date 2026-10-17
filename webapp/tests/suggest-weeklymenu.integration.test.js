// tests/suggest-weeklymenu.integration.test.js — CAPA INTEGRACIÓN (Capa 2, CODING_STANDARDS.md §6).
// Arranca la app REAL vía bootApp() e ejerce el flujo de Card 2 "Menú semanal" + Card 3 "Lista de la compra":
//   1) tab suggest activa #view-suggest
//   2) toggle "Incluir aunque no estén ahora disponibles" activado + "Generar menú" → 7 slots renderizados
//   3) "Aprobar plan" guarda mrcheff.weekmenu (aprobado=true, generatedOn=hoy) y registra cada receta del plan
//      en mrcheff.cooked con on=hoy. No toca recipes[] / Mis Recetas.
//   4) Card 3 aparece con needyFoods; marcar "✅ comprado" auto-añade el alimento a foods con {qty:0, min:0, score:5}
//      (idéntico a backup.mergeIncoming) y refresca la alerta semanal.

const { bootApp } = require("./boot");

// Poco stock: solo "Agua" (ninguna receta del catálogo curado la usa) → con includeUnavailable=true,
// buildWeeklyMenu llena los 7 slots por ram-B y todas las recetas traen missing → needyFoods poblado.
const foodsPocoStock = [
  { name: "Agua", qty: 5, min: 1, score: 5 },
];

const hoy = () => new Date().toISOString().slice(0, 10);

function seedPocoStock() {
  return bootApp({ seed: { foods: foodsPocoStock, recipes: [], innov: [], cooked: [] } });
}

describe("Card 2+3 'Menú semanal + lista de la compra' — integración", () => {
  it("genera menú de 7 días, aprueba (cooked con on=hoy, recipes[] intacto) y auto-add de foods al marcar comprado", () => {
    const { document, localStorage } = seedPocoStock();

    // 1) Activar la pestaña Sugerencias y menú
    const tab = document.querySelector('[data-view="suggest"]');
    expect(tab).not.toBeNull();
    tab.click();
    expect(document.getElementById("view-suggest").classList.contains("active")).toBe(true);

    // 2) Activar el toggle de incluir no disponibles
    const include = document.getElementById("menu-include-unavailable");
    include.click();
    expect(include.checked).toBe(true);

    // 3) Generar menú → 7 filas renderizadas
    document.getElementById("btn-menu-generate").click();
    const slots = document.querySelectorAll("#menu-plan-list .alert-row");
    expect(slots.length).toBe(7);
    expect(document.getElementById("btn-menu-approve").disabled).toBe(false);

    // 4) Aprobar plan
    document.getElementById("btn-menu-approve").click();

    // cooked tiene entradas con ancla = HOY real (no el label visual del día)
    const cooked = JSON.parse(localStorage.getItem("mrcheff.cooked") || "[]");
    expect(cooked.length).toBeGreaterThan(0);
    cooked.forEach(entry => {
      expect(entry.on).toBe(hoy());
      expect(typeof entry.id).toBe("string");
      expect(entry.id.length).toBeGreaterThan(0);
      expect(typeof entry.title).toBe("string");
      expect(entry.title.length).toBeGreaterThan(0);
      expect(typeof entry.keyFingerprint).toBe("string");
      expect(entry.keyFingerprint.length).toBeGreaterThan(0);
    });

    // weekmenu aprobado con generatedOn = hoy
    const weekmenu = JSON.parse(localStorage.getItem("mrcheff.weekmenu") || "null");
    expect(weekmenu).not.toBeNull();
    expect(weekmenu.approved).toBe(true);
    expect(weekmenu.generatedOn).toBe(hoy());
    expect(weekmenu.includeUnavailable).toBe(true);

    // No toca Mis Recetas / recipes[]
    expect(JSON.parse(localStorage.getItem("mrcheff.recipes") || "[]")).toEqual([]);

    // Card 3 visible si hay needyFoods (con poco stock y includeUnavailable=true sí los hay)
    expect(weekmenu.needyFoods.length).toBeGreaterThan(0);
    expect(document.getElementById("shopping-list").classList.contains("hidden")).toBe(false);

    // 5) Marcar el primer ítem como "comprado" → auto-add a foods con qty=0/min=0/score=5
    const primero = weekmenu.needyFoods[0].name;
    const btnBuy = document.querySelector("#shopping-list [data-buy]");
    expect(btnBuy).not.toBeNull();
    btnBuy.click();

    const foods = JSON.parse(localStorage.getItem("mrcheff.foods") || "[]");
    const añadido = foods.find(f => f.name.toLowerCase() === primero.toLowerCase());
    expect(añadido).not.toBeUndefined();
    expect(añadido.qty).toBe(0);
    expect(añadido.min).toBe(0);
    expect(añadido.score).toBe(5);

    // needyFoods ya no contiene ese ítem (se quitó al marcar comprado)
    const weekmenuTras = JSON.parse(localStorage.getItem("mrcheff.weekmenu") || "null");
    expect(
      weekmenuTras.needyFoods.some(f => f.name.toLowerCase() === primero.toLowerCase())
    ).toBe(false);

    // La alerta semanal se refrescó (renderWeeklyAlert se llamó) — sin excepciones en jsdom
    // (si fallara, bootApp ya habría capturado jsdomErrors; aquí sólo comprobamos que no explota).
  });
});
