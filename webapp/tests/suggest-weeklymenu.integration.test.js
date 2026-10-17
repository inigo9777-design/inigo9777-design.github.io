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

    // 2) El toggle de incluir no disponibles va ACTIVADO por defecto (semana completa; no hay que re-marcarlo)
    const include = document.getElementById("menu-include-unavailable");
    expect(include.checked).toBe(true);

    // 3) Generar menú → 7 filas renderizadas
    document.getElementById("btn-menu-generate").click();
    const slots = document.querySelectorAll("#menu-plan-list .menu-day");
    expect(slots.length).toBe(7);
    expect(document.getElementById("btn-menu-approve").disabled).toBe(false);

    // 4) Aprobar plan
    document.getElementById("btn-menu-approve").click();

    // cooked tiene UNA entrada por plato del plan, cada una anclada a la FECHA de SU día de la
    // semana planificado (próxima ocurrencia desde HOY, incluido HOY como día 0) → rango [HOY, HOY+6].
    const hoyTs = Date.parse(hoy() + "T00:00:00Z");
    const maxTs = hoyTs + 6 * 86400000;
    const cooked = JSON.parse(localStorage.getItem("mrcheff.cooked") || "[]");
    expect(cooked.length).toBeGreaterThan(0);
    cooked.forEach(entry => {
      const onTs = Date.parse(entry.on + "T00:00:00Z");
      expect(Number.isFinite(onTs)).toBe(true);
      expect(onTs).toBeGreaterThanOrEqual(hoyTs);   // nunca en el pasado
      expect(onTs).toBeLessThanOrEqual(maxTs);      // nunca a más de 6 días vista (la semana planificada)
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

  it("PERSISTENCIA al recargar: con un plan APROBADO ya en mrcheff.weekmenu, el arranque re-pinta las 7 filas, deja Aprobar en estado final y Card 3 visible (bug 2026-10-18: el menú desaparecía al refrescar)", () => {
    // Seed del estado que habría dejado la sesión anterior: plan aprobado persistido + despensa poco stock.
    const seedWeekmenu = {
      approved: true,
      includeUnavailable: true,
      generatedOn: hoy(),
      needyFoods: [{ name: "Perejil" }],
      plan: Array.from({ length: 7 }, (_, i) => ({
        dayLabel: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][i],
        recipe: i === 0
          ? { id: "r-seed", title: "Receta sembrada lunes", meal: "comida", ingredients: ["Perejil"], uses: [] }  // shape "idea" §5 (mínimo que consume renderWeeklyMenu)
          : null,
        missing: i === 0 ? ["Perejil"] : []
      }))
    };
    const handle = bootApp({ seed: { foods: foodsPocoStock, recipes: [], innov: [], cooked: [], weekmenu: seedWeekmenu } });
    const { document, localStorage } = handle;

    // El plan aprobado reaparece renderizado (7 filas .menu-day, sin necesidad de pulsar "Generar menú")
    const slots = document.querySelectorAll("#menu-plan-list .menu-day");
    expect(slots).toHaveLength(7);
    expect(slots[0].textContent).toContain("Receta sembrada lunes");
    expect(slots[0].textContent).toContain("Lunes");    // el día sigue siendo visible en cada fila
    expect(document.getElementById("menu-plan-list").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("menu-empty").classList.contains("hidden")).toBe(true);

    // Botón Aprobar en su estado final de plan ya aprobado
    const btnApprove = document.getElementById("btn-menu-approve");
    expect(btnApprove.disabled).toBe(true);
    expect(btnApprove.textContent).toContain("Plan aprobado");

    // Card 3 reaparece con el ítem pendiente (Perejil no está en la despensa sembrada)
    expect(document.getElementById("shopping-list").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("shopping-list").textContent).toContain("Perejil");

    // Los 7 slots con recipe=null muestran su día y "sin plato asignado" (no desaparecen del jueves en adelante)
    expect(slots[5].textContent).toContain("Sábado");
    expect(slots[5].textContent).toContain("sin plato asignado");

    // Estado de arranque limpio (ninguna excepción durante el re-render de persistencia)
    expect(handle.jsdomErrors).toEqual([]);
  });

  it("botón Limpiar: borra el plan persistido (mrcheff.weekmenu → null vía helpers), resetea la UI y deja Generar listo (regresión bug 2026-10-18: sin el <script> del módulo, Limpiar/Aprobar lanzaban en silencio)", () => {
    const { document, localStorage } = seedPocoStock();
    document.querySelector('[data-view="suggest"]').click();
    document.getElementById("btn-menu-generate").click();
    expect(document.querySelectorAll("#menu-plan-list .menu-day")).toHaveLength(7);
    document.getElementById("btn-menu-approve").click();
    expect(JSON.parse(localStorage.getItem("mrcheff.weekmenu")).approved).toBe(true);

    // Limpiar
    document.getElementById("btn-menu-clear").click();
    const weekmenu = JSON.parse(localStorage.getItem("mrcheff.weekmenu") || "null");
    expect(weekmenu).toBeNull();                      // estado limpio PERSISTIDO (no sólo en memoria)
    expect(document.getElementById("menu-plan-list").classList.contains("hidden")).toBe(true);
    expect(document.getElementById("menu-empty").classList.contains("hidden")).toBe(false);
    expect(document.getElementById("shopping-list").classList.contains("hidden")).toBe(true);
    const btnApprove = document.getElementById("btn-menu-approve");
    expect(btnApprove.disabled).toBe(true);           // se resetea y vuelve a estar deshabilitado hasta un nuevo menú
    expect(btnApprove.textContent).toBe("Aprobar plan");
    // y tras limpiar se puede generar de nuevo (no queda bloqueado)
    document.getElementById("btn-menu-generate").click();
    expect(document.querySelectorAll("#menu-plan-list .menu-day")).toHaveLength(7);
    expect(btnApprove.disabled).toBe(false);
  });
});
