// e2e/buscador-catalogo.mjs — verificación Brave del buscador del catálogo (tab Recetas).
import { chromium } from "playwright-core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = "file://" + path.resolve(fileURLToPath(new URL("../index.html", import.meta.url)));

const browser = await chromium.launch({ executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 960 } });
  const p = await ctx.newPage();
  await p.goto(APP);
  await p.locator('.topbar .tab[data-view="recipes"]').click();
  await p.waitForSelector("#recipe-catalog-search");

  // ¿la card está ENTRE crear receta y Mis Recetas (orden del DOM)?
  const orden = await p.evaluate(() => {
    const cards = [...document.querySelectorAll("#view-recipes > .card")];
    return cards.map(c => (c.querySelector("h2") || {}).textContent);
  });
  console.log("orden de cards en Recetas:", orden);

  // 1) búsqueda por título
  await p.fill("#recipe-catalog-search", "tortilla de patatas");
  await p.waitForTimeout(150);
  const titulos = await p.evaluate(() => [...document.querySelectorAll("#recipe-catalog-results .recipe-card h3")].map(h => h.textContent));
  console.log("tortilla de patatas →", titulos);
  await p.screenshot({ path: "../reports/ui-brave/16-buscador-titulo.png" });

  // 2) búsqueda por ingrediente (no en título) + badge italiana
  await p.fill("#recipe-catalog-search", "mascarpone");
  await p.waitForTimeout(150);
  const masc = await p.evaluate(() => [...document.querySelectorAll("#recipe-catalog-results .recipe-card")].map(c => c.querySelector("h3").textContent + " [" + [...c.querySelectorAll(".tag")].map(t => t.textContent).join("|") + "]"));
  console.log("mascarpone →", masc);

  // 3) click → modal de detalle
  await p.locator("#recipe-catalog-results .recipe-card").first().click();
  await p.waitForTimeout(150);
  const modal = await p.evaluate(() => ({
    oculto: document.getElementById("modal").classList.contains("hidden"),
    titulo: (document.querySelector("#modal-content h2") || {}).textContent
  }));
  console.log("modal tras click:", JSON.stringify(modal));
  await p.screenshot({ path: "../reports/ui-brave/16-buscador-modal.png" });
  await p.locator("#modal .modal-close").click();

  // 4) sin resultados
  await p.fill("#recipe-catalog-search", "zzzquinoa");
  await p.waitForTimeout(150);
  const vacio = await p.evaluate(() => ({
    empty: (document.getElementById("recipe-catalog-empty") || {}).textContent,
    visible: !document.getElementById("recipe-catalog-empty").classList.contains("hidden")
  }));
  console.log("sin resultados:", JSON.stringify(vacio));
  await p.screenshot({ path: "../reports/ui-brave/16-buscador-vacio.png" });
  console.log("E2E buscador → ver consola: 'orden' con la card en medio = OK");
} finally { await browser.close(); }
