// e2e/menu-colapsable.mjs — Brave: el plan APROBADO se PLEGA y siempre se vuelve a desplegar
// (feature 2026-10-21, petición del usuario: "El menú semanal se puede colapsar una vez aprobado,
// aunque siempre se puede volver a mostrar").
// Recorrido REAL: generar → aprobar → barra «N platos» + ▾ Plegar → plegar (grid fuera, LS
// colapsado:true, Card 3 intocada) → RECARGA (sigue plegada: el estado vive en mrcheff.weekmenu)
// → desplegar → preview nuevo SIN barra (sólo lo aprobado se pliega) → aprobar de nuevo (expandida).
import { chromium } from "playwright-core";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const APP = "file://" + path.resolve(fileURLToPath(new URL("../index.html", import.meta.url)));
const OUT_DIR = path.resolve(fileURLToPath(new URL("../..", import.meta.url)), "reports/ui-brave");
fs.mkdirSync(OUT_DIR, { recursive: true });

let contadas = 0;
const ok = (cond, msg) => { if (cond) { contadas++; console.log("✔ " + msg); } else { console.log("✘ " + msg); process.exitCode = 1; } };

const browser = await chromium.launch({ executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1020 } });
  const p = await ctx.newPage();
  // Despensa con stock para que la generación llene la semana (misma base que cocinar-post-aprobado)
  const foods = [
    ["Pan", 4], ["Tomate", 4], ["Aceite de oliva", 5], ["Huevos", 4],
    ["Leche", 4], ["Patata", 5], ["Cebolla", 3], ["Ajo", 2],
    ["Queso", 3], ["Jamón", 3], ["Arroz", 3], ["Pollo", 3], ["Manzana", 4], ["Yogur", 4],
  ].map(([name, qty], i) => JSON.stringify({ id: "f-" + i, name, qty, min: 1, score: 5, checked: false, createdAt: i }));
  await p.addInitScript(`if (!localStorage.getItem("mrcheff.foods")) {   // sólo la 1ª carga: la RECARGA conserva el estado real (incluido el plegado)
    localStorage.setItem("mrcheff.tutorial", JSON.stringify({ visto: true }));
    localStorage.setItem("mrcheff.foods", JSON.stringify([${foods.join(",")}])); }`);
  await p.goto(APP);
  await p.locator('.topbar .tab[data-view="suggest"]').click();
  await p.locator("#btn-menu-generate").click();
  await p.waitForSelector("#menu-plan-list .menu-day");

  const barraPreview = await p.evaluate(() => document.getElementById("menu-plan-bar").classList.contains("hidden"));
  ok(barraPreview, "(1) PREVIEW sin aprobar: aún NO hay barra de plegado (sólo la semana ya comprometida se pliega)");

  await p.locator("#btn-menu-approve").click();
  await p.waitForTimeout(200);
  const estado = await p.evaluate(() => {
    const barra = document.getElementById("menu-plan-bar");
    const btn = document.getElementById("btn-menu-colapsar");
    return {
      barVisible: !barra.classList.contains("hidden"),
      titulo: document.getElementById("menu-plan-title").textContent,
      etiqueta: btn.textContent.trim(),
      expandido: btn.getAttribute("aria-expanded"),
      listaVisible: !document.getElementById("menu-plan-list").classList.contains("hidden"),
      dias: document.querySelectorAll("#menu-plan-list .menu-day").length,
      card3Visible: !document.getElementById("shopping-list").classList.contains("hidden"),
    };
  });
  ok(estado.barVisible && estado.listaVisible && estado.dias === 7, `(2) plan aprobado: barra visible y semana (7 días) desplegada — ${estado.titulo}`);
  ok(/— \d+ plat/.test(estado.titulo), "(3) el resumen lleva el conteo del plan: " + estado.titulo);
  ok(estado.etiqueta === "▾ Plegar" && estado.expandido === "true", "(4) botón en estado expandido (▾ Plegar, aria-expanded=true)");

  // PLEGAR
  await p.locator("#btn-menu-colapsar").click();
  await p.waitForTimeout(150);
  const plegado = await p.evaluate(() => ({
    listaVisible: !document.getElementById("menu-plan-list").classList.contains("hidden"),
    etiqueta: document.getElementById("btn-menu-colapsar").textContent.trim(),
    expandido: document.getElementById("btn-menu-colapsar").getAttribute("aria-expanded"),
    card3Visible: !document.getElementById("shopping-list").classList.contains("hidden"),
    barVisible: !document.getElementById("menu-plan-bar").classList.contains("hidden"),
    lsColapsado: JSON.parse(localStorage.getItem("mrcheff.weekmenu")).colapsado,
  }));
  ok(!plegado.listaVisible && plegado.barVisible, "(5) Plegado: la semana fuera de la vista y la barra de resumen sigue (p. ej. «21 platos»)");
  ok(plegado.etiqueta === "▸ Desplegar" && plegado.expandido === "false", "(6) el mismo botón ofrece desplegar (▸ Desplegar, aria-expanded=false)");
  ok(plegado.lsColapsado === true, "(7) el estado persiste en mrcheff.weekmenu.colapsado=true");
  ok(plegado.card3Visible === estado.card3Visible, "(8) la Card 3 (lista de la compra) NO cambia por el plegado");
  await p.screenshot({ path: path.join(OUT_DIR, "35-menu-colapsado.png") });   // estado plegado

  // RECARGA: el plegado es estado persistido, no de sesión
  await p.reload();
  await p.waitForSelector("#view-foods.active", { timeout: 3000 });   // el arranque cae en Alimentos
  await p.locator('.topbar .tab[data-view="suggest"]').click();
  const aplaRecarga = await p.evaluate(() => ({
    listaVisible: !document.getElementById("menu-plan-list").classList.contains("hidden"),
    barraVisible: !document.getElementById("menu-plan-bar").classList.contains("hidden"),
    etiqueta: document.getElementById("btn-menu-colapsar").textContent.trim(),
  }));
  ok(aplaRecarga.barraVisible && !aplaRecarga.listaVisible && aplaRecarga.etiqueta === "▸ Desplegar",
    "(9) tras recargar la página la semana SIGUE plegada (el estado es de la semana, no de la sesión)");

  // DESEPLEGAR: siempre posible
  await p.locator("#btn-menu-colapsar").click();
  await p.waitForTimeout(150);
  const abierto = await p.evaluate(() => ({
    listaVisible: !document.getElementById("menu-plan-list").classList.contains("hidden"),
    lsColapsado: JSON.parse(localStorage.getItem("mrcheff.weekmenu")).colapsado,
    dias: document.querySelectorAll("#menu-plan-list .menu-day").length,
  }));
  ok(abierto.listaVisible && abierto.lsColapsado === false && abierto.dias === 7, "(10) desplegar reintroduce la semana completa (7 días) y colapsado vuelve a false");

  // REGENERAR (preview de nuevo) → sin barra; aprobar otra vez → expandida (un plan nuevo nace abierto)
  await p.locator("#btn-menu-generate").click();
  await p.waitForTimeout(150);
  const preview2 = await p.evaluate(() => document.getElementById("menu-plan-bar").classList.contains("hidden"));
  ok(preview2, "(11) al volver a GENERAR (preview): la barra desaparece — el plegado vive en lo APROBADO");
  await p.locator("#btn-menu-approve").click();
  await p.waitForTimeout(150);
  const reAprobado = await p.evaluate(() => ({
    expandido: !document.getElementById("menu-plan-list").classList.contains("hidden"),
    etiqueta: document.getElementById("btn-menu-colapsar").textContent.trim(),
  }));
  ok(reAprobado.expandido && reAprobado.etiqueta === "▾ Plegar", "(12) replanificar y aprobar de nuevo: semana EXPANDIDA (un plan nuevo nace plegable pero abierto)");
} finally {
  await browser.close();
  console.log(`\nMENÚ COLAPSABLE OK — ${contadas} checks ✔ (pliega cuando quieras: el resumen manda y la lista de la compra queda viva)`);
}