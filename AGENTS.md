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
  run on 2026-10-22 the whole suite is green (**650 tests across 45 suites**) — verify with a fresh
  run before trusting it.
- **.gitignore** (since 2026-10-18) covers `node_modules/`, `webapp/coverage/*`, `reports/ui-brave/*`
  and `.DS_Store` (macOS metadata, also ignored via `~/.gitignore_global`). Never `git add -A`
  blindless with `webapp/node_modules/` present; `dataBackup/*.json` backups *are* tracked.

## Architecture (`webapp/`)
Single-page, six-tab app loaded via `index.html`. Script order (order matters): inline `<script>`
→ `data.js` → `app.js` (registers the one `DOMContentLoaded` closure; module `<script>`s load after
it but still before the DOM-ready event fires) → `modules/…` (`priority`, `classify`,
`recipe-analysis`, catalog data, `origen-recetas`, `fotos-recetas` + su data, `innovations`, `util`, `backup`,
`ingredient-matching`, `sync-crypto`, `diff-merge`, `sync`, `planner`, `menu-semanal`, `recipe-missing`,
`recipe-editor`, `swipe-tabs`) → `views/…` (`recetas`, `escaner`, `innovacion`, `copias`, feature
`final-refactor` 2026-10-23). `app.js`
is the composition-root, sectioned by `// ===== SECTION =====` banners. Files:

- **data.js** — static seasonal data; exposes `window.MR_CHEFF_DATA = { MESES, TEMPORADA }`. `app.js`
  depends on this having run first (keep the script order).
- **app.js** — composition-root: event wiring, persistence glue and HTML molds only; the domain
  logic lives in `modules/` (see below). Sectioned by banner.
- **`views/…` (feature `final-refactor`, 2026-10-23):** las CUATRO vistas de wiring del cierre
  antiguo de `app.js` ahora son FÁBRICAS `window.MRCheff.views.<nombre>(ctx)` (patrón A de
  CODING_STANDARDS, §3): `recetasModal` (vista Recetas + buscador del catálogo + la infra del
  MODAL común), `escanerOcr` (escáner del ticket OCR + sus 2 diálogos), `innovacionSugerencias`
  (Innovación + Sugerencias/menú 7×3 + lista de la compra) y `copiasSeguridad` (Copia de
  seguridad + Sync). El DOMContentLoaded de `app.js` crea el **`ctx` compartido** (estado mutable
  `foods/recipes/innovations/weeklyMenu/recetasDirty/…` + helpers publicados) y llama a las 4 en
  orden: **recetasModal PRIMERO** (dueña del modal común que las demás piden por `ctx`); el resto
  del acceso es SIEMPRE por `ctx.X` EN VIVO (sin destructuring), así el orden no condiciona. Las
  function-declarations se publican anticipadamente al abrir la fábrica (hoisting) para colmar las
  llamadas de init de las vistas siguientes; los MOLDES de HTML (`badgeSyncHTML`) viven en el
  core y se publican antes de iniciar las vistas. Nota de cobertura: las vistas corren vía
  `boot.js` (eval del script) como `app.js`, así que jest NO las contabiliza en cobertura
  (`collectCoverageFrom` las lista igualmente; los umbrales globales 70/65/70/70 no varían).
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
**Sugerencias y menú** (↻ Sugerir ahora lote rotado — fix 2026-10-21: el cooldown NO puede dejar
la Card a cero, si lo cocinable está entero cocinado en la semana se rellena con el pool SIN
filtro de cooked [rodillo del cooldown, raíz del bug "ya no saca recetas"] — + plan semanal 7×3
con las filas SIN la etiqueta "Sugerencia de hoy" [petición 2026-10-21: en la semana cada hueco
ya es una sugerencia, sólo se suprime ese token vía `tagMenuSlotHTML` y la bandera
`ocultarEtiquetaSugerencia` en el modal; Card 1 la conserva] + lista de la compra) ·
**Temporada** (in-season fruit/veg by month) · **Copia de seguridad** (side icon tab). Every recipe
viewed anywhere (cards, plan slots, modal) shows an ORIGIN badge — "Receta española"/"Receta
italiana" (see `modules/origen-recetas.js` below).

- **`webapp/data/recetas-espanolas-data.js`** — curated catalog (IIFE + dual-export like
  `classify.js`/`priority.js`, loaded before `innovations.js`/`origen-recetas.js`): **200 records as of
  2026-10-18** (53 desayunos / 97 comidas / 50 cenas; the last 20 are ITALIAN home recipes). Each record is
  minimal: `{ id, title, meal: "desayuno"|"comida"|"cena", ingredients[], method[] }` (5-field schema).
  It also attaches `dataset.idsItalianas` (list of the 20 Italian ids, consumed by `origen-recetas.js`) as
  a PROPERTY of the exported array — `module.exports` stays a plain array for tests/e2e. New Italian
  recipe ⇒ also add its id to `idsItalianas`. **Estilo editorial de los `method` (2026-10-22, épica
  `metodos-recetas-descriptivos`):** los 200 registros llevan pasos descriptivos y ejecutables al patrón de
  `patatas-a-la-riojana` (intacta, es la referencia) — tiempos reales, nivel de fuego (suave/medio/fuerte),
  señales sensoriales ("hasta que ceda", "brille de aceite"), el PORQUÉ de la técnica y ajuste de
  sal/reposo donde toca; sin jerga, en imperativo natural español. Platos de cocina 5-8 pasos ricos;
  montajes/tostadas 3-5 pasos con tips. Sólo se editó `method` (schema de 5 campos y `ingredients` intactos,
  con sus typos históricos "Peito"/"Zucchini"/"Fabes" duplicado documentados FUERA de alcance; el id real del
  pisto es `pisto-manchez`). NINGÚN test aserta el contenido de `method` (sólo shapes) — suite 666 verde.
- **Fotos reales en las cards (feature `imagenes-recetas-cards`, petición 2026-10-22):** las cards de
  receta de las vistas **Recetas** (lista + resultados del buscador del catálogo), **Innovación** y
  **Cocinar hoy** (Card 1 de Sugerencias y menú) llevan una banda de FOTO superior (16/10,
  `object-fit: cover`, redondeo arriba con el radio del card) y las recetas SIN foto del catálogo un
  PLACEHOLDER del diseño (inicial del plato en serif sobre papel, `.recipe-foto-falta`):
  - **Pipeline de assets (sólo dev):** `node webapp/scripts/imagenes-recetas.mjs` recorre el catálogo,
    busca en Wikimedia Commons (título limpio de qualifiers → menos tokens, con pausa y retroceso ante
    429; reanudable — salta las existentes), normaliza con `sips` (JPEG q70, lado máx. 900px) a
    `webapp/img/recetas/<id>.jpg` y al terminar REESCRIBE el índice `data/fotos-recetas-data.js` (lista
    de ids con foto; NO editar a mano — se regenera). Las que Commons no acierta quedan con placeholder
    (y el mapa `MANUALES` del script permite parchear búsquedas a mano id → consulta). Calidad: el
    script PUNTÚA los candidatos por solape de tokens con la búsqueda (la 1ª pasada a ciegas bautizaba
    platos con iglesias y libros) y la auditoría a ojo es la plancha de contacto
    `node webapp/scripts/plancha-fotos.mjs` (PNGs en reports/ui-brave/78-plancha-fotos-N.png);
    los ids con acento se comparan normalizados (APFS es normalización-insensible, byte a byte no).
  - **Módulo puro `modules/fotos-recetas.js`**: `fotoDe(receta, ctx)` (única pública) — 1) id directo,
    pero SOLO si el id pertenece al catálogo (los uids propios no pueden colar); 2) TÍTULO normalizado
    (copias ⭐/ideas/sugerencias nacen con uid nuevo — mismo espíritu que `origen-recetas.js`); 3) null
    → placeholder. El namespace default sale de `window.MRCheff` (índice + catálogo), ctx inyectable en
    tests (junto a `origen-recetas.js` en el orden de carga).
  - **Wiring en app.js**: molde `fotoRecetaHTML(rec)` — `<img alt="" loading="lazy" decoding="async"
    aria-hidden>` (decorativa: el título nombra el plato) o `<div .recipe-foto-falta data-letra>` con
    escapeHTML de la inicial — insertada en los CUATRO molde `.recipe-card`.
  - **Orden visual por flex `order`**: el DOM conserva las `.recipe-actions` delante como siempre;
    style.css pinta la foto como PRIMERA banda (`.recipe-photo { order: -1 }`, sangra al borde con los
    vars locales `--pad-arriba/--pad-costados` del propio card) y las acciones como PIE (`order: 5`).
    El acolchado del card vive ahora en esas dos variables locales — si cambia el padding, la banda calza.
  - **Alcance cerrado**: modal de detalle y huecos del plan semanal SIN foto (decisión del usuario).
  - **PWA**: `modules/fotos-recetas.js` + `data/fotos-recetas-data.js` en el SHELL → caché **v8**; los
    JPG viajan Network-first y el respaldo offline los cachea al primer acierto (cargan en la app
    offline tras la primera vista).
  - Mis Recetas: id no coincide → título; RENOMBRADA por el usuario → placeholder. El matching
    de título tolera renombres del usuario (2026-10-23): se recorta el turno pegado («·
    Comida/Cena/Desayuno») antes de comparar y, si el título no calca ninguna entrada del
    catálogo, nombra la candidata que MÁS tokens comparte (≥3 letras, margen 1 sobre el 2º;
    un token único manda sólo con 5+ letras, p. ej. "Pulpo á feira" → "Pulpo à la gallega";
    empate → placeholder). Reposición de assets del pipeline ese mismo día: 4 ids huérfanos
    (huevos-guanciale, pure-calabacin, pizza-jamon-queso + sopa-ajiaco SIN foto — no acierta
    Commons) y 4 jpg corruptos ~1 KB (HTML de error de Commons guardado como jpg:
    albondigas-vino-tinto, costilla-miel-mostaza, lentejas-chorizo, pizza-jamon-queso) vueltos
    a buscar con consultas de platos primos en el mapa MANUALES del script.
  - Verificación: unit `tests/fotos-recetas.test.js` (9), integración jsdom
    `tests/fotos-recetas.integration.test.js` (5), e2e Brave real `e2e/fotos-recetas.mjs`
    (capturas reports/ui-brave/78).
- **La línea "⚠️ Falta / ✅ en casa" en TODAS las tarjetas de receta (feature `falta-ingredientes-cards`, petición 2026-10-24):**
  el plan semanal ya contaba lo que faltaba fuera (hueco) y dentro (ficha); las DEMÁS tarjetas de receta quedaron
  a medias. Ahora las cards de **Mis Recetas + resultados del buscador del catálogo** (views/recetas.js), **Innovación**
  y **Card 1 "Sugerencia de hoy"** (views/innovacion.js) llevan la MISMA línea que el hueco del plan — "⚠️ Falta: A, B"
  en rojo si falta algo o "✅ Todos los ingredientes en casa" en verde — y la FICHA (modal de detalle) marca los
  "⚠️ No lo tienes" por ingrediente DESDE TODAS las vistas (antes sólo si se abría desde Sugerencias/Menú con
  `{highlightMissing}`; la bandera se retira, se marca siempre).
  - Un solo lugar calcula bien: la 3ª pública de `recipe-missing.js`, `nombresFaltantes(receta, aforo)` (los nombres
    en el orden del array, misma regla estricta qty>0 que `marcarFaltantes`). El MOLDE es
    `faltanEnCasaHTML(rec)` en innovacion.js, publicado por ctx (precedente `fotoRecetaHTML`): guard débil si el
    módulo no cargara, aforo = `ctx.despensaCocina()` (los PRODUCTOS DE HOGAR no cubren cocinar) con fallback a
    ctx.foods. Los huecos del plan INTACTOS: siguen usando el `missing` del snapshot del plan (generación).
  - REPINTADO tras suceso de despensa: el hook único `ctx.renderShoppingListTrasDespensa` (alta manual, ➕/➖/🗑,
    los dos diálogos del OCR, import) repinta AHORA también las tres listas de cards — comprar lo que faltaba saca
    el alimento de la línea AL INSTANTE. Card 1 recuerda su lote vivo (`loteSugerencias`) para el repintado; el
    botón "Limpiar" lo vacía también (si no, el lote limpiado reaparecería en el siguiente suceso).
  - Verificación: unit `tests/recipe-missing.test.js` (+4 de `nombresFaltantes`), integración jsdom
    `tests/falta-ingredientes-cards.integration.test.js` (6: Falta+verde en Mis Recetas, ideas de Innovación,
    hogar-no-cubre-cocina, ficha marcada desde Mis Recetas, repintado AL INSTANTE tras ➕, línea en cada card de
    Card 1 + limpio no reaparece) y e2e Brave real `e2e/falta-ingredientes-cards.mjs` (10 checks, capturas
    reports/ui-brave/82-*).
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
  descuido). **Jerarquía de filetes de la ficha (petición 2026-10-21):** el verde bajo el TÍTULO
  (`.receta-linea`) manda como estilo y los filetes de sección (`h4::before`, mismo fade
  `90deg transparent → color 20/80 → transparent` con opacity .7) van en MARRÓN con token propio
  `--filete-marron` (#8a5f34 claro / #b3885c oscuro — color nuevo ⇒ token en ambos temas); el
  `.modal-box` scrollea SIN barra visible (`scrollbar-width:none` + `::-webkit-scrollbar
  display:none`) — cubre ficha y editor, mismo contenedor, el scroll queda intacto. Pie de la ficha: botones repartidos igual (flex 1·1·0; 2×2 en ≤420px) y el
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
  guion (**18 pasos desde 2026-10-24**: bienvenida+cabecera, 4 en Alimentos —anotar, importancia,
  inventario y la DEMO del escáner—, 3 en Recetas, 2 en Innovación, **4 en Sugerencias y menú —
  hoy, semana, aprobar y la LISTA DE LA COMPRA (paso `menu-compra`, petición del usuario: "el
  paso de la lista de la compra cuando toque", justo tras aprobar, donde nace la Card 3)—**,
  2 en Temporada, cierre) vive en el módulo PURO `modules/tutorial.js`
  (PASOS por grupos + máquina de sesión; contrato `pasoValido`; pasos con `vista`/`selector`/
  `accionable`/`titulo`/`texto`/`cta`). El wiring está en app.js (sección TUTORIAL): velo
  semitransparente de 4 rectángulos + "foco" con aro de marca sobre el elemento del paso +
  tarjeta explicativa; los pasos accionables avanzan TOCANDO el elemento REAL (el toque ejecuta
  su función: generar ideas/lote/plan…) y los informativos muestran botón. **Objetivo INVISIBLE
  (2026-10-24):** un paso puede apuntar a un elemento que EXISTE pero mide 0×0 ese día — la
  lista de la compra `#shopping-list` no nace hasta aprobar un plan —: `tutorialReposicionar`
  lo trata como objetivo ausente (velo completo + tarjeta centrada, mismo camino que `!objetivo`;
  el chequeo es la clase `hidden` de la app —jsdom la resuelve— o geometría real 0×0 en
  navegador, con guardia `hayLayout` para no confundir el falso "todo a 0" de jsdom) y el
  repaint salta el scroll/scrollIntoView del paso. Así el paso degrada grácil en la 1ª visita y,
  al reabrir con 🎓 un día con plan aprobado, el MISMO código pinta el aro sobre la lista REAL.
  **Textos sin tecnicismos (2026-10-24, petición del usuario):** la redacción del guion no
  habla de "diálogos", "sesgo", "generador", "nº", "sin redes" ni "interpretado" — lenguaje de
  cocina; la demo del escáner explica SOLO tickets (fuera la mención "o la nevera"). **DEMO del
  escáner
  del ticket (petición 2026-10-22, paso `alimentos-escaner-demo`, 4º de Alimentos):** el guion
  enseña el OCR con los DOS diálogos de confirmación REALES y DATOS DE PRUEBA que NO se escriben
  en el inventario — "es sólo explicativo". El paso lleva el campo opcional `demo: "escaner"`
  (pasoValido lo valida: sólo "escaner") y apunta a `#btn-ocr-foto` (visible en escritorio y
  móvil); su click va por el listener de captura con `stopPropagation()*preventDefault()` — el
  gesto NO abre el file-picker real — y llama `lanzarDemoEscaner()`: datos de juguete en la
  pública `ocr.datosDemoEscaner()` (ticket `"2 LECHE ENTERA 1,29 / 2 YOGUR 1,15 / 1 GEL HIGIENE
  2,90"` + despensa demo "Leche entera" y "Yogur natural") tal que el reparto real saca el EXACTO
  (diálogo 1, "Ya tienes 1"), la DUDA (desplegable "Yogur natural · tienes 2") y el NUEVO de
  HOGAR (conmutador 🏠 preseleccionado — "higiene" entró en el diccionario de
  `categoria-producto.js` con esta petición: los tickets dicen "GEL HIGIENE" y el matcher exige
  que el token empiece/termine por la palabra del diccionario, así que "higienico" no cubría el
  token "higiene") → `pasosDeConfirmacion = ["despensa","revisar"]`, los dos
  diálogos. `abrirConfirmarOcr(candidatos, textoCrudo, { demo: true, foods })` corre el flujo
  sobre la despensa inyectada (`despensaVista`) con un banner `.ocr-demo-banner` (tono de marca)
  en ambas pantallas y las DOS confirmaciones SIN persistir (sólo conducen el flujo visual). En
  la demo los intros de cada diálogo AÑADEN la guía ("Para continuar, toca Confirmar y revisar
  el resto" / "…Añadir a la despensa") y el botón que conduce el pase lleva la SEÑAL VISUAL
  `.btn-demo-senal` (aro `--brand-soft` que pulsa, reduce-motion → estático: el mismo lenguaje
  del aro del foco, sobre el botón); el avance del paso lo manda `closeModal` — la bandera
  `demoEscanerAbierta` hace que CUALQUIER
  vía de cierre (✕, fondo, Escape y footer) devuelva el control al paso del tutorial. El paso
  nunca se escribe en `mrcheff.foods` ni destella la lista. **Silencio de campos
  (petición 2026-10-21):** en los accionables que apuntan a un form-control (input/textarea/
  select: `#food-name`, `#recipe-desc`, `#recipe-catalog-search`, `#season-month`, `#food-score`)
  el wiring hace `preventDefault` en `pointerdown`/`mousedown` de su diana — se cancela el
  FOCUS y con él el teclado del PWA instalable que descuadraba el paso siguiente y el picker
  nativo que dejaba la lista de meses abierta encima — pero el CLICK sigue vivo, así el paso
  avanza igual; al reabrir con 🎓 se hace blur del foco activo (iOS nota: su picker puede
  abrirse al soltar — la plataforma de la feature es el PWA Android/Brave). **Tarjeta sobre
  los 4 objetivos ALTOS (petición 2026-10-21, pantallazos de referencia):** "Inventario y
  alerta semanal", "Mis recetas", "Un lote listo para mirar" y "Buena fruta, buena verdura"
  llevan `tarjeta: "arriba"` en el guion (pasoValido valida el campo: sólo "arriba") — el
  scroll ya no centra el elemento, su ARRANQUE se asienta al 60% de la ventana
  (window.scrollTo) y la tarjeta flota ENCIMA del aro sin tocarlo: arriba asoma la cabecera
  atenuada por el velo, en medio el diálogo y debajo la lista/cuadrícula viva y enfocada —
  en vez de taparla (e2e mide las tres zonas en los 4 pasos con capturas 72-75).
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
  Verificación: unit `tests/tutorial.test.js` (contrato/grupos/sesión ~15, incluye demo "escaner"),
  integración jsdom
  `tests/tutorial-ui.integration.test.js` (auto-apertura, X/Escape/Terminar, reabrir, flujo
  accionable con GUION INYECTADO en la ventana = desacoplado del contenido que crece la épica,
  silencio de campos y del select, los dos diálogos de la demo con asertos de "nada escrito",
  recorrido completo 18 pasos) y e2e Brave real
  `e2e/tutorial.mjs` (56 checks: auto-apertura, segunda visita silenciosa, 🎓, recorrido
  completo con mouse+coords, campos silenciados sin focus, la demo del escáner con banner +
  inventario intacto + capturas 76-77, el paso de la COMPRA en sus dos caras —sin nacer:
  tarjeta centrada 78; con plan aprobado: aro sobre la lista real 79—, geometría de las
  tres zonas en los cuatro pasos altos, swipe inmóvil; sirviendo por http://localhost:8617 con python3
  porque file:// no auto-abre).
  (10) **Botón flotante "subir al principio"** (feature 2026-10-21, petición del usuario): con
  listas verticales muy largas, al bajar MÁS de una pantallita (`window.innerHeight` de umbral)
  aparece con fade+escala abajo a la derecha el círculo con flecha (`.fab-subir-encima` 46×46,
  z 60: sobre el contenido, bajo el tutorial y el modal); un toque devuelve AL PRINCIPIO de la
  pestaña ACTUAL con animación (`behavior:"smooth"`; reduce-motion → "auto"; fallback
  try/catch para WebView sin options object — línea por línea la mecánica del click del
  topbar) y se vuelve a OCULTAR al quedar arriba (y ≤ umbral, comparación estricta). Va en
  TODAS las pestañas (una sola pieza: sigue el scroll del DOCUMENTO, no por vista; el click
  del nav ya sube y el swipe restaura memoria — el FAB ni toca la memoria-scroll: al salir de
  la vista la captura del 0 la resetea sola, invariante 2026-10-20). Regla y salto en módulo
  puro `modules/scroll-arriba.js` (`debeMostrarseBoton/subirEncima/movimientoReducido`, win
  inyectable); app.js sólo listener scroll/resize rAF-throttled (passive) + clase `visible`;
  el botón nace `opacity:0` + `pointer-events:none` (el `.hidden` display:none rompería el
  fade). Precacheado en el shell (caché v6). Verificación: unit `tests/scroll-arriba.test.js`,
  integración jsdom `tests/boton-subir-encima.integration.test.js` y e2e Brave
  `e2e/boton-subir-encima.mjs` (9 checks + captura 36; rueda de móvil con `page.mouse.wheel`,
  generando el plan 7×3 en Sugerencias para que esa pestaña tenga lista larga real).
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
  cooked/weekmenu. **REGLA del transporte del plan semanal (2026-10-21):** SÓLO un menú APROBADO
  viaja, y viaja ENTERO (plan 7×3 + `needyFoods` = la lista de la compra) para recuperarse en el
  otro dispositivo — la regla vive en la 14ª pública de `menu-semanal.js`
  (`weekmenuTransportable`) y los tres puntos de transporte la aplican: snapshot del sync
  (`estadoLocalCompleto` en app.js), export/import manual (`buildBackup`/`mergeIncoming` en
  `backup.js`: un preview no se exporta ni se adopta jamás) y la zona weekmenu del diff3
  (`resolverWeekmenu` en `diff-merge.js`, también apaga una base antigua que hubiese guardado un
  preview). La recuperación se ve viva AL INSTANTE: tras recogida por sync (`aplicarEstadoSync`)
  o import (`commitImport`) el plan se repinta con su estado final (7 días + botón de Aprobar
  bajo el faldón + barra de plegado) y la Card 3 nace de los needyFoods adoptados. El export/
  import manual sigue siendo plan B intocado en su resto (decisión fijada §3 del plan). El sync
  automático al abrir es idea futura, NO feature. Specs de integración del wiring: `tests/sync-ui.integration.test.js`
  (boot real + `window.fetch` sustituido; boot.js aporta la WebCrypto cruda + TextEncoder/TextDecoder que
  jsdom no trae) y `tests/sync-protocol.integration.test.js` (2 dispositivos en memoria); el transporte del plan
  se cubre en `sync-ui` (publicación descifrada + recogida viva) y en `tests/import-plan-lista.integration.test.js`
  (vía FileReader real — `tests/setup.js` aporta el polyfill de `setImmediate` que el sandbox de
  Jest oculta y la lectura de Blob de jsdom necesita); e2e manual real
  con token de entorno: `node e2e/sync-buzon.mjs` (el PAT NUNCA se hardcodea ni se da a ningún agente).
- **Pure modules (`webapp/modules/`, all IIFE + dual-export, no DOM/localStorage — §3 CODING_STANDARDS):**
  `classify.js` · `priority.js` · `recipe-analysis.js` · `ingredient-matching.js` (token matcher,
  shared by planner/menu-semanal/innovations) · `util.js` · `innovations.js` · `planner.js` (public API:
  buildCandidatePool, matchDetails, suggestToday, buildWeeklyMenu, pickRecipeForSlot, loteRotado —
  el relleno del lote es una VENTANA CIRCULAR que rota con el click (`(clicks*max) % len`; fix
  2026-10-21: volvía siempre al nº1 del ranking y con despensas finas el lote no cambiaba)…) ·
  `menu-semanal.js` (shoppingListFor, approveMenu, markItemBought, cookEntry, swapSlotRecipe, clearMenu,
  accionesMenuSlot — el 🍳 del menu sólo en plan aprobado, platosDelPlan y alternarColapso — plegar/
  desplegar la semana APROBADA, petición 2026-10-21) ·
  `recipe-editor.js` (buildDraft, validateDraft, estaGuardada, applyEdit, patchPlan) · `recipe-missing.js`
  (qué ingredientes faltan: `marcarFaltantes` para el modal + `nombresFaltantes` para las cards, 3ª pública
  2026-10-24) · `backup.js` · **`busqueda-recetas.js`** (buscador del
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
  {nombre, qty, score, min} definidos EN el diálogo; nombre que ya existe → suma en vez de
  duplicar). **Fila nueva con conmutador 🍎/🏠 (2026-10-22, petición del usuario):** para el
  producto que NACE en la revisión, la etiqueta alimento/hogar la DECIDE LA PERSONA — el
  autodiagnóstico del vocabulario sólo PRESELECCIONA (celda `.rev-celda-cat` con las mismas
  voces `.food-cat-btn` del alta manual; en escritorio su columna "Tipo" calza con la cabecera,
  en móvil lleva su línea completa ENTRE los campos y el nombre). Al pasar a Hogar el criterio
  queda fijo 5/0 deshabilitado y la fila se renombra ("Producto", tag 🏠); al volver a Alimento
  se restauran los valores escritos. En DUDAS el conmutador duerme mientras la compra va a un
  alimento de la despensa (variante = su categoría ya está decidida en casa). La cosecha lee la
  categoría del CONMUTADOR (estado vivo del diálogo, no la preselección) y `d.hogar` viaja al
  alta del módulo, que escribe `categoria: "hogar"`. El orden objetivo del móvil (campos encima
  del nombre, bugfix 2026-10-23) está en bugfix.md) ·
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
  - `mrcheff.weekmenu`: `{ approved, includeUnavailable, generatedOn, plan[7], needyFoods[], colapsado? }` — ancla = HOY real
    al aprobar, no el día visual marcado. Desde la feature 2026-10-18 el plan es **7 días × 3 comidas**:
    `plan[7] = { dayLabel, meals[3] = { meal: "desayuno"|"comida"|"cena", recipe|null, missing } }` y
    `needyFoods` = unión dedup de los ausentes de los 21 slots. `swapSlotRecipe` (módulo `menu-semanal.js`)
    puede añadir por slot el campo opcional `triedKeys: string[]` (fingerprints ya probados, para que el
    botón "🔄 Cambiar" recorra el ranking sin oscilar). **Plegado de la semana (feature 2026-10-21,
    petición del usuario):** el plan APROBADO se PLEGA vía la barra "📅 Tu semana — N platos" + "▾ Plegar"
    (sólo aparece aprobado — `pintaBarraPlan` en app.js es el punto ÚNICO de la barra y del plegado de la
    lista; el PREVIEW no se pliega y un plan limpio/nuevo nace expandido) y SIEMPRE vuelve a desplegarse
    ("▸ Desplegar"); el estado opcional `colapsado` viaja en el shape persistido (como `triedKeys`, nota
    §8) y la regla vive en `alternarColapso` — Card 3 (lista de la compra) queda visible plegada o no.
    **Diseño de la semana (2026-10-21):** cada día es una tarjeta `.menu-day` del mismo pie que `.card`
    (radio-l) con columnas suaves (`--card-soft`, radius-m) DENTRO del acolchado — sin filas a sangre, sin
    tabiques de 1px y sin el filete lateral: la franja horaria (desayuno=ámbar, comida=azul, cena=violeta)
    vive en la PÍLDORA `.menu-meal-tag` con los pares bg/fg de tags (`--tag-protagonista/_fg`, `--tag-libre-bg`
    + `--info`, `--tag-variacion/_fg`), tokens de ambos temas. ⚠️ El `<ul id="menu-plan-list">` nace con la
    clase `alert-card` en el markup → la regla genérica `.alert-card li` (0,1,1) APLASTABA a `.menu-day`
    (0,1,0): centraba el título y achicaba el radio; la familia del plan lleva prefijo `#menu-plan-list`
    (1,1,0) para ganar y el override `#menu-plan-list.alert-card` neutraliza el tinte del contenedor.
    **Alineación y rostro de los botones (2026-10-21, 2ª pasada):** `align-items:start` en la fila — el
    cuerpo arranca ARRIBA en todas las filas (con `center` el título nacía a otra altura según el nº de
    líneas) — la PÍLDORA se CENTRA en la fila con `align-self:center` y los botones del plan ya no salen
    al estilo por defecto del navegador (radio 0): llevan la voz de `.recipe-card` — `--hover-wash` +
    filete + `border-radius: var(--radius-s)` (6px, el MISMO redondeo de las píldoras).
    **3ª pasada (2026-10-21, foto de referencia del usuario):** columna de la píldora FIJA (116px —
    con `auto`, cada fila medía su propia píldora, 99/85/64px, y los títulos partían en un vertical
    distinto fila a fila; 116px restaura la LíNEA DE ARRANCADA compartida, sonda: titX=142 en todas las
    filas, desviación 0) y el TÍTULO DEL DÍA vuelve a CENTRARSE con su filete corto (`align-self:center`
    + `width:max-content` + border-bottom: era el accidente visual de `.alert-card li` que el usuario
    quería conservar — ahora es deliberado). **Filete del día en VERDE (petición 2026-10-21):** ese
    filete corto pasa del borde sólido `--border` al fade del título de la ficha pero en verde de
    marca (`.menu-day-header::after`, `var(--brand)`, opacity .7) — misma anatomía que la ficha de
    receta, color aparte para los días del plan (allí las secciones van en marrón).
    `pickRecipeForSlot` es la 6ª función pública de
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
  NO lower-case exacto). **Semáforo POR PRIORIDAD (bugfix 2026-10-21, era por fecha de preparación):
  el COLOR de la fila lo manda la prioridad del alimento en el Inventario** — registrado en casa
  (el matcher lo casa, aunque su qty siga ≤ min: registro ≠ stock; si casan varios manda el de MAYOR
  score) → `urgencyLevel` de `priority.js` (rojo 8–10, naranja 6–7, verde 1–5) y la fila muestra sus
  qty/min/score REALES; SIN registro (defaults 0/0/5) → urgencia **"neutral"**, el color del propio
  texto de la app (`.alert-card li.urg-neutral { border-left-color: var(--text) }`) y SIEMPRE al
  final del orden (peso neutral=3). `onDay/daysUntil` siguen calculándose: metadato informativo
  "se usa el …" y desempate del orden. Regla y helper en el módulo puro (`shoppingListFor`,
  `priority` resuelto por entorno como el matcher); specs `tests/menu-semanal.test.js` +
  `tests/lista-compra-prioridad.integration.test.js`. **Cobertura dinámica (feature 2026-10-21, la persona viene del ticket
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
  desplegable aparta los campos una posición). **En ≤640px (bugfix 2026-10-23) las grid-areas
  del escritorio se SOBREESCRIBEN línea a línea** — una propiedad móvil sin redeclararlas
  no las vence (especificidad igual, sólo el orden gana) y el PWA instalado aplastaba el
  nombre a 1 letra por línea — con el orden PEDIDO por el usuario: en las DOS secciones
  (peticiones 2026-10-23) la línea 1 es el NOMBRE del alimento (arriba de todo), la 2 los CAMPOS
  (cantidad/importancia/mínimo/incluir, con su micro-etiqueta encima), la 3 el conmutador
  🍎/🏠 a línea completa, la 4 el desplegable «De tu despensa» (sólo Dudas) y el sub al final;
  la FILA alinea al ARRIBA y «Incluir» va a la MISMA altura que los otros tres títulos (su
  check recupera el centrado con 6px de respiro). En el diálogo 1 el swap sale por `order: -1` del flex (fields arriba, nombre
  debajo). La escritura final es el módulo puro `confirmarRevision`
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
- **REQUISITO 95% del escáner (2026-10-22, entrega de la épica ocr-despensa-camara):** meta medida
  en nuestro corpus REAL (fotos descartables en `reports/OCR/`, iPhone 12, tickets de Mercadona y
  ALDI de El Puerto de Santa María): **Mercadona 100% de ítems reales · 100% de cantidades;
  ALDI 100% · 95,2%** (el único fuera: MINI CHAPATA, cuyo pack el OCR leyó "ZO <" sin cifra —
  se corrige a mano en el diálogo; la medición es POR CADENA, no media). Cadena:
  **(1) `modules/ocr-ticket-parser.js`** (puro, nuevo): PARSER ESTRUCTURAL por LÍNEAS anclado a
  los PRECIOS — ya NO decide el vocabulario qué se pierde: cada línea-producto del ticket llega a
  la revisión. Mercadona: columna inicial del qty + talón de dinero (unit + total cuando hay dos
  cifras); ALDI: auxiliares ANTERIORES al producto ("4x 1,79€" → qty 4, "0,680 kg x 13,99 €/kg" →
  granel) + precio degradado tolerado ("375eZ"→3,75) con el código de IVA pegado ("9,51 €3");
  granel → `unidadesDePeso(kg) = max(1, round(kg*2))` lotes de **500 g** con nombre `X (500gr)`
  (petición del usuario: 1,5 kg = 3 unidades); descartes con MOTIVO (reservadas de cabecera/pie,
  fecha, descuento, "EX IDA" del mangle — la auxiliar del producto fallido MUERE, no viaja); eco
  del OCR deduplicado por LÍNEA CRUDA EXACTA (dos "CEBO TAPAS" con precios distintos y el par
  "1 LoMO…"≠"1 LOMO…" son compras reales — el mismo-nombre del ticket acaba SUMANDO en un
  alimento en la alta). Calibraciones anticabecera/vocab: rescate mayúscula (≥3 tokens, ≥2 full-
  caps) exige token SIN dígito ENTRE letras (cabecera ESPEJO de ALDI fuera) y NO rescata en
  Mercadona (su dirección "CL ALBERT EINSTEIN, 13" en 100% mayúsculas mentía producto); rescata
  CON la línea de peso pendiente (granel cuyo precio el OCR comió). `PACK_FLOJO` de ALDI:
  "2 XADO? €" (mangle de "2x 1,5?") apunta la cantidad al producto siguiente; nombre: tokens ≥2
  letras a partir del prefijo, basura de cabeza botada (mientras queden ≥2 detrás: "BE LOBICHA…"
  → "LOBICHA…"). **Motor de vista (app.js):** WORKER de Tesseract creado UNA VEZ por foto
  (`createWorker("spa", 1)` reutilizado para todas las caras de giro + `terminate` en finally) con
  `setParameters {PSM 6, preserve_interword_spaces, user_defined_dpi 300}` — sin binarización
  (medía PEOR en el corpus). `procesarTextoOcr` es PARSER-FIRST: si parsearTicket ve un ticket,
  TODO el ítem llega; el vocabulario FOOD_TYPES queda de RESERVA para la foto de nevera sin
  talones. El TEXTO RECONOCIDO queda visible en un desplegable `<details class="ocr-crudo">` del
  aviso y de ambos diálogos (diagnóstico + confianza al corregir). **(2) `modules/categoria-
  producto.js`** (puro, nuevo): la etiqueta ALIMENTO/PRODUCTO DE HOGAR — petición del usuario
  (los no-alimentarios del ticket "viven aparte, fuera de todo lo de cocina"): PALABRAS_HOGAR
  (~45 palabras, misma política de prefijo ≥5 letras del matcher compartido; troceo por letra
  unicode `\p{L}` — con `\W` É/Ñ partían los tokens "HIGIÉNICO"→"HIGI+NICO"), `esProductoHogar/
  esHogar/esAlimento/alimentos/hogares/criterioDeAlta` (hogar → alta fija score 5 neutra + min 0:
  avisan SOLO al agotarse). Persistencia: campo OPCIONAL `categoria:"hogar"` en Food — sin campo
  = alimento (retro-compatible con backups v2, sync diff3 y la carga vieja). **(3) Inventario en
  DOS SECCIONES**: los hogareños salen de `#food-list` a la suya `#hogar-seccion`/`#hogar-list`
  (molde en index.html, filas con badge 🏠 en el hueco del score, misma mecánica ➕➖/🗑, el
  buscador filtra ambas) y NO se usan para NADA de cocina: todo consumo para RECETAS/SUGERENCIAS/
  MENÚ/LISTA pasa por el helper `despensaCocina() = categoria.alimentos(foods)` (innovations,
  buildCandidatePool ×3, suggestToday ×2, shoppingListFor, candidatosDespensa de la fila). Los
  diálogos del escáner casan con la despensa COMPLETA (un detergente debe poder variar con otro
  detergente). Alta MANUAL con conmutador 🍎/🏠 (`.food-cat-btn`, aria-pressed): en HOGAR los
  grupos de mínimo/importancia se OCULTAN y entra fijo {score 5, min 0} igual que el escáner.
  **(4) Cobertura de tests:** unit del parser (19 con las líneas REALES del corpus volcado) y de
  categoria-producto (8) + integración nueva "parser-first" en `ocr-ticket.integration.test.js`
  (todo el ticket entra: cantidades de la columna, línea sin precio sobrevive, hogareños sin
  criterio, nombres en `.rev-campo-nombre`, texto crudo visible, conmutador del formulario) y
  fixtures de ocr-foto pasados a la API del worker. **(5) Métrica repetible:**
  `node e2e/ocr-precision.mjs` (ARNÉS del 95%: foto real → heic2any/WebKit → Tesseract real en
  Brave → parser → filas del diálogo, confrontado contra `reports/OCR/verdad/*.json` EN EL REPO
  con matching por tokens + distancia de edición ≤2 — el requisito es ítem legible/editable, no
  palabra perfecta; captura además el texto de PRODUCCIÓN en reports/OCR/texto/PRODUCCION-*.txt
  — descartable — para recalibrar). `e2e/ocr-tickets-reales.mjs` reescrito a la era parser-first
  (nombres literales del ticket, dudas por palabra compartida, mismo-nombre suma; config por
  NOMBRE de fichero — los dos tickets son .HEIC). Suite: 650 tests / 45 suites verdes (parser
  19, categoria 8, parser-first en integración; +2 de la DEMO del escáner en ocr-despensa). Capturas
  40-43. sw.js caché v7 (precachea ambos módulos). La DEMO del tutorial reutiliza ESTA
  maquinaria con datos de juguete (`ocr.datosDemoEscaner()`, ver el bullet #9 del tutorial: los
  dos diálogos se enseñan con NADA escrito). NOTA de plataforma: heic2any@0.0.4 NO decodifica
  las HEIC del corpus (HEVC): en
  iPhone real la decodificación nativa de WebKit lo hace — mejora pendiente: probar la nativa
  ANTES de forzar el conversor en `ocr-foto.prepararFoto` (convertir sólo si el sondeo falla).
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
- **Skill `git-worktree-multi-agent`** (`.opencode/skills/git-worktree-multi-agent/SKILL.md`; GENÉRICA,
  sin asunciones del repo) —
  orquesta N tareas de implementación EN PARALELO con aislamiento git real. Pregunta nº de tareas y
  descripción de cada una (`question`), nombra cada rama con la skill `git-flow-branch-creator`
  (SOLO análisis/nomenclatura: sus `git checkout -b` NO se ejecutan en el checkout principal),
  corta SIEMPRE desde develop (si el repo no tuviera develop, pregunta por su trunk) y crea un
  **git worktree hermano por tarea**
  (`git worktree add -b <rama> ../<carpeta> develop`; ⚠️ los ficheros IGNORADOS no viajan
  a los worktrees). Lanza dentro de cada
  worktree una **sesión nueva de OpenCode** (`cd ../<carpeta> && opencode run "$(cat prompt)" --format
  json` en segundo plano; sessionID vía `grep ses_`) cuyo prompt manda leer las convenciones del
  repo (AGENTS.md, reglas `.opencode/`, README) antes de nada, leer ficheros SIEMPRE por terminal
  durante toda la sesión, instalar las dependencias si faltan (aquí: `cd webapp && npm install`
  antes de los tests jest), correr la suite del repo e implementar SOLO su tarea en su rama
  (commits sí, push/merges no). La sesión que corre la skill queda como coordinadora (vigila e
  informa). Cierre: fusión a develop SECUENCIAL con `--no-ff` en el checkout principal; la CARPETA
  de cada worktree se borra SIEMPRE tras fusionar (`git worktree remove` primero — `rm -rf` a mano
  deja metadatos huérfanos en `.git/worktrees/`; `--force` solo con confirmación si el árbol
  está sucio); el borrado de cada rama sigue su regla git-flow POR TIPO, después de quitar el
  worktree: `bugfix/` y `tasks/` → `git branch -d` tras el merge; `feature/` y `release-` → SE
  CONSERVAN; `epic/` → ni merge ni borrado por agente (manual del usuario).
- **Claude Code config was removed**: both `CLAUDE.md` and the whole `.claude/` folder are gone, after first migrating the two useful artifacts into OpenCode's own folders so nothing is lost — these are now auto-discovered by OpenCode:
  - `/unittest` command → `.opencode/commands/unittest.md` (was `.claude/commands/unittest.md`; Claude-only frontmatter fields `argument-hint`/`allowed-tools` were dropped as unsupported by OpenCode, body kept 1:1)
  - `code-reviewer` skill → `.opencode/skills/code-reviewer/SKILL.md` (only change vs source: `CLAUDE.md` reference inside it now points at this file / `AGENTS.md`)

  Remaining Claude-only items (`diff-reviewer` and `userexperience` custom agents, the old
  `rules/CodingStandards.md` pointer, and its broken top-level `@.claude/rules/Accesibilidad.md`
  include) were dropped outright — nothing auto-loads or references them now that `.claude/` no longer
  exists; their intent lives in this file + `CODING_STANDARDS.md` instead. If you later need those two
  agents back, OpenCode's equivalent lives under `.opencode/agents/*.md` (or the `agents` config field).
