// e2e/sello-origen.mjs — Escenario del bug reportado: copia guardada con source:'curada' duplicaba
// "Receta española" en el modal; y el flujo nuevo de sello (editor/estrella) conserva el origen original.
import { chromium } from "playwright-core";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const catalogo = require("../data/recetas-espanolas-data.js");
const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const APP = "file://" + path.resolve(fileURLToPath(new URL("../index.html", import.meta.url)));
const OUT = path.resolve(fileURLToPath(new URL("../../reports/ui-brave/", import.meta.url)));

const recetaUsuario = [{
  id: "uid-1", title: "Pizza jamón y queso casera", meal: "cena",
  source: "curada", from: "Receta española",
  ingredients: ["Masa", "Queso"], method: ["Hornea"], createdAt: 1,
}];
const tiramisu = catalogo.find(r => r.id === "tiramisu-casero");
const pantry = [...new Set(tiramisu.ingredients)].map((n, i) =>
  JSON.stringify({ id: "f-" + i, name: n, qty: 5, min: 1, score: 5, checked: false, createdAt: i }));

const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
let ok = true;
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });

  // ===== (A) El caso del usuario: card + modal SIN duplicar "Receta española" =====
  const p = await ctx.newPage();
  await p.addInitScript(`localStorage.setItem("mrcheff.recipes", JSON.stringify(${JSON.stringify(recetaUsuario)}));`);
  await p.goto(APP);
  await p.locator('.topbar .tab[data-view="recipes"]').click();
  await p.waitForSelector("#recipe-list .recipe-card");
  const cardTags = await p.evaluate(() =>
    [...document.querySelectorAll("#recipe-list .recipe-card .recipe-meta .tag")].map(t => t.textContent.trim()));
  await p.locator("#recipe-list .recipe-card").first().click();
  await p.waitForSelector("#modal:not(.hidden)");
  const modalTags = await p.evaluate(() =>
    [...document.querySelectorAll("#modal-content .recipe-meta .tag")].map(t => t.textContent.trim()));
  console.log("A tarjeta:", JSON.stringify(cardTags));
  console.log("A modal:  ", JSON.stringify(modalTags));
  const esperado = ["🌙 Cena", "Receta española"];
  const okA = JSON.stringify(cardTags) === JSON.stringify(esperado) && JSON.stringify(modalTags) === JSON.stringify(esperado);
  console.log("A sin duplicado:", okA);
  await p.screenshot({ path: path.join(OUT, "14-sello-origen-a-sin-duplicado.png"), fullPage: true });
  await p.keyboard.press("Escape");

  // ===== (B) Flujo nuevo: idea italiana → ✏️ renombrar → guardar → sello 'italiana' persiste =====
  const p2 = await ctx.newPage();
  await p2.addInitScript(`localStorage.clear(); localStorage.setItem("mrcheff.foods", JSON.stringify([${pantry.join(",")}]));`);
  await p2.goto(APP);
  await p2.locator('.topbar .tab[data-view="innovation"]').click();
  await p2.locator("#btn-generate-innov").click();
  await p2.waitForSelector("#innovation-list .recipe-card");
  await p2.locator("#innovation-list .recipe-card [data-edit]").first().click();
  await p2.waitForSelector("#edit-title");
  await p2.fill("#edit-title", "Pizza de mascarpone casera");
  await p2.locator("[data-save-edit]").click();
  await p2.waitForTimeout(250);
  const guardadas = await p2.evaluate(() => JSON.parse(localStorage.getItem("mrcheff.recipes")));
  console.log("B guardada:", JSON.stringify(guardadas.map(r => ({ title: r.title, origen: r.origen, source: r.source }))));
  await p2.locator('.topbar .tab[data-view="recipes"]').click();
  await p2.waitForSelector("#recipe-list .recipe-card");
  const cardB = await p2.evaluate(() =>
    [...document.querySelectorAll("#recipe-list .recipe-card .recipe-meta .tag")].map(t => t.textContent.trim()));
  console.log("B tarjeta:", JSON.stringify(cardB));
  const okB = guardadas.length === 1 && guardadas[0].origen === "italiana"
    && JSON.stringify(cardB) === JSON.stringify(["🌙 Cena", "Receta italiana"]);
  console.log("B sello italiano + badge único:", okB);
  await p2.screenshot({ path: path.join(OUT, "14-sello-origen-b-italiana.png"), fullPage: true });

  ok = okA && okB;
} finally {
  await browser.close();
}
if (!ok) process.exit(1);
