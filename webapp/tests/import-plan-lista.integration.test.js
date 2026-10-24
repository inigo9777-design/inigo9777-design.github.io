// tests/import-plan-lista.integration.test.js — integración (CODING_STANDARDS.md §6) de la
// REGLA del transporte del plan semanal (petición 2026-10-21) por la vía MANUAL: importar una
// copia de seguridad (.json) trae el plan APROBADO con TODA su información (plan 7×3 + needyFoods
// = la lista de la compra) y lo recupera VIVO a la vista; un PREVIEW no aprobado NO se recupera
// jamás (defensivo: copias v2 antiguas que pudieran llevarlo). El wiring cruza DOM+storage
// (commitImport del import manual), así que es obligatoria como integración;
// la regla PURA vive en modules/backup.js (test unit) y modules/menu-semanal.js.

const { bootApp } = require("./boot");

const dias = () => Array.from({ length: 7 }, (_, i) => ({ dayLabel: `Día ${i + 1}`, meals: [] }));

const semanaAprobada = () => ({
  approved: true, generatedOn: "2026-10-21",
  includeUnavailable: false, plan: dias(), colapsado: false,
  needyFoods: [{ name: "Leche", qty: 1, min: 0, score: 5 }]
});

const copia = weekmenu => JSON.stringify({
  version: 2, exportedAt: "2026-10-21T10:00:00.000Z",
  foods: [{ id: "f1", name: "Tomate", score: 5, qty: 2, min: 1, checked: true, createdAt: 1000 }],
  recipes: [], innovations: [], innovDay: "",
  cooked: [], weekmenu
});

// Importa UN fichero por la vía real de la vista: #import-file + evento change (jsdom trae File
// y FileReader). Espera activa porque FileReader.onload es asíncrono.
async function importaFichero(app, contenido) {
  const archivo = new app.window.File([contenido], "dataBackup-2026-10-21-10-00-00.json", { type: "application/json" });
  const input = app.document.getElementById("import-file");
  Object.defineProperty(input, "files", { value: [archivo] });
  input.dispatchEvent(new app.window.Event("change", { bubbles: true }));

  const limite = Date.now() + 4000;
  for (;;) {
    const texto = app.document.getElementById("import-note");
    if (texto && !texto.classList.contains("hidden") && texto.textContent.length > 0) return texto;
    if (Date.now() > limite) throw new Error("timeout: el import no terminó");
    await new Promise(r => setTimeout(r, 15));
  }
}

describe("📥 Import manual — el plan APROBADO se recupera vivo con su lista de la compra (2026-10-21)", () => {

  it("copia v2 con plan aprobado: se adopta (LS + 7 días pintados + botón de Aprobar en estado final) y la Card 3 nace", async () => {
    const app = bootApp({});
    expect(app.window.localStorage.getItem("mrcheff.weekmenu")).toBeNull();    // dispositivo sin plan antes

    const nota = await importaFichero(app, copia(semanaAprobada()));
    expect(nota.textContent).toContain("Se añadieron 1 alimento(s) y 0 receta(s).");

    const adoptado = JSON.parse(app.window.localStorage.getItem("mrcheff.weekmenu"));
    expect(adoptado.approved).toBe(true);
    expect(adoptado.plan).toHaveLength(7);
    expect(adoptado.needyFoods.map(f => f.name)).toEqual(["Leche"]);           // la compra viaja con el plan

    expect(app.document.querySelectorAll("#menu-plan-list .menu-day")).toHaveLength(7);
    expect(app.document.getElementById("btn-menu-approve").disabled).toBe(true);
    expect(app.document.getElementById("btn-menu-approve").textContent).toBe("✅ Plan aprobado");
    const filas = [...app.document.querySelectorAll("#shopping-list ul li")].map(li => li.textContent);
    expect(filas.some(t => t.includes("Leche"))).toBe(true);                   // la Leche no está en la despensa importada
  });

  it("copia v2 ANTIGUA con un preview no aprobado: el plan NO se recupera y el resto del import sigue normal", async () => {
    const app = bootApp({});

    const nota = await importaFichero(app, copia({ approved: false, generatedOn: "2026-10-21", plan: dias() }));
    expect(nota.textContent).toContain("Se añadieron 1 alimento(s) y 0 receta(s).");
    expect(app.foods.some(f => f.name === "Tomate")).toBe(true);               // los alimentos sí entraron
    expect(app.window.localStorage.getItem("mrcheff.weekmenu")).toBeNull();    // el preview no se adopta jamás
    expect(app.document.querySelectorAll("#menu-plan-list .menu-day")).toHaveLength(0);
  });

  it("importar sobre un plan LOCAL ya aprobado: nada desaparece (el entrante no machaca el propio)", async () => {
    const app = bootApp({
      seed: { weekmenu: Object.assign(semanaAprobada(), { needyFoods: [{ name: "Sal", qty: 1, min: 0, score: 5 }] }) }
    });

    await importaFichero(app, copia(semanaAprobada()));                        // entrante aprobado PERO el local ya tiene plan

    const propio = JSON.parse(app.window.localStorage.getItem("mrcheff.weekmenu"));
    expect(propio.approved).toBe(true);
    expect(propio.needyFoods.map(f => f.name)).toEqual(["Sal"]);               // NADA del plan local desaparece (§5)
  });
});
