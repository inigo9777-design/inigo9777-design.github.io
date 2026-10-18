// e2e/pwa-accesibilidad.mjs — Auditoría de ACCESIBILIDAD del PWA móvil con Brave REAL.
// Ejecutar:  node e2e/pwa-accesibilidad.mjs
// Cubre la task 2026-10-18 (zoom + a11y): (1) el viewport bloquea el zoom (user-scalable=no,
// maximum-scale=1), (2) el viewpager anuncia el cambio de vista por la región viva
// #aviso-vista (sr-only) y aria-current sigue a la vista, (3) RECORRIDO de objetivos
// táctiles ≥24px (WCAG 2.5.8 AA) en las 5 vistas + modal abierto, (4) RECORRIDO de
// contraste de texto (≥4.5; ≥3.0 para texto grande) en las 5 vistas + modal, también en
// modo CLARO. Los gestos se emulan con TouchEvent sintéticos (contexto hasTouch).
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BRAVE = "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser";
const APP = "file://" + path.resolve(fileURLToPath(new URL("../index.html", import.meta.url)));
const OUT_DIR = path.resolve(fileURLToPath(new URL("../../reports/ui-brave/", import.meta.url)));
mkdirSync(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ executablePath: BRAVE, headless: true });
let fallos = 0;
const ok = (cond, msg) => {
  console.log((cond ? "✔ " : "✘ ") + msg);
  if (!cond) fallos++;
};

// Swipe sintético (misma técnica que e2e/swipe-vistas.mjs)
async function swipe(page, sel, x1, y1, x2, y2) {
  await page.evaluate(({ s, ax, ay, bx, by }) => {
    const el = document.querySelector(s);
    if (!el) throw new Error("sin elemento para swipe: " + s);
    const mk = (x, y) => new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
    const a = mk(ax, ay);
    const b = mk(bx, by);
    el.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true, touches: [a], targetTouches: [a], changedTouches: [a] }));
    el.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [b] }));
  }, { s: sel, ax: x1, ay: y1, bx: x2, by: y2 });
}

// Inyecta en la página el escáner de accesibilidad (objetivos táctiles + contraste).
async function inyectarEscaner(page) {
  // Congelar transiciones/animaciones: escanear a mitad de un .18s de transición
  // daba colores fantasma (rgba a medio mezclar) en los falsos contrastes bajos.
  await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; }" });
  await page.evaluate(() => {
    const luminancia = (rgb) => {
      // rgb() → [r,g,b] 0..1 con gamma sRGB
      const m = rgb.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
      if (!m) return null;
      if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;    // fondo transparente
      const lin = (v) => {
        const s = v / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * lin(+m[1]) + 0.7152 * lin(+m[2]) + 0.0722 * lin(+m[3]);
    };
    const contraste = (fg, bg) => {
      const L1 = luminancia(fg);
      const L2 = luminancia(bg);
      if (L1 === null || L2 === null) return null;
      const [a, b] = L1 >= L2 ? [L1, L2] : [L2, L1];
      return (a + 0.05) / (b + 0.05);
    };
    const fondoDe = (el) => {
      let f = el;
      while (f) {
        const bg = getComputedStyle(f).backgroundColor;
        const m = bg.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
        // alfa < 0.06 (o transparente) → pasa al ancestro: fondos translúcidos decorativos
        // no definen el contraste real, lo definen las superficies sólidas de detrás
        if (m && (m[4] === undefined || parseFloat(m[4]) >= 0.06)) return bg;
        f = f.parentElement;
      }
      return null;
    };
    window.__escanearA11y = () => {
      const visibles = [...document.querySelectorAll("body *")].filter((el) => {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || el.classList.contains("sr-only")) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      // (A) objetivos táctiles < 24px: WCAG 2.5.8 Target Size Minimum (nivel AA)
      const pequenos = visibles
        .filter((el) => el.matches("button, a, input, select, textarea, [role='button']"))
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width < 24 || r.height < 24;
        })
        .map((el) => `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ").join(".") : ""} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`);
      // (B) contraste de texto: nodos con texto directo (no heredado de hijos)
      const bajos = [];
      for (const el of visibles) {
        const tieneTextoDirecto = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!tieneTextoDirecto) continue;
        const cs = getComputedStyle(el);
        const size = parseFloat(cs.fontSize);
        const bold = parseInt(cs.fontWeight, 10) >= 700;
        const min = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
        const bg = fondoDe(el);
        if (!bg) continue;
        const r = contraste(cs.color, bg);
        if (r === null) continue;
        if (r < min) {
          bajos.push({ el: `${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ").join(".") : ""}`, texto: (el.textContent || "").trim().slice(0, 30), fg: cs.color, bg, ratio: Math.round(r * 100) / 100, min });
        }
      }
      return { pequenos, bajos: bajos.slice(0, 12) };
    };
  });
}

try {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 780 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await ctx.newPage();
  await page.goto(APP);
  await page.waitForSelector(".topbar .tab");
  await inyectarEscaner(page);

  // (1) Zoom bloqueado por el viewport meta
  const vp = await page.evaluate(() => document.querySelector('meta[name="viewport"]')?.content || "");
  ok(vp.includes("user-scalable=no") && vp.includes("maximum-scale=1"), `(1) viewport bloquea el zoom (${vp})`);

  // (2) El swipe anuncia la vista por la región viva y aria-current viaja con ella
  const avisoLista = await page.evaluate(() => {
    const a = document.getElementById("aviso-vista");
    return { presente: !!a, srOnly: !!a?.classList.contains("sr-only"), live: a?.getAttribute("aria-live"), role: a?.getAttribute("role") };
  });
  ok(avisoLista.presente && avisoLista.srOnly && avisoLista.live === "polite" && avisoLista.role === "status",
    "(2) #aviso-vista presente, sr-only, role=status, aria-live=polite");
  await swipe(page, ".content", 300, 320, 80, 322);                    // foods → recipes
  const anuncio = await page.evaluate(() => ({
    texto: document.getElementById("aviso-vista")?.textContent || "",
    current: document.querySelector(".tab[aria-current='true']")?.dataset.view || "",
  }));
  ok(anuncio.texto.includes("Recetas") && anuncio.current === "recipes",
    `(2) swipe → anuncio "${anuncio.texto}" y aria-current=${anuncio.current}`);
  await swipe(page, ".content", 80, 320, 300, 318);                    // recipes → foods
  const anuncio2 = await page.evaluate(() => document.getElementById("aviso-vista")?.textContent || "");
  ok(anuncio2.includes("Alimentos"), `(2) swipe de vuelta → anuncio "${anuncio2}"`);

  // (3)+(4) Auditar las 5 vistas y el modal en MODO OSCURO
  const receta = { id: "seed-a11y-movil", title: "Lentejas de prueba", meal: "comida", ingredients: ["Lentejas", "Cebolla"], method: ["Remojar", "Cocer"], createdAt: 1 };
  await page.evaluate((r) => localStorage.setItem("mrcheff.recipes", JSON.stringify([r])), receta);
  await page.reload();
  await page.waitForSelector(".topbar .tab");
  await inyectarEscaner(page);           // la inyección no sobrevive a la recarga

  const vistas = ["foods", "recipes", "innovation", "suggest", "seasonal"];
  let limpioVistas = true, detalle = [];
  for (const v of vistas) {
    await page.click(`.tab[data-view='${v}']`);
    const res = await page.evaluate(() => window.__escanearA11y());
    if (res.pequenos.length || res.bajos.length) {
      limpioVistas = false;
      detalle.push({ vista: v, ...res });
    }
  }
  ok(limpioVistas, "(3+4) 5 vistas moviles: objetivos ≥24px y contraste OK" + (limpioVistas ? "" : ` — ${JSON.stringify(detalle)}`));

  // Modal abierto: también se audita (targets + contraste dentro de la hoja)
  await page.click(".tab[data-view='recipes']");
  await page.waitForSelector("#recipe-list .recipe-card");
  await page.click("#recipe-list .recipe-card");
  await page.waitForSelector("#modal:not(.hidden)");
  const modalA11y = await page.evaluate(() => window.__escanearA11y());
  ok(!modalA11y.pequenos.length && !modalA11y.bajos.length,
    "(3+4) modal abierto: objetivos ≥24px y contraste OK" + ((!modalA11y.pequenos.length && !modalA11y.bajos.length) ? "" : ` — ${JSON.stringify(modalA11y)}`));
  await page.screenshot({ path: path.join(OUT_DIR, "27-a11y-movil-modal.png") });
  await page.click("#modal-content [data-close]");
  await page.waitForFunction(() => document.getElementById("modal").classList.contains("hidden"));
  await page.evaluate(() => localStorage.removeItem("mrcheff.recipes"));

  // (5) MODO CLARO: repaso rápido (foods + modal)
  await page.click("#theme-toggle");
  await page.click(".tab[data-view='foods']");
  const claroFoods = await page.evaluate(() => window.__escanearA11y());
  ok(!claroFoods.pequenos.length && !claroFoods.bajos.length,
    "(5) modo claro (foods): objetivos y contraste OK" + ((claroFoods.pequenos.length || claroFoods.bajos.length) ? ` — ${JSON.stringify(claroFoods)}` : ""));
  await page.screenshot({ path: path.join(OUT_DIR, "27-a11y-movil-claro-foods.png") });
  await page.click("#theme-toggle");

  // (6) Topbar móvil: caja fuerte SIEMPRE círculo 38×38 (idéntico al toggle del tema) y
  //     la fila marca+clúster no se derrama a una 2ª fila al ACTIVAR la vista de Copia —
  //     el antipatrón táctil era el despliegue de la etiqueta (botón 207px, y=56 vs y=10).
  await page.click(".tab-side");
  await page.waitForTimeout(350);
  const cajaEstado = await page.evaluate(() => {
    const r = (s) => { const el = document.querySelector(s); const b = el.getBoundingClientRect(); return { y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
    const brand = r(".brand"), acciones = r(".topbar-actions"), caja = r(".tab-side"), toggle = r("#theme-toggle");
    const label = document.querySelector(".tab-side .tab-label");
    return {
      brand, acciones, caja, toggle,
      labelOculta: label ? getComputedStyle(label).display === "none" : true,
      radio: getComputedStyle(document.querySelector(".tab-side")).borderRadius,
      mismaFila: Math.abs(brand.y - acciones.y) < 2,
      circulo: Math.abs(caja.w - caja.h) <= 2 && toggle.w === caja.w && toggle.h === caja.h,
    };
  });
  ok(cajaEstado.labelOculta && cajaEstado.circulo && cajaEstado.radio === "999px" && cajaEstado.mismaFila,
    `(6) caja fuerte móvil: círculo 38px como el toggle, etiqueta oculta y fila 1 sin derrame (${JSON.stringify(cajaEstado)})`);
  await page.click(".tab[data-view='foods']");

  await ctx.close();
} catch (err) {
  fallos++;
  console.error("✘ error inesperado:", err);
} finally {
  await browser.close();
}
console.log(fallos === 0 ? "\nA11Y MOVIL OK" : `\nFALLOS: ${fallos}`);
process.exit(fallos === 0 ? 0 : 1);
