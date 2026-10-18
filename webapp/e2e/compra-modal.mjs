// e2e/compra-modal.mjs — verificación Brave del modal "✅ comprado" de la lista de la compra
// (feature 2026-10-18: pregunta CUÁNTO se compró y su importancia antes de tocar la despensa).
import { chromium } from "playwright-core";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const APP = "file://" + path.resolve(fileURLToPath(new URL("../index.html", import.meta.url)));
const hoyISO = (d = new Date()) => d.toISOString().slice(0, 10);

// Semilla: menú aprobado con 2 needyFoods (Perejil sin stock + Tomates no existentes) — igual que el test de persistencia.
const plan = Array.from({ length: 7 }, (_, i) => ({
  dayLabel: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][i],
  meals: [
    { meal: "desayuno", recipe: null, missing: [] },
    { meal: "comida", recipe: i === 0 ? { id: "r-seed", title: "Receta sembrada", meal: "comida", ingredients: ["Perejil"], uses: [] } : null, missing: [] },
    { meal: "cena", recipe: null, missing: [] }
  ]
}));
const seedWeekmenu = {
  approved: true, includeUnavailable: true, generatedOn: hoyISO(),
  needyFoods: [{ name: "Perejil" }, { name: "Tomates" }], plan
};
const seedFoods = [JSON.stringify({ id: "f-perejil", name: "Perejil", qty: 0, min: 1, score: 5, checked: false, createdAt: 0 })];

const browser = await chromium.launch({ executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.addInitScript(`
    localStorage.clear();
    localStorage.setItem("mrcheff.foods", JSON.stringify([${seedFoods.join(",")}]));
    localStorage.setItem("mrcheff.weekmenu", JSON.stringify(${JSON.stringify(seedWeekmenu)}));
  `);
  await p.goto(APP);
  await p.locator('.topbar .tab[data-view="suggest"]').click().catch(async () => {
    // fallback: puede que la tab se llame distinto
    await p.locator(".topbar .tab").nth(3).click();
  });
  await p.waitForSelector("#shopping-list .alert-row, #shopping-list li");
  const nombre = await p.locator("#shopping-list [data-buy]").first().getAttribute("data-buy");
  console.log("ítem 1º de la compra:", nombre);

  // 1) Click "✅ comprado" → MODAL pregunta; la despensa NO cambia todavía
  await p.locator("#shopping-list [data-buy]").first().click();
  await p.waitForSelector("#modal:not(.hidden) #compra-qty");
  let foods = await p.evaluate(() => JSON.parse(localStorage.getItem("mrcheff.foods")));
  console.log("antes de confirmar, despensa sin cambios:", foods.length === 1 && foods[0].qty === 0);

  // 2) Cancelar → nada cambia y el modal cierra
  await p.locator("#modal [data-close]").last().click();
  await p.waitForTimeout(120);
  foods = await p.evaluate(() => JSON.parse(localStorage.getItem("mrcheff.foods")));
  console.log("tras CANCELAR sigue sin cambios:", foods.length === 1 && foods[0].qty === 0);

  // 3) Confirmar con qty=3, min=2, score=8 → Perejil (ya existía con qty 0) se ACTUALIZA en-situ
  await p.locator("#shopping-list [data-buy]").first().click();
  await p.waitForSelector("#modal:not(.hidden) #compra-qty");
  await p.fill("#compra-qty", "3");
  await p.fill("#compra-min", "2");
  await p.fill("#compra-score", "8");
  await p.screenshot({ path: "../reports/ui-brave/15-compra-modal.png" });
  await p.locator("#modal [data-buy-confirm]").click();
  await p.waitForTimeout(150);
  foods = await p.evaluate(() => JSON.parse(localStorage.getItem("mrcheff.foods")));
  const perejil = foods.find(f => f.name === "Perejil");
  console.log("tras CONFIRMAR: Perejil =", JSON.stringify(perejil));
  console.log("actualizado en-situ (sin alta nueva):", foods.length === 1 && perejil.qty === 3 && perejil.score === 8 && perejil.min === 2);

  const wm = await p.evaluate(() => JSON.parse(localStorage.getItem("mrcheff.weekmenu")));
  console.log("Perejil cruzado de la lista:", !wm.needyFoods.some(f => f.name === "Perejil"));
  const fila = await p.locator("#shopping-list li").count();
  console.log("filas restantes en Card 3:", fila, "(1 = sólo Tomates)");

  // 4) Alta NUEVA (Tomates no existía): qty/min por defecto del modal (1/1) + score 5
  await p.locator("#shopping-list [data-buy]").first().click();
  await p.waitForSelector("#modal:not(.hidden) #compra-qty");
  await p.fill("#compra-qty", "5");
  await p.locator("#modal [data-buy-confirm]").click();
  await p.waitForTimeout(150);
  foods = await p.evaluate(() => JSON.parse(localStorage.getItem("mrcheff.foods")));
  const tomates = foods.find(f => f.name === "Tomates");
  console.log("alta nueva Tomates:", JSON.stringify(tomates));
  console.log("OK alta nueva con qty/min pedidos:", !!tomates && tomates.qty === 5 && tomates.min === 1 && tomates.score === 5);
  await p.screenshot({ path: "../reports/ui-brave/15-compra-lista-actualizada.png" });

  console.log("E2E compra-modal: ver consola previa — todo 'true' ⇒ OK");
} finally { await browser.close(); }
