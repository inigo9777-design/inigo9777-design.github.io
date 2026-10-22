#!/usr/bin/env node
// Plancha de CONTACTO para auditar a ojo las fotos del catálogo (feature imagenes-recetas-cards).
// Genera sheets HTML (id + título de la receta + thumb) y las captura a PNG en reports/ui-brave/
// para revisión (el primer hit de Commons puede traer el plato equivocado — se corrige con el
// mapa MANUALES de scripts/imagenes-recetas.mjs y se vuelve a correr, es reanudable).
// Uso: node scripts/plancha-fotos.mjs [id1,id2,…] — con lista, plancha SÓLO esos ids en una página.
import { writeFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const cat = (await import("../data/recetas-espanolas-data.js")).default;
const DESTINO = join(RAIZ, "img", "recetas");
const OUT = join(dirname(RAIZ), "reports", "ui-brave");
const POR_PAGINA = 42;

const solo = process.argv[2] ? process.argv[2].split(",") : null;
const ficheros = new Set(readdirSync(DESTINO).map(f => f.normalize("NFC")));
const conFoto = cat.filter(r => ficheros.has((r.id + ".jpg").normalize("NFC")))
  .filter(r => !solo || solo.includes(r.id));
console.log(`Con foto: ${conFoto.length}/${cat.length}`);
if (!conFoto.length) { console.log("Nada que planchar."); process.exit(0); }

for (let pagina = 0; pagina * POR_PAGINA < conFoto.length; pagina++) {
  const tanda = conFoto.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
  const html = `<!doctype html><meta charset="utf-8"><style>
    body { margin: 0; font: 12px/1.3 -apple-system, sans-serif; background: #fff; }
    nav { padding: 8px 12px; font-weight: 700; }
    .grid { display: grid; grid-template-columns: repeat(6, 1fr); }
    figure { margin: 0; padding: 6px; border-bottom: 1px solid #eee; }
    img { width: 100%; height: 120px; object-fit: cover; display: block; border-radius: 4px; }
    figcaption { margin-top: 4px; overflow-wrap: anywhere; } b { color: #333 } small { color: #999 }
  </style><nav>Página ${pagina + 1}</nav><div class="grid">${tanda.map(r => `
    <figure><img src="file://${join(DESTINO, r.id + ".jpg")}">
    <figcaption><b>${r.title}</b><br><small>${r.id}.jpg</small></figcaption></figure>`).join("")}</div>`;
  await writeFile(join(OUT, `plancha-${pagina + 1}.html`), html);
}

const browser = await chromium.launch({ executablePath: "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser", headless: true });
try {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1650 } });
  const p = await ctx.newPage();
  const numPaginas = Math.ceil(conFoto.length / POR_PAGINA);
  // Un sheet por página: alto 1650 ≈ 6 filas de thumbs con su pie — legible al leer el PNG.
  for (let pagina = 1; pagina <= numPaginas; pagina++) {
    await p.goto("file://" + join(OUT, `plancha-${pagina}.html`));
    await p.waitForTimeout(400);
const fichero = solo ? "78-plancha-quirofano.png" : `78-plancha-fotos-${pagina}.png`;
    await p.screenshot({ path: join(OUT, fichero), fullPage: false });
  }
} finally { await browser.close(); }
console.log("Plancha lista");
