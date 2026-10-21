# AGENTS.md — Mr Cheff

Compact guide for AI agents, now the single canonical in-repo reference (its former sibling, the stale `CLAUDE.md`, was folded into it and removed). For product vision read `Readme.html`; team coding/testing standards live in `.opencode/rules/CODING_STANDARDS.md` (referenced below) and resolved BUGS are recorded in `bugfix.md`. When docs and code disagree, **trust this file + the code**.

## What this actually is
- A kitchen-assistant prototype. `Readme.html` badges it "Kotlin Multiplatform · Android · iOS",
  but the **only runnable code is a vanilla-JS static web app in `webapp/`**. There is **no KMP,
  no Gradle, no native target, and no backend** — do not assume one exists or try to build it.
- Repo boundary: this folder (`Mr Cheff`, the dir with `.git`) *is* the repository. The parent dir
  `IA LOCAL/` also contains an unrelated `Scripts-Utilities/` shell script — leave it alone.

## Commands (run from `webapp/` unless noted)
- **Run:** open `webapp/index.html` in a browser. No server or build step needed for the app.
  Para INSTALARLA como app (PWA): sí requiere servirla por https:// (o localhost en escritorio) —
  `cd webapp && python3 -m http.server 8000` → Brave ⋮ → "Instalar página como aplicación…";
  en móvil Android hay que alojarla en https (GitHub Pages / Netlify Drop). Abrirla por `file://`
  sigue funcionando exactamente igual (sin service worker, sin opción de instalar).
  There is no linter/formatter/typecheck for the app itself; "verify a change" = open index.html
  and exercise the affected tab.
- **Tests:** `cd webapp && npm test` (`jest`) / `npm run coverage` (`jest --coverage`). Jest IS a
  declared devDependency with installed `node_modules/`. Specs live under `webapp/tests/` — per-module specs (classify, priority, recipe-analysis, ingredient-matching, util, innovations,
  planner, menu-semanal, recipe-editor, recipe-missing, backup, origen-recetas, busqueda-recetas, swipe-tabs,
  merge-identidad, sync-crypto, diff-merge, ocr-despensa, ocr-foto) +
  integration specs (app, cook-today, recipe-edit, suggest-card1, suggest-rotation, suggest-weeklymenu,
  buscador-catalogo, e2e-flow-receta-a-alerta-compra, sync-protocol, sync-ui, ocr-ticket, ocr-foto) + harness scaffolding (`boot.js` / `setup.js`). As of the last
  run on 2026-10-20 the whole suite is green (**539 tests across 37 suites**) — verify with a fresh
  run before trusting it.
- **.gitignore** (since 2026-10-18) covers `node_modules/`, `webapp/coverage/*`, `reports/ui-brave/*`
  and `.DS_Store` (macOS metadata, also ignored via `~/.gitignore_global`). Never `git add -A`
  blindless with `webapp/node_modules/` present; `dataBackup/*.json` backups *are* tracked.

## Architecture (`webapp/`)
Single-page, six-tab app loaded via `index.html`. Script order (order matters): inline `<script>`
→ `data.js` → `app.js` (registers the one `DOMContentLoaded` closure; module `<script>`s load after
it but still before the DOM-ready event fires) → `modules/…` (`priority`, `classify`,
`recipe-analysis`, catalog data, `origen-recetas`, `innovations`, `util`, `backup`,
`ingredient-matching`, `sync-crypto`, `diff-merge`, `sync`, `planner`, `menu-semanal`, `recipe-missing`,
`recipe-editor`, `swipe-tabs`). `app.js`
is the composition-root, sectioned by `// ===== SECTION =====` banners. Files:

- **data.js** — static seasonal data; exposes `window.MR_CHEFF_DATA = { MESES, TEMPORADA }`. `app.js`
  depends on this having run first (keep the script order).
- **app.js** — composition-root: event wiring, persistence glue and HTML molds only; the domain
  logic lives in `modules/` (see below). Sectioned by banner.
- **style.css** — hand-written CSS (no framework); desde 2026-10-18 es un **sistema tokenizado**: todo color
  vive en `:root` (claro) / `[data-theme="dark"]` (oscuro), **ningún componente usa hex sueltos**; añadir un
  color nuevo = añadir token en ambos temas (con `color-scheme` nativo por tema). Tipografía: Georgia (serif
  editorial) para títulos/marca + sans del sistema para UI. [Light theme bug histórico: un texto basura fuera de
  comentario en la línea 2 (`Apply`) invalidaba el bloque `:root` entero del modo claro — parser CSS lo engulle
  como selector; mantener el fichero sin tokens basura fuera de comentario].

Views (5 main tabs + 1 side tab): **Alimentos** (pantry/restock alerts; escáner del TICKET de la
compra por OCR: "cámara" SÓLO en móvil vía `input capture` — escritorio pide una foto — y DOS
DIALOGOS de confirmación DENTRO de la pestaña: exactos del Inventario actual con la CANTIDAD
comprada editable + revisión con secciones Nuevos/Dudas (ver el bullet del escáner), módulo
`ocr-despensa.js`) · **Recetas**
(free-text → structured recipe; card "🔎 Buscador del catálogo" busca en el JSON del catálogo
SÓLO por título (fix 2026-10-20: los ingredientes ya NO puntúan — "mascarpone" ya no saca el
Tiramisú) y abre el modal de detalle — match por PREFIJO (petición 2026-10-20,
"menos letras"): el token escrito casa exacto preferente y si no con cualquier token del
TÍTULO que EMPIECE por él ("gamb"→"gambas", "croqu"→"croquetas"; título exacto x3, título
prefijo x2, así la afinidad real sigue mandando; tokens ≥3 letras vía
TOKEN_MIN_LEN del matcher — 1-2 letras no dan ruido); + Mis Recetas) · **Innovación**
(curated-catalog suggestions from the pantry) ·
**Sugerencias y menú** (↻ Sugerir ahora lote rotado + plan semanal 7×3 + lista de la compra) ·
**Temporada** (in-season fruit/veg by month) · **Copia de seguridad** (side icon tab). Every recipe
viewed anywhere (cards, plan slots, modal) shows an ORIGIN badge — "Receta española"/"Receta
italiana" (see `modules/origen-recetas.js` below).

- **`webapp/data/recetas-espanolas-data.js`** — curated catalog (IIFE + dual-export like
  `classify.js`/`priority.js`, loaded before `innovations.js`/`origen-recetas.js`): **200 records as of
  2026-10-18** (53 desayunos / 97 comidas / 50 cenas; the last 20 are ITALIAN home recipes). Each record is
  minimal: `{ id, title, meal: "desayuno"|"comida"|"cena", ingredients[], method[] }` (5-field schema).
  It also attaches `dataset.idsItalianas` (list of the 20 Italian ids, consumed by `origen-recetas.js`) as
  a PROPERTY of the exported array — `module.exports` stays a plain array for tests/e2e. New Italian
  recipe ⇒ also add its id to `idsItalianas`.
- **Comportamiento móvil (PWA, feature 2026-10-18):** (1) **Viewpager**: deslizar horizontal DENTRO
  de `.content` cambia a la vista vecina (wrap entre las 5 del nav; el tab lateral de backup NO
  entra en el carrusel) — decisión en el módulo puro `modules/swipe-tabs.js`, wiring touch +
  exclusiones (inputs/botones/scrollers-x) en app.js, e2e `e2e/swipe-vistas.mjs` (17 checks con
  TouchEvent sintéticos + `hasTouch`). El header sigue al swipe (fix 2026-10-19): `.tabs` es un
  scroller-x interno con scrollbar invisible y el pill activo se RECENTRA al cambiar de vista
  (bug: en Temporada el header mostraba aún "Alimentos y Recetas" — `scrollIzquierdaParaTab`
  decide en el módulo puro, `centrarTabActivo` en app.js mide y scrollea; con
  `prefers-reduced-motion` sin suavizado). **Memoria de scroll por vista** (petición 2026-10-20):
  cada tab recuerda dónde se quedó — el swipe RESTAURA esa posición sin animación (sujeta al alto
  scrolleable real) y el click directo en la categoría del topbar sube SIEMPRE arriba CON
  animación (`window.scrollTo({top:0, behavior:"smooth"})`, reduce-motion → "auto", try/catch
  para WebViews sin options object). API añadida a `modules/swipe-tabs.js` (6→7 públicas,
  objeto memoria puro sin DOM): `crearMemoriaScroll/recordarScroll/scrollParaVista` (default 0
  = arriba; filtra NaN/negativos/Infinity). En app.js la captura de la vista saliente vive
  DENTRO de `activarVista(view, origen)` ANTES de tocar las clases (el alto del documento
  cambia al ocultarse) y el call-site del swipe pasa `activarVista(destino, "swipe")`; el
  click que sube arriba resetea por sí solo la memoria de esa vista (al salir se captura su 0).
  Verificación: unit en `tests/swipe-tabs.test.js`, integración jsdom en
  `tests/viewpager-scroll.integration.test.js` (stubs de scrollY/innerHeight/scrollHeight +
  espía de scrollTo; boot.js trae sustituto de `window.scrollTo` — jsdom NO lo implementa) y
  e2e Brave real en `e2e/scroll-vistas.mjs` (clicks con `page.mouse`+coords: el
  `page.click(selector)` de Playwright mueve el scroll del documento con su
  scrollIntoViewIfNeeded previo; truco del `::after` de 3000px para alto constante en todas las
  vistas). (2) El documento NO tiene overflow-x
  (`html overflow-x:hidden` — SOLO en html: en body convertiría al body en scroll
  container y mataría el `position: sticky` del header topbar
  [fix 2026-10-19: se iba con la página en desktop y móvil]; el viewport hereda el
  overflow-x del html y el drag lateral sigue muerto) ni rebote (`html overscroll-behavior-y:contain`) ni fondo duro (`html
  background: var(--bg)`). (3) Modal: el div `#modal-content` DEBE llevar la clase `modal-content`
  (así vive en index.html; si se pierde, TODO el bloque editorial de la ficha en style.css —
  secciones con filete, sangría de listas, pie de botones igualados, filete con fade
  `.receta-linea` — deja de aplicarse: bug de 2026-10-19, la ficha se veía cruda por ese
  descuido). Pie de la ficha: botones repartidos igual (flex 1·1·0; 2×2 en ≤420px) y el
  consejero del botón (`data-tip` + píldora `.tip-chef`, delegado en `#modal-content`) SOLO en
  "🍳 Cocinar hoy" (petición 2026-10-19/20: Cerrar/Editar/Copiar van sin consejo):
  desktop hover/foco, móvil long-press de 450 ms que al soltar NO acciona el botón (su click
  queda suprimido, y el contacto NUEVO desarma la bandera). Con `.modal-box` con
  `overscroll-behavior:contain` + clase
  `modal-abierto` en `<html>` Y `<body>` (en Android scrollea `<html>`; si un día la quitáis,
  idem) congelando el scroll del documento. Blindaje de compatibilidad móvil (2026-10-20):
  `.modal` y `.modal-backdrop` llevan offsets EXPLÍCITOS `top/right/bottom/left` (el shorthand
  `inset` no existe en WebViews viejos y los diálogos salían pegados a la izquierda del móvil);
  `style.css` empieza por `@charset "UTF-8";` y la viñeta de ingredientes se escribe como escape
  ASCII `content: "\2022"` (evita el mojibake "â€¢" del carácter literal decodificado con otro
  charset). (4) `theme-color` meta sigue al tema activo (dark
  `#1b1913` / light `#ffffff`) desde el script de `<head>` y `applyTheme` — nunca hex sueltos
  de más en el markup. (5) **Zoom bloqueado** en el PWA (petición de producto 2026-10-19):
  viewport `maximum-scale=1.0, user-scalable=no` + preventDefault de
  `gesturestart/gesturechange` (iOS lo ignora desde iOS 10); tradeoff WCAG 1.4.4 asumido —
  el "forzar zoom" de los ajustes de Android puede reactivarlo y el zoom del sistema
  (tamaño de texto) no se toca. (6) **Auditoría de accesibilidad móvil** repetible con
  `node e2e/pwa-accesibilidad.mjs` (7 checks: metas de zoom, anuncio sr-only del cambio
  de vista por swipe vía `#aviso-vista` + aria-current, objetivos táctiles ≥24px y
  contraste de texto en las 5 vistas + modal, dark y claro): de ahí nacieron
  `min-width/height: 24px` para checkbox/radio y `min-height: 24px` para
  `input[type=range]`. Las transiciones se congelan para escanear (colores a mitad de
  transición = falsos contrastes bajos). (7) **Entrega del shell (sw.js)**: TODO (índice Y
  assets) va NETWORK-FIRST con revalidación (`fetch(req, {cache:"no-cache"})`); el caché
  (`mrcheff-v3`) es SOLO el respaldo offline y se repuebla en cada acierto de red — SUBIR +1
  al nombre del caché sólo si cambia la lista SHELL o la estrategia (olvidarlo ya NO congela
  la entrega: el bug 2026-10-19 de assets cache-primero + sw.js byte-idéntico entre releases
  servía el shell viejo para siempre, aunque el índice llegara fresco). El check del worker
  SALTA la caché HTTP de Pages (`register("sw.js", {updateViaCache:"none"})`, Pages sirve
  max-age=600) y se revisa al entrar, al volver al primer plano y cada 10 min; si un worker
  NUEVO toma el mando con la app ya abierta, la página se recarga UNA vez por sesión (guard
  `mrcheff.recargaUpdate`): la release llega sin gestos del usuario. El precache incluye
  `modules/swipe-tabs.js`. Guardia repetible: `node e2e/pwa-entrega.mjs` (servidor mutado
  en caliente: data.js v1→v2 se ve con un reload; offline real cerrando el servidor sigue
  viva con la v2 — 6 checks, captura reports/ui-brave/30). El app se sirve en
  `https://inigo9777-design.github.io/webapp/` — la raíz de la user page da 404 porque el
  repo del Pages es este repo ENTERO y no hay index.html en la raíz (normal, no es bug).
  (8) **Botón de caja fuerte en móvil**: círculo 38×38 SIEMPRE (idéntico al toggle del
  tema; petición 2026-10-19) — el despliegue de la etiqueta al activar "Copia de
  seguridad" era un artificio de hover que en táctil derramaba el clúster a una 2ª fila
  empujando la barra de tabs (botón 207px, medidas en reports/ui-brave/29). En ≤820px la
  etiqueta es `display: none` (el nombre accesible vive en el aria-label) y el estado
  activo se nota por el relleno marca del círculo; en escritorio conserva el despliegue
  por hover/foco/activo. La agarra la auditoría `e2e/pwa-accesibilidad.mjs` (check 6).
  (9) **Tutorial interactivo de entrada** (feature 2026-10-20, epic `tutorial-interactivo`):
  visita guiada POR DENTRO de la app para la primera vez (la app nace vacía y sin pistas): el
  guion (16 pasos: bienvenida+cabecera, 3 por cada vista principal —Alimentos/Recetas/Sugerencias
  y menú—, 2 para Innovación y Temporada, cierre) vive en el módulo PURO `modules/tutorial.js`
  (PASOS por grupos + máquina de sesión; contrato `pasoValido`; pasos con `vista`/`selector`/
  `accionable`/`titulo`/`texto`/`cta`). El wiring está en app.js (sección TUTORIAL): velo
  semitransparente de 4 rectángulos + "foco" con aro de marca sobre el elemento del paso +
  tarjeta explicativa; los pasos accionables avanzan TOCANDO el elemento REAL (el toque ejecuta su
  función: focus del input, generar ideas/lote/plan…) y los informativos muestran botón.
  Auto-abre SOLO la primera vez en contexto web instalable (http/https; `file://` no — se
  registra en LS `mrcheff.tutorial.visto`, respetado por ✕ / Escape / "Terminar"; se reabre
  con el botón circular 🎓 `#btn-tutorial` en `.topbar-actions` ENTRE la caja fuerte y el tema,
  mismo círculo 38×38). El click que avanza va por listener de CAPTURA en document (el gesto
  sigue su curso natural) y el paso nunca se atasca: target inexistente degrada a informativo.
  Mientras la visita está abierta el swipe del viewpager queda en pausa (`tutorialActivo` en el
  touchstart del carrusel) y el resto de la app duerme bajo los velos; el reposicionado va por
  listeners scroll/resize (rAF-throttled). Molde en index.html (`#tutorial`, velos+`#tutorial-foco`+
  `#tutorial-tarjeta`), estilos tokenizados en style.css (z 90: por encima del topbar, debajo del
  modal; container `pointer-events:none` con auto en velos/tarjeta — el click DEL FOCO tiene que
  llegar al elemento real) y `modules/tutorial.js` añadido al shell del sw (caché v5).
  Accesibilidad: role dialog + anuncio sr-only "Paso X de N", Escape cierra y marca visto.
  Verificación: unit `tests/tutorial.test.js` (contrato/grupos/sesión ~12), integración jsdom
  `tests/tutorial-ui.integration.test.js` (auto-apertura, X/Escape/Terminar, reabrir, flujo
  accionable con GUION INYECTADO en la ventana = desacoplado del contenido que crece la épica,
  recorrido completo 16 pasos) y e2e Brave real `e2e/tutorial.mjs` (20 checks: auto-apertura,
  segunda visita silenciosa, 🎓, recorrido completo con mouse+coords, geometría del aro,
  swipe inmóvil; sirviendo por http://localhost:8617 con python3 porque file:// no auto-abre).
- **Sync entre dispositivos por buzón GitHub (feature 2026-10-19; su fichero de plan fue retirado del repo, el protocolo vive documentado en módulos/comments/tests):** sincroniza los
  datos entre 2 dispositivos (móvil PWA + escritorio) con un gist privado como buzón y cifrado extremo a
  extremo: AES-GCM-256 con clave PBKDF2-SHA256 (600k iteraciones) derivada de una passphrase que el usuario
  comparte; **la passphrase NUNCA se persiste** (sólo `sessionStorage` — se re-pide al reabrir), token/gist
  viven en `mrcheff.sync.config` y GitHub solo ve ciphertext o `{"kind":"empty"}`. En la vista Copia de
  seguridad: card "⇄ Sync entre dispositivos" con **⚙️ Configurar** (PAT scope solo gist + id del gist +
  passphrase), **🔄 Sync** (un clic = UNA pasada de la máquina de estados; nada de auto-sync en background)
  y **🧹 Vaciar buzón** (`{"kind":"empty"}`, JAMÁS borrar/recrear el gist — el id es la config del otro
  dispositivo). Protocolo (módulo puro `modules/sync.js`): offer/ack/empty con snapshot COMPLETO cifrado
  (`mrcheff-sync.json`); el merge es **diff3 3-way** contra el antecesor común (`mrcheff.sync.base`) —
  fusión por identidad de receta (id estable FASE 1, y fingerprint de ingredientes para gemelos LEGACY con
  uids distintos), listas por LCS escrito a mano (`modules/diff-merge.js`), `editedAt` como ancla LWW del
  primer sync SIN base (aviso no bloqueante; la perdedora no se descarta). La MISMA zona editada distinta
  en ambos = **conflicto DECLARADO**: modal resolver lado a lado (Quedarme con este / Usar el del otro /
  Conservar ambas — la copia remota entra con uid nuevo + badge "⧉ duplicada" para limpieza manual) y NADA
  queda escrito (ni local ni buzón) hasta resolver. Un fallo de red NUNCA corrompe el estado local.
  Copias guardadas por ⭐/✏️ llevan `editedAt` y el payload backup v2 (`version: 2`) transporta
  cooked/weekmenu; el export/import manual queda intocado (plan B, decisión fijada §3 del plan). El sync
  automático al abrir es idea futura, NO feature. Specs de integración del wiring: `tests/sync-ui.integration.test.js`
  (boot real + `window.fetch` sustituido; boot.js aporta la WebCrypto cruda + TextEncoder/TextDecoder que
  jsdom no trae) y `tests/sync-protocol.integration.test.js` (2 dispositivos en memoria); e2e manual real
  con token de entorno: `node e2e/sync-buzon.mjs` (el PAT NUNCA se hardcodea ni se da a ningún agente).
- **Pure modules (`webapp/modules/`, all IIFE + dual-export, no DOM/localStorage — §3 CODING_STANDARDS):**
  `classify.js` · `priority.js` · `recipe-analysis.js` · `ingredient-matching.js` (token matcher,
  shared by planner/menu-semanal/innovations) · `util.js` · `innovations.js` · `planner.js` (public API:
  buildCandidatePool, matchDetails, suggestToday, buildWeeklyMenu, pickRecipeForSlot, loteRotado…) ·
  `menu-semanal.js` (shoppingListFor, approveMenu, markItemBought, cookEntry, swapSlotRecipe, clearMenu,
  accionesMenuSlot — el 🍳 del menu sólo en plan aprobado) ·
  `recipe-editor.js` (buildDraft, validateDraft, estaGuardada, applyEdit, patchPlan) · `recipe-missing.js`
  (qué ingredientes faltan para el modal) · `backup.js` · **`busqueda-recetas.js`** (buscador del
  catálogo: texto libre → resultado por TÍTULO SÓLO, exacto x3 / prefijo x2 — fix 2026-10-20:
  los ingredientes ya no puntúan —, reutiliza matching de tokens del matcher compartido,
  orden estable y límite ctx.limite) · **`origen-recetas.js`** (etiqueta/sello de origen:
  esItaliana, etiquetaOrigen, claseOrigen, origenAlGuardar, etiquetaClasicaVisible — inyectable ctx
  `{catalog, ids}` para tests) · **`ocr-despensa.js`** (escáner del TICKET por OCR: esMovil, esHeic;
  extraerCandidatos — vocabulario FOOD_TYPES + CANTIDAD por línea (unidades de cuenta: x/UD/bolsa/
  brik/… y cifra inicial; los pesos del envase 400g/1L y los precios NO cuentan); guardarCandidatos
  REPARTE SIN ALTAS: nombre EXACTO en la despensa → `directos` (el diálogo 1 suma su compra);
  con VARIANTES (inyección `deps.candidatosDespensa`, la misma máquina del botón "🛒 Despensa?"
  de la lista del plan) → `dudosos` para el diálogo de revisión; nuevo → `nuevos`; pasosDeConfirmacion
  (["despensa","revisar"], el paso sin filas no sale) y confirmarRevision — la escritura FINAL
  del 2º diálogo: fila con `varianteId` → SUMA en-situ (criterios intactos), sin ella → ALTA con
  {nombre, qty, score, min} definidos EN el diálogo; nombre que ya existe → suma en vez de duplicar) ·
  **`ocr-foto.js`** (la MÁQUINA DE LA FOTO
  del escáner, refactor desde app.js 2026-10-20: prepararFoto — HEIC declara conversión directa
  y el sondeo con el decodificador REAL manda el HEIC camuflado de ".png" al conversor —,
  geometriaDeLienzo — giro 90/270 con lados trocados, máx. 1600px por lado — y escanearCaras —
  ciclo de frente → 90° → 270° hasta la primera cara con candidatos, texto null = cancelado;
  la I/O va inyectada por ctx: esHeic / decodificar / convertir / abierta / lienzoDe /
  reconocer / hayAlimentos; specs tests/ocr-foto.test.js) · **`sync-crypto.js`** (AES-GCM 256 + PBKDF2: deriveKey/encryptJson/
  decryptJson/nuevoSalt + base64 helpers; crypto inyectable — jsdom no trae .subtle) ·
  **`diff-merge.js`** (fusión 3-way: merge3 base/mio/suyo → {estado, conflictos, avisos} + aplicarResoluciones
  local/remota/ambas; CERO dependencias) · **`sync.js`** (máquina del buzón: ejecutar/
  continuarTrasConflictos/crearBuzón + MENSAJES; fetcher/cripto/almacen/fusionar inyectables).
  `app.js` keeps ONLY HTML molds (`badgeOrigenHTML`, `tagClasicoHTML`, `badgeSyncHTML`), event wiring
  and persistence.
- `modules/innovations.js` `generate(count, focus, state)` keeps its **exact public signature** (the sole call-site at
  `app.js:~445` is unaffected), but internally stops assembling random ingredient combinations from `STYLES`/`TWISTS`/
  `ARCHETYPES`. Instead it scores the curated catalog deterministically and ranks the top 6 by a named-weighted formula
  (`haveRatio` + variety-nudge − fuzzy-duplicate penalty, stable tiebreak by dataset `id`); **beyond slot 6** (only if more are
  requested) a uniformly random pick fills the rest from the remaining non-excluded pool — closing the "feature goes static / no
  discovery freshness" concern while keeping every output real. An optional injected `rng` provider (`ctx.rng`, defaulting to
  `Math.random()`) mirrors the already-existing `uid` injection precedent, so tests stay fully reproducible (see
  CODING_STANDARDS §6 determinism rule).
- Recipes the user has starred into **Mis Recetas** are hard-excluded from every slot via an absolute pre-filter (ingredient-set
  Jaccard = 1.0 match, language/order-invariant) — they vanish until manually deleted from their own recipes list.
- Open/Closed note: abandoning the legacy multi-generator-by-`source` pattern **for this one feature only** is a logged decision
  (CODING_STANDARDS §8), not an open silent deviation; same for shipping this logic without yet re-writing its co-located specs.

## Data model & gotchas
- Persistence = localStorage via `load(key, default)`/`save(key, val)` helpers and keys in `LS`:
  `mrcheff.foods`, `mrcheff.recipes`, `mrcheff.innov`, `mrcheff.innov.date` +
  (feature sugerencias/menú semana) `mrcheff.cooked` y `mrcheff.weekmenu`. **Use the helpers, not
  raw localStorage**, so JSON handling + defaults stay consistent.
  - `mrcheff.cooked`: `Array<{ id, title, keyFingerprint, on: "YYYY-MM-DD" }>` — ancla del cooldown de 7 días
    (fingerprint de ingredientes, no el `id` interno de recipes[]). En "Aprobar plan", cada entrada se ancla a la
    FECHA de su día planificado (próxima ocurrencia de ese weekday desde HOY, HOY incluido como día 0); con el
    menú 7×3 hay una entrada por RECETA del plan (hasta 21) y las de un mismo día comparten fecha ancla.
    "🍳 Cocinar" desde el menú = `cookEntry` (hoy) + `swapSlotRecipe` del propio hueco (no regenera el plan entero).
  - `mrcheff.weekmenu`: `{ approved, includeUnavailable, generatedOn, plan[7], needyFoods[] }` — ancla = HOY real
    al aprobar, no el día visual marcado. Desde la feature 2026-10-18 el plan es **7 días × 3 comidas**:
    `plan[7] = { dayLabel, meals[3] = { meal: "desayuno"|"comida"|"cena", recipe|null, missing } }` y
    `needyFoods` = unión dedup de los ausentes de los 21 slots. `swapSlotRecipe` (módulo `menu-semanal.js`)
    puede añadir por slot el campo opcional `triedKeys: string[]` (fingerprints ya probados, para que el
    botón "🔄 Cambiar" recorra el ranking sin oscilar). `pickRecipeForSlot` es la 6ª función pública de
    `planner.js` (contrato ampliado, log §8 del CODING_STANDARDS.md). Las recetas guardadas son EDITABLES
    desde el modal de detalle (✏️ Editar): edición in-situ si ya está en `mrcheff.recipes` o copia nueva
    si es un plato del catálogo o del plan — los huecos del plan que incrustan la receta editada se refrescan
    por `recipe.id` (`recipeEditor.patchPlan` del módulo puro `modules/recipe-editor.js`: buildDraft /
    validateDraft / estaGuardada / applyEdit / patchPlan; el plan sigue snapshot para missing/needyFoods).
- Origen en recetas guardadas: las copias guardadas (⭐ desde Innovación o ✏️ editor sobre plato del
  catálogo/plan) pueden llevar el campo opcional `origen: "italiana"|"espanola"` — sellado EN EL MOMENTO
  del guardado por `origenRecetas.origenAlGuardar` (el título no vuelve a derivarse tras renombrar).
  Copias antiguas (pre-sello) no lo llevan; su etiqueta cae por id/título (normalmente española).
  El tag clásico `curada` ("Receta española") se OCULTA cuando duplicaría el badge de origen
  (`origenRecetas.etiquetaClasicaVisible` decide; tokens con texto distinto como
  "Sugerencia de hoy" se conservan).
- Lista de la compra (Card 3): dedup por el matcher de tokens (`modules/ingredient-matching.js`,
  NO lower-case exacto) y semáforo dinámico por fecha de preparación
  (`onDay`/`daysUntil`/`urgency`): hoy/mañana=rojo, 2–3 días=naranja, ≥4 días (o sin fecha)=verde;
  orden salida rojo→verde. **Cobertura dinámica (feature 2026-10-21, la persona viene del ticket
  y YA compró):** un needy sólo sale de la lista cuando queda CUBIERTO — hay alimento en casa
  que case por tokens con qty > SU mínimo (`shoppingListFor`, regla del usuario: "más unidades
  que el mínimo necesario"); con min 0/undefined basta qty>0. Tener "algo" YA no tapa la fila
  (2 de un min 3 sigue en cola), y la Card se REPINTA tras CUALQUIER suceso de despensa
  (`renderShoppingListTrasDespensa` en app.js: las dos confirmaciones del escáner OCR, alta
  manual del formulario, ➕➖/🗑 del inventario e import de backup — el ✅ comprado y el sync
  ya la repintaban). El filtrado es EN VIVO y needyFoods PERSISTE intacto: si el ítem se
  vuelve a gastar, la fila reaparece; sólo el ✅ comprado retira el pendiente para siempre
  (decisión explicita del usuario). "🛒 Despensa?" (2026-10-19) sale en la fila SÓLO cuando hay candidatos
  del módulo puro (`menuSemanal.candidatosDespensa`: comparten algún token del matcher — "Jamón
  serrano" ↔ despensa "Jamón ibérico", "Pan de pueblo" ↔ "Pan") y abre el diálogo de confirmación:
  la persona elige la variante (o nada) y la compra va IN-SITU a ese alimento vía
  `menuSemanal.markItemBoughtComo` (mismo id/nombre, sin alta nueva, el ítem sale de needyFoods;
  el modal viene PRE-CARGADO con el mínimo y la importancia del alimento de despensa — afinación
  2026-10-19: su criterio de alerta ya existía, sólo se pregunta cuánto se compró)
  — regla simple, decisión final siempre del usuario. Los DOS botones de cada fila van
  agrupados en `.alert-acciones` pegados al borde derecho con huelgo igual (antes en desktop
  se descuadraban porque cada botón tiraba el suyo por su cuenta). En MÓVIL (≤820px) el grupo
  vuelve a la alineación de siempre: "🛒 Despensa?" a la izquierda junto al texto de la fila y
  "✅ comprado" empujado al borde derecho (petición 2026-10-20). "✅ comprado" PREGUNTA antes cuánto se ha
  comprado, su importancia y el MÍNIMO para la alerta de reponer (modal) — no cuela el alimento
  con qty 0/score 5/min 0:
  `markItemBought(..., compra)` añade con esos datos; si el alimento ya estaba en la despensa
  (incluso con qty 0), lo ACTUALIZA en-situ (sin `min` pedido conserva el suyo).
  (contrato ampliado, log §8 del CODING_STANDARDS.md).
- Escáner del TICKET (OCR, #epic-ocr-despensa-camara, propósito revisado 2026-10-20): fotografiar
  el ticket del super (o el frigorífico, misma vía) → Tesseract.js@5 por CDN (carga perezosa la
  primera vez; la foto NUNCA sale del dispositivo; el texto pasa a `procesarTextoOcr` — el gancho
  §6 `window.__mrcheffProcesarTextoOcr` inyecta ese mismo paso en jsdom/e2e). **Fotos HEIC/HEIF
  del iPhone** (y tickets ".png" RENOMBRADOS que en realidad son HEIF de iPhone; Chromium no
  decodifica HEIC): la vista los convierte a JPEG en el propio navegador con **heic2any@0.0.4** (CDN,
  carga perezosa SÓLO si la foto lo necesita, gancho §6 `window.__mrcheffHeicConvertir`
  para jsdom; guardia de 90 s: un CDN caído canta con su toast y no congela el modal — la
  versión real del paquete es 0.0.4, las "0.4.x" NO existen y su 404 cancelaba el script por ORB).
  **Reintento de giro**: los tickets se fotografían de lado — si la foto de frente no da
  alimentos, se re-reconoce girada 90°/270° (canvas `canvasDeBitmap`, máx. 1600px por lado;
  se corta a la primera cara con candidatos). El cancelar a mitad de escaneo se decide con el
  ESTADO DEL MODAL (`modal.classList "hidden"`, no `isConnected` — closeModal sólo oculta). En la
  confirmación la CANTIDAD sale de la línea del ticket (ver módulo).
  **CONFIRMACIÓN EN 2 DIALOGOS** (rework 2026-10-21, petición del usuario: la compra YA está
  hecha — el escáner sólo mete lo comprado en el "Inventario actual", JAMÁS sale de la pestaña
  de Alimentos y NO se mezcla con la lista de la compra; se RETIRÓ la implementación de
  pendientes del ticket, con `mrcheff.compraTicket`, filaTicket, su "Definir ✓" en fila y el
  prelleno data-compra-*): diálogo 1 "🎫 Ya lo tienes en el inventario" — los nombres EXACTOS
  del ticket, nombre FIJO (es un alimento real, con "Ya tienes N en el inventario") + la CANTIDAD
  comprada editable → al confirmar la compra SUMA en-situ vía `guardarCandidatos` y su alerta
  queda como estaba; diálogo 2 "🎫 Añade lo nuevo y resuelve las dudas" con DOS secciones —
  **Nuevos** (nombre/cantidad/IMPORTANCIA/MÍNIMO definidos EN la fila: `.rev-seccion` arriba,
  alta directa al confirmar) y **Dudas** (debajo: desplegable `#rev-variante-{o}` con las
  variantes de despensa del mismo casador `candidatosDespensa` — elegir variante = suma a ESE
  alimento y la fila pasa a mostrar YA LA ALERTA REAL de ese alimento (su IMPORTANCIA/MÍNIMO)
  deshabilitada: por defecto los campos de la fila salen con la alta (5/1) editables, y al
  resolverla la pantalla dice lo MISMO que el inventario (fix 2026-10-21: antes pintaba 5/1 de
  mentira); al volver a "es nuevo" se restauran lo que la persona hubiera escrito. La opción
  "es nuevo: se define aquí" = alta con lo escrito en la fila). Cada diálogo compromete SU
  confirmación (Cancelar después no deshace lo ya guardado; sin botón "Volver"). Sin toasts de
  éxito: al cerrar el modal el Inventario destella UNA vez (`.destello-suave`, reduce-motion off,
  scroll suave hasta `#food-list`). Las secciones de la revisión comparten con sus filas una
  RETÍCULA CSS (`.rev-cab-nueva/.rev-fila-nueva` y `.rev-cab-duda/.rev-fila-duda`: misma
  plantilla de columnas y calzado — etiqueta siempre encima del campo que nombra; cabecera
  forzada a UNA línea con `> span { grid-row: 1 }`). Cada fila es una retícula de DOS líneas,
  fix 2026-10-21 del descuelgue: la 1ª es la del NOMBRE — el input y TODOS los campos
  (desplegable/cantidad/importancia/mínimo/incluir, clases `.rev-campo-nombre/qty/score/min/
  include/variante`) comparten su misma línea horizontal — y la 2ª lleva la etiqueta de tipo +
  la línea del ticket (`.rev-sub`) SOLO bajo la columna del alimento (en Dudas la columna 2 del
  desplegable aparta los campos una posición). En ≤640px las áreas se reordenan: alimento
  línea completa, campos debajo y el sub al final (en Dudas el desplegable también línea
  completa). La escritura final es el módulo puro `confirmarRevision`
  (alta con criterio definido, datos raros desinfectados qty≥0/score 1–10 clamp/min≥0, DUPLICADO
  evitado: nombre que ya existe en casa → suma en vez de alta). reduce-motion desactiva la
  animación (auto en scrollTo).
  Ni Tesseract ni heic2any ni el CDN van en el app-shell del SW. Demo grabada de la feature:
  `node e2e/ocr-ticket-video.mjs` → `reports/ui-brave/video-ocr-ticket/demo-escaner-ticket.webm`
  (Playwright recordVideo; requiere `npx playwright-core install ffmpeg` una vez).
  Verificación con FOTOS REALES: `node e2e/ocr-tickets-reales.mjs` — escanea los tickets de la
  carpeta DESCARTABLE `reports/OCR/` (png/jpg/heic/heif; hoy: 1 PNG mal bautizado que era HEIF +
  1 HEIC de iPhone, ambos girados 90°; si la carpeta no existe, la prueba SE SALTA sola) y
  demuestra con material real: la foto se ABRE, las cantidades son unidades de compra (precios
  y peso del envase fuera), y la confirmación del usuario — exactos → SUMA a lo ya en casa,
  dudosos y nuevos → se definen EN los dos diálogos y de alta directa en la despensa (jamás a
  la lista de la compra). Capturas 31-32.
- Foods: restock alert when `qty <= min`; urgency color from `score` (1–10) via `urgencyLevel` —
  red 8–10, orange 6–7, green 1–5; weekly alert shows the FULL list (el cap de 8 del módulo
  se quitó el 2026-10-19: escondía del 9º pendiente en adelante) y A PARTIR DE 8 items la lista
  se cap de alto a 8 filas y scrollea dentro; con botón candado (🔒) arriba a la derecha que
  congela el scroll del DOCUMENTO vía `html.scroll-candado { overflow: hidden }` — SOLO en
  MÓVIL (afinación 2026-10-19: en desktop la rueda scrollea la lista sin más y el candado ni
  se pinta; corte ≤ 820px, inyectable en suite con `bootApp({ esMovil })` porque jsdom no
  evalúa mediaqueries). La clase vive en
  `<html>` (en body mataría el sticky del topbar, ver fix del overflow-x); se suelta por clic,
  cambio de vista o al caer bajo 8 items; con menos de 8 ni candado ni cap.
- Innovations auto-expire: on load, if `mrcheff.innov.date != today`, wipe `mrcheff.innov`; also
  capped at the most recent 30. Generated "ideas" are deterministic heuristics (UI: "Modo simulado"),
  **not an LLM** — this is where real integration would go, nothing hidden elsewhere.
- Backup tab exists because localStorage is per-browser: `buildBackup()`/`applyBackup()`. Export
  downloads a real-timestamp JSON (`dataBackup-YYYY-MM-DD-HH-MM-SS.json`) to Downloads; import **merges**
  (foods de-duped by name, recipes/appended). A static page can't write `dataBackup/` — the user moves
  the file there by hand or uses 📋 Copiar. The old `showSaveFilePicker` path was removed on purpose.

## Conventions to follow
- **All UI text and code comments are in Spanish** — match that when editing strings/comments.
- **Escape all user content with `escapeHTML()` before inserting into innerHTML** (food names, recipe
  titles, descriptions). Any new rendered user field must do the same — XSS risk otherwise.
- **Accesibilidad (base):** tarjetas/filas clicable-solo usan el glue `activablePorTeclado(el, abrir)`
  (Tab + Enter/Espacio); los modales se abren con `abrirModal(tituloAccesible)` (foco entra y vuelve
  al cerrar, `role="dialog"`); icono-botón ⇒ `aria-label` siempre; vistas = botones con `aria-current`
  (no el patrón tab incompleto). Verificable con `node e2e/a11y-brave.mjs`.
- **Accent handling differs by context:** pantry food-type matching strips accents via `norm` (NFD +
  combining-mark strip) in `FOOD_TYPES`/`TYPE_ORDER`; the seasonal `TEMPORADA` `nombre` fields keep
  their accents. Mind this when adding foods or seasonal items.

## Other instruction / config sources worth knowing
- **`CODING_STANDARDS.md`** (`/.opencode/rules/CODING_STANDARDS.md`, canonical) — the team's coding/testing standards going forward: SOLID, per-feature modular architecture mandate
  (`modules/domain|infra|views`; `app.js` stays the legacy composition-root), and mandatory unit testing. **Follow it.**
  RULE of what goes where (2026-10-20): feature descriptions go HERE (AGENTS.md), resolved BUGS go to `bugfix.md` (repo root) — neither goes into CODING_STANDARDS.md, which holds only living rules + brief §8 exception notes.
  Per PR: new logic ships a co-located `tests/*.test.js` spec (jsdom harness exists in `webapp/jest.config.js` +
  `tests/boot.js`/`setup.js`, and per-module specs already exist under `webapp/tests/` — see the "Tests" bullet above for current
  suite status); integration tests are required when a change crosses modules or touches
  storage+DOM; UI/E2E via Playwright is "if possible" / add a stub whenever you introduce a new user-visible flow.
- `.continue/` (Continue.dev) still exists and holds cross-tool rules/prompts — e.g.
  `.continue/prompts/unit-tests.md` encodes the team's test workflow (write specs → run with
  coverage → iterate until all pass). It is not auto-loaded by OpenCode; check it when intent across tools matters rather than assuming Claude-only config still drives agent behavior in this repo.
- **Claude Code config was removed**: both `CLAUDE.md` and the whole `.claude/` folder are gone, after first migrating the two useful artifacts into OpenCode's own folders so nothing is lost — these are now auto-discovered by OpenCode:
  - `/unittest` command → `.opencode/commands/unittest.md` (was `.claude/commands/unittest.md`; Claude-only frontmatter fields `argument-hint`/`allowed-tools` were dropped as unsupported by OpenCode, body kept 1:1)
  - `code-reviewer` skill → `.opencode/skills/code-reviewer/SKILL.md` (only change vs source: `CLAUDE.md` reference inside it now points at this file / `AGENTS.md`)

  Remaining Claude-only items (`diff-reviewer` and `userexperience` custom agents, the old
  `rules/CodingStandards.md` pointer, and its broken top-level `@.claude/rules/Accesibilidad.md`
  include) were dropped outright — nothing auto-loads or references them now that `.claude/` no longer
  exists; their intent lives in this file + `CODING_STANDARDS.md` instead. If you later need those two
  agents back, OpenCode's equivalent lives under `.opencode/agents/*.md` (or the `agents` config field).
