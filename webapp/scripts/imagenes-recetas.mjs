#!/usr/bin/env node
// Detector de fotos REALES para las cards (feature imagenes-recetas-cards, 2026-10-22).
// Descarga de Wikimedia Commons una foto por receta del catálogo, la normaliza con `sips`
// (tool nativo de macOS: JPEG q70, lado máximo 900px) y la deja en webapp/img/recetas/<id>.jpg.
// SÓLO corre en tiempo de desarrollo — la app en runtime lee las fotos ya descargadas y su
// índice estático data/fotos-recetas-data.js (regenerado al final de la pasada).
// Uso: node scripts/imagenes-recetas.mjs  (a mano, nunca en CI: toca la red)
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { execFileSync } from "node:child_process";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));          // webapp/
const DESTINO = join(RAIZ, "img", "recetas");
const TEMP = join(tmpdir(), "mrcheff-fotos");
// Commons exige User-Agent descriptivo (política de la API; sin él hay 403).
const UA = "MrCheff-webapp/1.0 (descarga de fotos de recetas para prototipo; contacto: repo local)";

const cat = (await import("../data/recetas-espanolas-data.js")).default;

// Ruido que slang los mejores resultados de Commons (qualifiers del título del catálogo).
const RUIDO = /\b(tradicional|auténtica|autentica|clásica|clasica|caseras?|casero|caliente|rápid[oa]|rapido|ligeras?|completo|estilo (griego|milanesa)|español[ae]?|espanol)\b/gi;
// Palabras de RESULTADO que delatan que la imagen NO es la comida (mapas, sellos, portadas,
// iglesias/gente/mercados — vistos en la auditoría de planchas de la 1ª pasada).
const RESULTADOS_MUERTE = /map|logo|svg|globe|coat of arms|flag|label|stamp|poster|book|cover|menu\b|sign|diagram|chart|drawing|engraving|illustration|church|cathedral|iglesia|interior|market\b|mercado|portrait|waiter|bartender|street|road|plaza|monument|building|museum|soldier|army|seal\b/i;

// PUNTUACIÓN del candidato (2ª pasada del script): no vale el PRIMER hit del buscador de Commons —
// con títulos compuestos ("huevos en mollete andaluz") el primer resultado suele ser el ruido. Se
// puntúa el solape de TOKENS del título de la imagen con la búsqueda (token ≥3 letras): el plato
// correcto suele nombrar 2+ tokens ("Mollete ... jamón.jpg" para "huevos en mollete...").
function puntuar(nombreImagen, consulta) {
  const tokensImg = new Set(nombreImagen.toLowerCase().split(/\W+/u).filter(t => t.length >= 3));
  const tokensConsulta = new Set(consulta.toLowerCase().split(/\W+/u).filter(t => t.length >= 3));
  let aciertos = 0;
  tokensConsulta.forEach(t => { if (tokensImg.has(t)) aciertos++; });
  return aciertos;
}

// Reintentos de búsqueda: título qualificado → título limpio → primeras tokens.
function consultasDe(titulo) {
  const base = titulo.toLowerCase().replace(/[àáâä]/g, "a").replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i").replace(/[òóôö]/g, "o").replace(/[ùúûü]/g, "u");
  const limpio = base.replace(RUIDO, " ").replace(/\s+/g, " ").trim();
  const tokens = limpio.split(" ");
  return [...new Set([limpio, tokens.slice(0, 4).join(" "), tokens.slice(0, 3).join(" ")])].filter(Boolean);
}

// Búsquedas manuales para los platos que el título NO encuentra (2ª pasada, auditoría): id →
// consultas alternativas (términos que Commons SÍ palpa — el nombre común del plato o su primo
// visual reconocible, p. ej. "Cordon bleu" para los San Jacobos).
const MANUALES = {
  "tortita-avena-miel": ["oatmeal pancakes", "pancakes honey"],
  "bowl-yogur-granola": ["granola yogurt", "yogurt granola bowl"],
  "torrijas-desayuno": ["torrijas"],
  "torrijas-leche": ["torrijas"],
  "gazpacho-andaluz": ["gazpacho"],
  "sepia-calamar-guisada": ["sepia guisada", "cuttlefish stew"],
  "avellana-zapato": ["tuna wrap", "wrap sandwich"],
  "gazpachuelo": ["gazpachuelo"],
  "yogur-fresa": ["yogurt strawberries", "yogurt with strawberries"],
  "peras-vino": ["peras al vino", "poached pears wine", "pears red wine"],
  "langostinos-gamba": ["langostinos", "Norway lobster cooked"],
  "hinojo-merluza": ["merluza", "hake cooked"],
  "sopa-ajiaco": ["ajiaco canario", "ajiaco suppliers"],
  "lechon": ["lechón asado", "cochinillo asado"],
  "solomillo-pepitoria": ["pepitoria"],
  "lubina-papel": ["lubina papillote", "fish papillote"],
  "salmón-plancha": ["grilled salmon"],
  "cigala-salsa": ["cigalas", "langoustine cooked"],
  "huevos-perdidos": ["baked eggs"],
  "san-jacobo": ["cordon bleu", "san jacobos"],
  "bacalao-dorado": ["bacalao dorado", "bacalao al pil pil"],
  "churros-caseros": ["churros"],
  "mollete-chocolate-aceite": ["mollete"],
  "tostada-pavo-queso": ["turkey sandwich", "tostada pavo"],
  "bikini-sobrasada": ["bikini sandwich", "sándwich mixto"],
  "ensaimada-sobrasada": ["ensaimada"],
  "tostada-morcilla-huevo": ["morcilla huevo frito", "morcilla"],
  "revuelto-gulas": ["gulas al ajillo", "gulas"],
  "tostada-membrillo-queso": ["dulce de membrillo queso", "membrillo con queso"],
  "tostada-anchoas": ["anchovies toast", "anchoas tapas"],
  "alubias-rojas-chorizo": ["alubias chorizo", "alubias rojas"],
  "tosta-ricotta-pistachos": ["ricotta pistachio", "ricotta toast"],
  "frittata-espinacas": ["frittata"],
  "lasana-carne": ["lasagne", "lasaña"],
  "risotto-setas": ["risotto"],
  "pasta-aglio-olio": ["spaghetti aglio e olio"],
  "scaloppine-limon": ["scaloppine"],
  "saltimbocca-romana": ["saltimbocca alla romana"],
  // spotted en la auditoría de planchas (2ª ronda): plato CASADO pero la foto no mostraba el
  // pescado — rehacer con el nombre de la proteína principal.
  "trucha-navarra": ["fried trout", "trucha frying"],
  // 3ª ronda de auditoría (planchas tras el puntuado): las que aún salían con vida ajena al plato.
  "tostada-tomate-ajo": ["pa amb tomàquet", "pan tumaca"],
  "huevos-molletes": ["mollete bread", "mollete andaluz"],
  "tortilla-espanola": ["tortilla de patatas", "spanish omelette"],
  "torrijas-desayuno": ["torrija spain", "torrijas dulces"],
  "torrijas-leche": ["torrija spain", "torrijas dulces"],
  "sandwich-tomate": ["toasted sandwich cheese"],
  "hinojo-merluza": ["hake fillets"],
  "lengua-bistec": ["beef tongue sandwich", "tongue stew"],
  "bienmesabe": ["almond cream dessert"],
  "bacalao-albahaca": ["cod tomato"],
  "filete-marsala": ["escalope"],
  "pollo-cerveza": ["chicken stew", "guiso de pollo"],
  "pollo-estofado": ["chicken stew vegetables"],
  "cigala-salsa": ["scampi cooked", "langoustine cooked"],
  "dorada-horno": ["gilthead bream"],
  "sepia-plancha": ["grilled cuttlefish", "cuttlefish grilled"],
  "pollo-ajillo": ["garlic chicken dish", "pollos al ajillo"],
  "boquerones-fritos": ["deep fried anchovies"],
  "bacalao-dorado": ["bacalao"],
  "tostada-sobrasada-miel": ["sobrasada bread", "sobrasada tostada"],
  "tostada-jamon-tomate": ["jamón serrano"],
  "porras-caseras": ["porras churros spain"],
  "gachas-canela": ["cinnamon porridge", "porridge bowl cinnamon"],
  "leche-galletas": ["cookies milk", "petit beurre biscuit"],
  "rosquillas-anis": ["fried doughnuts", "donuts fried"],
  "fartons-horchata": ["fartons", "fartón"],
  "tostada-pavo-queso": ["turkey sandwich toasted"],
  "torta-aceite-queso": ["torta de aceite"],
  "tostada-morcilla-huevo": ["morcilla egg", "black pudding fried egg"],
  "tostada-cabra-miel": ["goat cheese toast honey"],
  "ajo-blanco-uvas": ["white gazpacho", "gazpacho blanco"],
  "pasta-amatriciana": ["spaghetti al pomodoro", "spaghetti tomato"],
};

function pedir(url, opciones = {}, reintento = 0) {
  return new Promise((resuelta, chasco) => {
    const req = (url.startsWith("http:") ? httpRequest : httpsRequest)(url, {
      headers: { "User-Agent": UA, ...(opciones.cabeceras || {}) },
      timeout: 20000,
    }, resp => {
      if (resp.statusCode === 429 && reintento < 2) {          // rate-limit: retroceso y suerte
        resp.resume();
        return setTimeout(() => pedir(url, opciones, reintento + 1).then(resuelta, chasco), 15000 * (reintento + 1));
      }
      if (resp.statusCode !== 200) { resp.resume(); return chasco(new Error("HTTP " + resp.statusCode + " en " + url)); }
      const trozos = [];
      resp.on("data", t => trozos.push(t));
      resp.on("end", () => resuelta(Buffer.concat(trozos)));
    });
    req.on("timeout", () => req.destroy(new Error("timeout " + url)));
    req.on("error", chasco);
    req.end();
  });
}

const pausa = ms => new Promise(r => setTimeout(r, ms));

async function buscarComunes(consulta) {
  const url = "https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2" +
    "&generator=search&gsrnamespace=6&gsrlimit=8" +
    "&gsrsearch=" + encodeURIComponent(consulta + " filetype:bitmap") +
    "&prop=imageinfo&iiprop=url|size|mime|mediatype&iiurlwidth=800";
  const cuerpo = JSON.parse((await pedir(url)).toString("utf8"));
  const paginas = cuerpo?.query?.pages || [];
  return paginas
    .filter(p => p.imageinfo?.length)
    .map(p => ({ nombre: p.title, info: p.imageinfo[0] }))
    .filter(({ nombre, info }) =>
      info.mediatype === "BITMAP" &&
      (info.mime === "image/jpeg" || info.mime === "image/png") &&
      info.width >= 500 && !RESULTADOS_MUERTE.test(nombre) &&
      (info.thumbwidth < 1100 || true));
}

async function unaFoto(receta) {
  const consultas = MANUALES[receta.id]
    ? [...(Array.isArray(MANUALES[receta.id]) ? MANUALES[receta.id] : [MANUALES[receta.id]])]
    : consultasDe(receta.title);
  for (const consulta of consultas) {
    await pausa(1300);                                       // ritmo: la API limita por IP
    let aciertos = [];
    try { aciertos = await buscarComunes(consulta); } catch { continue; }
    if (!aciertos.length) continue;
    // Puntuado por solape de tokens (2ª pasada): gana la imagen que MÁS tokens comparte con la
    // búsqueda; a igual solape, la primera. Si NINGÚN resultado comparte token (raro), se cae al
    // primer hit como la 1ª pasada — la auditoría de planchas decide los retazos con MANUALES.
    const conPuntos = aciertos.map((a, i) => ({ a, i, puntos: puntuar(a.nombre, consulta) }))
      .filter(x => x.puntos > 0).sort((x, y) => y.puntos - x.puntos || x.i - y.i);
    const elegida = conPuntos.length ? conPuntos[0].a : aciertos[0];
    const fuente = elegida.info.thumburl || elegida.info.url;
    const cruda = join(TEMP, receta.id + "-cruda");
    const final = join(DESTINO, receta.id + ".jpg");
    try {
      const bytes = await pedir(fuente);
      await writeFile(cruda, bytes);
      execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "70", "-Z", "900", cruda, "-o", final], { stdio: "ignore" });
      return { id: receta.id, nombre: elegida.nombre, consulta };
    } catch { continue; }
  }
  return null;
}

await mkdir(DESTINO, { recursive: true });
await mkdir(TEMP, { recursive: true });

// APFS compara los nombres de fichero de forma normalización-INSENSIBLE (NFC y NFD son la misma
// entrada), pero las comparaciones byte-a-byte de Node no: puede existir el fichero con la ÓN
// descompuesta y el id del catálogo llevar la compuesta. TODA existencia se comprueba normalizando
// a NFC — el nombre ESTRICTO nunca importa porque el FS resuelve igual las peticiones.
const tieneFoto = id => existsSync(join(DESTINO, id + ".jpg")) ||
  readdirSync(DESTINO).some(f => f.normalize("NFC") === (id + ".jpg").normalize("NFC"));

// En SERIE (el ritmo lo manda la pausa de unaFoto: la API limita por IP). Reanudable: los
// .jpg ya descargados de una pasada anterior se saltan.
for (const receta of cat) {
  process.stdout.write(`\r${cat.indexOf(receta) + 1}/${cat.length}`);
  if (tieneFoto(receta.id)) continue;
  await unaFoto(receta).catch(() => null);
}

// Índice estático para el runtime: lista de ids CON foto (data puro, igual que el catálogo).
const idsConFoto = cat.filter(r => tieneFoto(r.id)).map(r => r.id);
const salida = `// ÍNDICE de fotos de recetas (feature imagenes-recetas-cards, 2026-10-22). Generado por
// scripts/imagenes-recetas.mjs a partir de los .jpg presentes en webapp/img/recetas/ — NO editar
// a mano: regenerar con el script. Cada id de la lista tiene su img/recetas/<id>.jpg en el repo;
// toda receta cuyo id (o su título normalizado) caiga aquí muestra la foto en la card; el resto,
// placeholder del diseño (modules/fotos-recetas.js).
(function (root) {
  "use strict";
  root.MRCheff = root.MRCheff || {};
  root.MRCheff.fotosRecetas = [${idsConFoto.map(id => `"${id}"`).join(", ")}];
  if (typeof module !== "undefined" && module.exports) module.exports = root.MRCheff.fotosRecetas;
})(typeof window !== "undefined" ? window : globalThis);
`;
await writeFile(join(RAIZ, "data", "fotos-recetas-data.js"), salida);
await rm(TEMP, { recursive: true, force: true });

const noEncontradas = cat.filter(r => !idsConFoto.includes(r.id));
console.log(`\nFotos: ${idsConFoto.length}/${cat.length}`);
if (noEncontradas.length) console.log("Sin foto:\n" + noEncontradas.map(r => `${r.id} (${r.title})`).join("\n"));
