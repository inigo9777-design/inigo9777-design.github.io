# Bugfix.md — Registro de bugs resueltos (Mr Cheff webapp)

Registro cronológico de **bugs resueltos**: el síntoma reportado, la causa y el arreglo, con fecha
y rama/épica. Es un historial de correcciones, no un estándar — la fuente de las **reglas** de
código/testing sigue siendo [`CODING_STANDARDS.md`](.opencode/rules/CODING_STANDARDS.md) y la
**documentación de features** vive en `AGENTS.md`.

> **Regla de uso (desde 2026-10-20):** todo bug resuelto a partir de hoy se anota AQUÍ, no en
> `CODING_STANDARDS.md` (allí no van descripciones de bugs ni de features — sólo reglas vivas y
> sus excepciones puntuales, §8).

Formato: `YYYY-MM-DD · @autor · #rama · Síntoma / Causa / Arreglo / Verificación`.

---

- `2026-10-18 · @AI-agent · #bugfix-matching · síntoma reportado:` el matcher bidireccional por
  subcadena-cruda (`includes()`) de `planner.js` e `innovations.js` daba falsos positivos graves (ingrediente "Sal" encajaba dentro
  del alimento "Salchichón ibérico"). **Arreglo:** se extrae el módulo puro compartido
  `modules/ingredient-matching.js` (tokens+deplural, sin prefijos sueltos) y ambos módulos lo
  consumen — se CIERRA la duplicación del matcher que existía entre ambos (deuda §3 previa)
  en lugar de corregir dos copias idénticas.
- `2026-10-18 · @AI-agent · #feature-matching-casa · Síntoma (bug reportado por el usuario):`
  con "Lomo ibérico" en la despensa, planner/innovations/recipe-missing consideraban que ya
  tenías "Lomos de bacalao", "Lomo de atún", "Lomo cerdo entero", "Lomos de merluza"… (el
  alimento aparecía como disponible para recetas que no lo piden). **Causa:** la regla (2) del
  matcher "comparten el token NÚCLEO ⇒ match" fabricaba falsos positivos de la misma familia
  que arrancó el módulo. **Arreglo:** se REFUERZA la decisión de `#bugfix-matching` retirando
  esa regla: conector SÓLO por subconjunto bidireccional — el género genérico cubre al
  específico ("Vino" ↔ "Vino blanco", "Queso" ↔ "Queso rallado" siguen ok) pero dos ESPECÍFICOS
  distintos ya no se casan por el primer token ("Queso azul" ≠ "Queso rallado"; "Lomo de cerdo"
  ≠ "Lomo salado"). **Coste asumido:** la despensa es más honesta y las sugerencias pueden
  exigir el ingrediente específico en la lista de la compra; tests actualizados a ambos lados.
- `2026-10-18 · @AI-agent · #tasks-analisis-texto-recetas · Síntoma:` el análisis del texto
  libre de "Crear receta" (módulo puro `recipe-analysis.js`, sin red) PERDÍA contenido que el
  usuario escribió a mano. **Causas y arreglos (4 defectos):** (1) palabra inicial en MAYÚSCULA se
  cortaba en el tokenizador ("Tortilla" → "ortilla") — el split es `[^a-z0-9]+` y el strip no
  minúscula: ahora se minúscula ANTES; (2) nombres sin diccionario ("harina", "chirla",
  "wakame"…) desaparecían salvo inventario: nuevo FALLBACK DE CANTIDADES que captura el nombre
  de fragmentos con cifra/medida ("200 gramos de harina", "un puñado de chirlas") con filtros
  anti-basura (no arranca por verbo, no es cláusula temporal, sin palabras de tiempo/recipiente);
  (3) compuestos con "de" interno ya se conservan ("Pimentón dulce" — diccionario ampliado con
  básicos: patata, agua, harina, vino, perejil, pescado blanco, frutos secos…); (4) imperativos
  irregulares ("Bate", "Fríe", "Cuece", "Vierte"…) no reconocidos por la raíz de 4 letras se
  añaden como tokens EXACTOS. Además, el recorte por COMAS + anclaje de frases SIN verbo: colas
  temporales ("a fuego medio durante 3 minutos") van al paso ANTERIOR y las introductorias
  ("Cuando la cebolla esté dorada") al SIGUIENTE — antes se descartaban ambas; y los compuestos
  subsumen al simple capturado en la MISMA pieza ("Pimentón dulce" sustituye "Pimentón" en su
  sitio — el 1º pone título), mientras que en piezas distintas son 2 alimentos ("tomate" +
  "tomate triturado"). **Contrato intacto** (`analyzeRecipe(texto, {meal, pantry}) → {title,
  ingredients, method, possible}`); tope de pasos 10 → 16. Trampas: los patrones de
  cifra/medida/ruido comparan en GRAFÍA STRIP ("puñado"→"punado", "sartén"→"sarten") porque NFD
  deshace la Ñ; se evita dict con participios ambiguos ("dorada"). Verificación: spec ampliada
  (19 tests) + e2e Brave real (`e2e/analisis-texto.mjs`).
- `2026-10-19 · @AI-agent · #bugfix-pwa-no-refresca-cambios · Síntoma (reportado):` "la PWA no
  se actualiza" pese a deploy al día en Pages — el índice llegaba fresco pero ningún css/js/
  módulo. **Causa:** la entrega dependía del ritual manual de SUBIR +1 el nombre del caché del
  sw.js; no se hizo en dos releases y el sw.js iba byte-idéntico (la v2 sin tocar desde
  `4ec8456`) ⇒ el navegador no re-instalaba el worker, el `addAll` del install no se repetía y
  el caché (que además ignoraba la query en el matcher) servía los ASSETS de la primera
  instalación para siempre. **Arreglo:** entrega NETWORK-FIRST con revalidación para índice Y
  assets (`fetch(req, {cache:"no-cache"})`); el caché queda como respaldo offline repoblado en
  cada acierto de red; la revisión del worker SALTA la caché HTTP (`updateViaCache:"none"` +
  `reg.update()` al entrar/al primer plano/cada 10 min por el max-age=600 de Pages) y un worker
  nuevo que toma el mando recarga la página UNA vez por sesión (controllerchange + guard en
  sessionStorage). El nombre del caché deja de ser la llave de frescura: +1 sólo si cambia la
  lista SHELL o la estrategia. **Alcance:** sólo `sw.js` + su registro (sin shapes de §5).
  Verificación: guardia externa `e2e/pwa-entrega.mjs` (6 checks con servidor mutable).

- `2026-10-21 · @AI-agent · #epic-ocr-despensa-camara · Síntoma (reportado DOS veces por el
  usuario probando el diálogo 2 del escáner):` las columnas de la revisión (Nuevos y Dudas)
  salían DESCUADRADAS — primera foto: la cabecera etiquetaba donde no había campo y los campos
  quedaban apelotonados a la derecha (cabecera flex gap 8 vs filas flex gap 10, anchuras no
  correspondidas); segunda foto, ya con la retícula compartida: el NOMBRE quedaba arriba y
  cantidad/importancia/mínimo/incluir «colgados» a media altura. **Causa (2ª):** en la fila la
  celda del nombre era una pila de TRES alturas (input + chip + línea del ticket) y los campos
  centraban verticalmente contra la pila entera (`align-items: center` sobre el propio grid) —
  sus centros caían al punto medio de la pila, NO a la línea del input. **Arreglo (final):**
  la fila es una retícula de DOS líneas — línea 1: el input del nombre y TODOS los campos en
  su misma línea horizontal (áreas explícitas; el molde reparte las clases
  `.rev-campo-nombre/qty/score/min/include/variante` y chip + línea del ticket viven en
  `.rev-sub`); línea 2: chip + línea, SOLO bajo la columna del alimento (en Dudas la columna 2
  del desplegable aparta los campos una posición; los estilos de `.ocr-tipo`/`.ocr-linea` son
  standalone, sin depender del envoltorio `.ocr-nombre` que queda sólo para el diálogo 1).
  Cabecera forzada a UNA línea (`> span { grid-row: 1 }`); en ≤640px las áreas se reordenan
  (alimento línea completa y campos debajo — en Dudas el desplegable también). **Verificación:**
  guardia geométrica en `e2e/ocr-despensa.mjs` (D): centro de cada etiqueta sobre su campo
  (±6px) Y centro VERTICAL del input del nombre ≈ el de cada campo — misma línea (±6px, Brave
  real; captura 25). Integración jsdom verde (550): el estado y los valores no cambian con el
  molde.
- `2026-10-21 · @AI-agent · #epic-ocr-despensa-camara · Síntoma (bug reportado por el usuario):`
  en Dudas, al resolver con un alimento REAL de la despensa, la fila seguía pintando los 5/1 de
  una alta — información falsa (la compra iba bien al alimento real, pero la pantalla decía
  otra cosa). **Causa:** `conectaVariante` de la vista sólo apagaba los campos, sin cargar
  los valores. **Arreglo:** al elegir variante los campos de la fila muestran YA la alerta
  REAL del alimento (su score y su min) deshabilitados — sólo la CANTIDAD sigue editable;
  al volver a "es nuevo" se restauran los valores propios (que hubiera escrito la persona,
  snapshot al primer cambio). **Verificación:** integración jsdom (ida/vuelta variante ↔ es
  nuevo, 9 tests) + Brave real `e2e/ocr-despensa.mjs` (D): 7/3 en pantalla y en la despensa
  final sin pisos.
- `2026-10-21 · @AI-agent · task menu-semanal-diseno · Síntoma:` el título del día («Lunes»)
  del menú semanal salía CENTRADO y cada día llevaba radio pequeño y padding corto,
  contradictorio con el CSS de sección 13 (que pedía flex a la izquierda). **Causa (hallada en
  el rediseño de las tarjetas):** el `<ul id="menu-plan-list">` nace con clase `alert-card` en
  el markup, y la regla genérica de la lista de despensa `.alert-card li` (0,1,1) APLASTABA a
  `.menu-day` (0,1,0) en todo lo compartido: `align-items:center` (centraba el header como
  flex item, shrink-wrapped), `border-radius: var(--radius-m)`, `padding: 9px 12px`,
  background `--card-soft` y `gap: 8px 14px`. **Arreglo:** la familia del plan lleva
  prefijo `#menu-plan-list` (1,1,0) en `style.css` — `.menu-day` (con `flex-wrap/align-items/
  font-size` explícitos para rebatir los de la lista de despensa), `.menu-day-header`
  (`align-self: stretch` sellado) y `.menu-meal-row` + hover + media queries; el override
  `#menu-plan-list.alert-card` (que ya existía para el contenedor) queda como estaba.
  **Verificación:** sonda de getComputedStyle en Brave (`gap/padding/radius/bg/align` del día
  ya con los valores de .menu-day; header estirado, `width` ≈ tarjeta − paddings) + suite jsdom
  completa verde (586) + e2e del plegado 12/12 + auditoría a11y móvil OK; capturas
  74-75-76 (escritorio oscuro/claro + móvil).
- `2026-10-21 · @AI-agent · task sugerir-ahora-lote · Síntoma:` el botón "↻ Sugerir ahora"
  (Card 1 de Sugerencias y menú) "ya no saca recetas": la lista quedaba vacía para siempre y
  ni rotaba. **Causa (repro con el backup real del usuario, 29 alimentos / 23 recetas / 111
  entradas en `mrcheff.cooked`):** el cooldown de 7 días vive en el pool común
  (`buildCandidatePool`) y con un aforo relativamente pequeño SÓLO 5 recetas del catálogo+Mis
  Recetas salían cocinables — y las 5 estaban cocinadas dentro de la ventana (aprobar el plan
  ancla hasta 21 entradas y cocinar día a día suma más) ⇒ ranking estricto = 0 tarjetas, sin
  rotación posible. Además, con despensas finas (4 desayunos + 1 comida) el RELLENO del lote
  (`planner.loteRotado`) re-escaneaba siempre desde el nº1 del ranking ⇒ el lote era el mismo
  set en cada click aunque los cursores avanzaran. **Arreglo (dos piezas):** (1) RODILLO DEL
  COOLDOWN en app.js: si el ranking estricto trae menos de 4, se completa con el pool SIN
  filtro de cooked (dedupe por título; las ya cocinadas quedan al final) — la Card devuelve
  SIEMPRE hasta 4 recetas "cocinables hoy con lo de casa", primero las no cocinadas. (2) En
  `loteRotado` el relleno escanea el ranking CIRCULAR desde la ventana que rota con el click
  (arranque `(clicks*max) % ideas.length`, cada índice como máximo una vez) ⇒ el set excluido
  cambia en cada click. **Verificación:** integration jsdom nuevo en
  `tests/suggest-rotation.integration.test.js` (todo lo cocinable cocinado → lote de 3-4 de los
  3 tipos y rota) + unit nuevo en `tests/planner.test.js` (5 candidatos finos: ningún click
  consecutivo repite set) + repro e2e con el estado real del backup (4 tarjetas, click a
  click cambia el excluido) + suite completa verde (588/588) + e2e plegado 12/12 + a11y OK;
  captura 81.
- `2026-10-21 · @AI-agent · #bugfix/lista-compra-color-prioridad · Síntoma (bug reportado por el
  usuario):` en la lista de la compra (Card 3 de "Sugerencias y menú") muchos ítems SIN registro
  en el Inventario (defaults: qty 0 / min 0 / score 5) salían UNOS en verde y OTROS en rojo, sin
  sentido; y los que SÍ tenían prioridad definida en casa no pintaban con ella. **Causa:** el
  color de la fila lo mandaba `urgenciaPorDias` — el semáforo por FECHA DE PREPARACIÓN del plan
  (hoy/mañana rojo, 2-3 días naranja, ≥4 verde) — desconectado por completo de la prioridad
  (score) del alimento en el Inventario. **Arreglo (SEMÁFORO DE LA COMPRA POR PRIORIDAD):**
  en `shoppingListFor` (módulo puro) cada fila busca SU alimento en el Inventario COMPLETO
  (registro ≠ stock — el matcher de tokens casa aunque la qty siga ≤ min, que es lo que MANTIENE
  la fila en la lista; si casan varios manda el de MAYOR prioridad): registrado → `urgencyLevel`
  de `priority.js` (rojo 8–10 · naranja 6–7 · verde 1–5) y la fila muestra su qty/min/score
  REALES (ya no los ceros de defecto); sin registro → urgencia NUEVA **"neutral"**, el color del
  propio texto de la app (`.alert-card li.urg-neutral { border-left-color: var(--text) }` — token
  existente en ambos temas, ningún hex suelto) y SIEMPRE AL FINAL del orden (peso neutral = 3).
  `onDay/daysUntil` se siguen calculando: el metadato "se usa el …" queda informativo y como
  desempate del orden. `app.js` (filaCompra) sólo cambia el default a "neutral". Se retira el
  helper muerto `urgenciaPorDias`. **Verificación:** unit `tests/menu-semanal.test.js`
  recontratado (registrado por score, sin registro neutro, varios casan → mayor score, neutro al
  final, onDay intacto) + integración NUEVA `tests/lista-compra-prioridad.integration.test.js`
  (DOM real vía bootApp: clases urg-* y datos reales en las tres clases de fila) + ajustes de
  expectativa de orden en `tests/ocr-ticket.integration.test.js` + suite completa verde
  (607 tests / 42 suites).
- `2026-10-21 · @AI-agent · #bugfix/compra-titulo-blanco-dialogo-ocr-movil · Síntoma (DOS
  reportados en pantallazos por el usuario):` (1) el título "🛒 Lista de la compra" salía VERDE —
  heredaba el tinte `--ok` de `.alert-card.alert-green h3` porque la tarjeta lleva `alert-green`;
  y (2) en MÓVIL, el diálogo de revisión del escáner ("Añade lo nuevo y resuelve las dudas")
  ponía la cabecera de columnas (Cantidad/Importancia/Mínimo/Incluir) AÑOS lejos de los inputs
  de cada fila: la retícula se reordenaba en estrecho y las etiquetas quedaban desconectadas de
  lo que nombran. **Arreglo (1):** regla específica
  `#shopping-list.alert-green h3 { color: var(--text) }` — el título va del color del TEXTO (el
  mismo blanco de los items sin prioridad, bugfix anterior); el verde queda en el borde de la
  tarjeta. **Arreglo (2):** cada control va DENTRO de su propio `<label class="rev-celda">` con
  un micro-etiqueta `.rev-etiqueta` encima (módulo HTML en `app.js`, ambos diálogos y también el
  desplegable "De tu despensa" en Dudas); en escritorio la etiqueta interna sigue OCULTA (la
  cabecera compartida nombra las columnas y calza con el ancho de la celda) y en ≤640px la
  CABECERA se esconde (ya no calzaba con nada) y el micro-etiqueta sale PEGADO a su campo, en
  retícula de 2 columnas (alimento/contexto a línea completa, campos en parejas) — clic en la
  etiqueta = foco en su campo (asociación implícita del label). Colocación de la retícula ahora
  por CELDA (wrapper), no por el input; se retiraron las reglas duplicadas de `.rev-cab-*`.
  **Verificación:** integración NUEVA `tests/ocr-dialogo-etiquetas.integration.test.js` (DOM
  real vía bootApp: label↦SU control en las tres clases de fila, `for` correcto, conectaVariante
  sigue deshabilitando tras el re-molde y la escritura final lee por id) + suite completa verde
  (610 tests / 43 suites).

---

- `2026-10-22 · @AI-agent · #epic-ocr-despensa-camara · síntoma reportado:` la métrica del corpus
  real (`e2e/ocr-precision.mjs`) medía Mercadona 20/21 ítems: el 2º "LOMO CEBO IBÉRICO" (compra
  REAL de dos veces al mismo precio, el OCR leyó "1 LoMO…" y "1 LOMO…") no salía en la revisión.
  **Causa:** el eco del OCR se deduplicaba por `nombre-normalizado|qty|precio` — dos compras del
  mismo producto al mismo precio colapsaban en una. **Arreglo:** el eco se deduplica por LÍNEA
  CRUDA EXACTA (el ítem del parser lleva su `linea` original: sólo el duplicado byte a byte es
  eco); el mismo-nombre del ticket acaba SUMANDO en un alimento al alta (regla anti-duplicado).
  **Verificación:** métrica Mercadona 100%/100% + spec de parser con las dos líneas crudas
  distintas del corpus (tests/ocr-ticket-parser.test.js, 19 tests).
- `2026-10-22 · @AI-agent · #epic-ocr-despensa-camara · síntoma reportado:` la generalización del
  rescate sin precio dejaba entrar LÍNEAS QUE NO SON PRODUCTOS como ítems: la cabecera ESPEJO de
  ALDI (el papel casi volteado se lee invertido: "09 oj9EjUOO ElJUO OLUJO9 JSP…", con qty 9
  fantasma del "09" de la fecha) y la DIRECCIÓN de Mercadona ("CL ALBERT EINSTEIN, 13", 100%
  mayúsculas). **Causa:** el rescate de mayúsculas (≥3 tokens, ≥2 full-caps) era demasiado
  generoso cuando se le quitaron los guardas `!qtyInicial`/`!aux`/`origen!==mercadona` para
  recuperar el granel cuyo precio el OCR comió. **Arreglo triple:** un token con dígito ENTRE
  letras (`/\p{L}\d+\p{L}/` — "oj9EjUOO") mata el rescate (las cifras de producto van sueltas al
  final: "FINA, 230", "MALLA 2KG"); en Mercadona NUNCA rescata (su columna de cantidad sostiene
  sus líneas); y el rescate SÍ acepta la línea de PESO pendiente (granel ALDI: "PIMIENTO DULCE
  ITALIAN 077201€" recupera su (500gr)). **Verificación:** Métrica final Mercadona 100%·100% /
  ALDI 100%·95,2% — la calidad es la del corpus REAL, no del volcado de inspección; los problemas
  quedan especificados en tests/ocr-ticket-parser.test.js (fixtures del texto de producción).

---

- `2026-10-22 · @AI-agent · #bugfix-ocr-dialogos-movil-descuadrados · síntoma reportado:` en el
  PWA móvil (~390px) los DOS diálogos del escáner del ticket salen totalmente descuadrados: la
  fila se abre con una retícula de SEIS columnas acartonadas y el NOMBRE del alimento queda
  aplastado a 1 letra por línea (captura 50 de la sonda). **Causa:** el rework del descuelgue
  (2026-10-21) puso en las celdas de la fila `grid-areas` de ESCRITORIO (`grid-area: 1/N`) y el
  bloque `@media (max-width: 640px)` sólo cambiaba `grid-template-columns` — las areas
  conservan su colocación explícita (misma especificidad; gana la que se declara DESPUÉS) y
  las celdas del escritorio generan pistas implícitas trituradas: la propiedad móvil que no
  REDECLARE las áreas no las vence.
  **Arreglo:** el bloque móvil vuelve a la retícula de líneas del primer diseño (nada
  aplastado) SOBREESCRIBIENDO cada area en el breakpoint, con el orden pedido por el usuario:
  línea 1 = campos (cantidad/importancia/mínimo/incluir con su etiqueta encima), línea 2 =
  nombre a línea completa, el sub al final; en Dudas el desplegable ocupa su línea completa
  antes de los campos; en el diálogo 1 (flex) el swap sale por `order: -1`. **Verificación:**
  e2e real en `e2e/dialogos-movil-reticula.mjs` (12 checks de geometría a 390px: 4 pistas
  reales, campos encima del nombre, desplegable línea completa, sin desborde — capturas 51-52)
  + suite completa verde (640/640).

---

- `2026-10-23 · @AI-agent · #bugfix-ocr-sub-movil-sobre-nombre · síntoma reportado:` en el PWA
  móvil (≤640px), en las filas de DUDAS del diálogo 2 el tag de tipo («Cereal», «Verdura»,
  «🏠 Producto de hogar»…) salía ENCIMA del campo del nombre — solapado con el input. **Causa:**
  al añadir la línea propia del conmutador 🍎/🏠 (2026-10-22), la regla combinada del sub (`{ grid-area: 4 / 1 / 5 / -1 }` para
  NUEVOS y DUDAS por igual) quedó en la línea 4 — la MISMA en la que vive el nombre de la fila
  DUDA (su retícula tiene UNA línea más: desplegable + conmutador). **Arreglo:** regla propia
  `.rev-fila-duda .rev-sub { grid-area: 5 / 1 / 6 / -1 }` tras las áreas de Dudas. La guardia
  e2e sólo asertaba el sub bajo el nombre en NUEVOS — añadió el aserto de Dudas (14 checks).

---

- `2026-10-23 · @usuario · #bugfix-ocr-opciones-dudas-en-situ (REVERTIDO) · síntoma reportado:` el
  desplegable «es nuevo: se define aquí» de la sección DUDAS desplegaba sus opciones en OTRO punto
  de la pantalla con el modal desplazado. **Intento de arreglo (merge `76e6626`):** options EN
  FLUJO con radios nativos en la fila (`fieldset.rev-opciones`). **Resolución final:** el
  síntoma SÓLO se reproduce en ESCRITORIO con la vista emulada a móvil (DevTools) — en el móvil
  real el popup nativo del `<select>` sale SIEMPRE bien (Brave y Safari en la PWA instalada), y
  la persona prefería la implementación anterior → se REVIERTO el merge entero
  (`git revert -m 1`, commit `882a4ff`): desplegable restaurado, doc y e2e de vuelta a la era
  select, suite 643/643 verde. Si algún día urge posponer el popup en desktop-emulación,
  re-aplicar revirtiendo el revert (los radios nacen baratos de ahí).

---

- `2026-10-23 · @AI-agent · #bugfix-ocr-duda-desktop-nombre-ancho · síntoma reportado:` en DESKTOP,
  en la fila de DUDAS el nombre del producto quedaba exprimido (~74px) porque la columna fija del
  desplegable devoraba 170px del ancho. **Arreglo:** el desplegable estrecha su columna a 104px —
  el nombre (columna flexible `1fr`) pasa a 140px — y el POPUP nativo del `<select>` conserva su
  tamaño al desplegar (se abre al ancho de la opción más larga, capa del navegador: la opción
  entera se lee igual; el popup no es capturable por el harness, comportamiento nativo asumido).
  De paso: `lineaContexto` ya no pinta comillas `“”` vacías cuando la línea del ticket no llega,
  y el bloque (D) de `e2e/ocr-despensa.mjs` se moderniza a la era parser-first SOBRE EL
  DESPLEGABLE (el revert del 2026-10-23 lo había devuelto al estancamiento pre-parser: llevaba
  rojo desde el rework del 22). **Verificación:** suite 643/643, e2e
  `dialogos-movil-reticula.mjs` (móvil intacto) y `ocr-despensa.mjs` completos en verde; capturas
  57-58 (escritorio 1280/1000px).

---

- `2026-10-23 · @AI-agent · #bugfix-ocr-duda-movil-nombre-primero · petición del usuario: ` en el
  PWA (≤640px) el bloque «De tu despensa» + desplegable abría la fila de DUDAS y el nombre quedaba
  abajo. **Arreglo:** intercambio directo de las áreas 1↔4 de la retícula de la fila (el
  NOMBRE sube a la línea 1, el desplegable baja a la 4) — resulta el orden pedido: Alimento+caja →
  campos (cantidad/importancia/mínimo/incluir) → tipo 🍎/🏠 → desplegable «De tu despensa» → sub
  (tag de categoría + línea del ticket) al final. NADA MÁS se mueve (retícula de NUEVOS intacta,
  desktop con su plantilla propia). **Verificación:** e2e
  `dialogos-movil-reticula.mjs` actualizado (asertos del nuevo orden + `nombrePrimeroEnDuda`) y
  en verde, suite 643/643; capturas 51-52 + 59.

---

- `2026-10-23 · @AI-agent · #bugfix-ocr-nuevos-movil-nombre-primero · petición del usuario:` la
  fila de NUEVOS mantenia el nombre abajo (campos arriba) — al revés del patrón de Dudas del
  mismo día — y la etiqueta «Incluir» colgaba unos píxeles por debajo de
  Cantidad/Importancia/Mínimo en LAS DOS secciones. **Arreglo:** mismo rostro que Dudas: el
  NOMBRE sube a la línea 1 (campos → conmutador → sub detrás) y la FILA alinea al ARRIBA
  (`align-items: start`) — el centrado vertical de la celda «Incluir» era el hueso (checkbox
  de 24px vs inputs más altos): el check recupera su centrado frente a los campos con
  `margin-top: 6px` y las 4 etiquetas quedan a la misma altura (Δ 0px medido). **Verificación:**
  e2e `dialogos-movil-reticula.mjs` actualizado (nombrePrimero/enNueva, conmutador bajo los
  campos, «Incluir» alineado ≤3px en ambas secciones), suite 643/643; capturas 51-52.
- `2026-10-22 · @AI-agent · #feature/tutorial-demo-escaner · Síntoma:` el test de integración
  RECORRIDO COMPLETO del tutorial fallaba al final: el anuncio recibía el repintado de un paso
  ya pasado ("Siguiente" en lugar de "Terminar") y se veían "ecos" de pasos antiguos tras el
  cierre. **Causa:** defecto PREEXISTENTE del arnés de test (`tests/boot.js`), no del app:
  jsdom — incluso con `runScripts:"outside-only"` — dispara SU `DOMContentLoaded` natural cuando
  el documento termina de parsearse, ASÍNCRONO tras el constructor; sumado al disparo manual del
  arnés, el closure de `DOMContentLoaded` de `app.js` corría DOS veces en cada `bootApp()`
  (doble sesión del tutorial, cada botón con su listener duplicado, dobles renders — los
  recorridos que no atravesaban el final del guion no lo notaban). Verificado con sondas
  temporales que en HEAD/develop el doble boot ya existía. **Arreglo:** el arnés CAPTURA ahora
  los listeners de `DOMContentLoaded` que registran los scripts y el disparo manual los invoca
  UNA sola vez (sincrónico); el evento natural de jsdom queda sin oyentes. Producción intacta.
  **Verificación:** sondas (1 click → 1 llamada, antes 2) + suite completa 650 tests / 45
  suites verdes + cobertura global 94/83.

---

- `2026-10-23 · @AI-agent · #final-refactor · Síntoma:` al partir el cierre de `app.js` en 4 vistas
  de fábrica (`views/*.js`, `ctx` compartido) la suite cayó a 42 fallos/12 suites: `ReferenceError:
  limpiarPaso is not defined` en la ficha de receta y el copiar métodos; `TypeError: ctx.badgeSyncHTML
  is not a function` en el render inicial de recetas/innovación; `ReferenceError: Cannot access
  'ctx' before initialization` en el clic de Sync y al regenerar la lista de la compra. **Causa:**
  tres problemas de resolución de nombres del split: (1) los helpers de `modules/util.js`
  (`limpiarPaso`, `formatoFechaCorta`) llegaban por destructuring SOLO al core y no a las vistas;
  (2) `badgeSyncHTML` (molde de la vista copias) se publicaba en `ctx` AL FINAL de su fábrica,
  demasiado tarde para las vistas que arrancan antes; (3) los `const ctx` locales que en el
  cierre único eran sombra legítima (handler del sync `contextoSync(pass)`, contexto de la lista
  de la compra) CHOCAN con el parámetro de la fábrica: el TDZ del shadow rompe cada referencia
  previa de esa función. **Arreglo:** (1) el core publica `ctx.limpiarPaso` y
  `ctx.formatoFechaCorta` y las vistas los leen por `ctx`; (2) `badgeSyncHTML` sube al CORE
  (donde viven los moldes HTML) y se publica antes de iniciar las vistas; (3) las sombras se
  renombran (`ctxSync`, `ctxCompra`) y los parámetros sync de
  `encaminarResultado`/`abrirModalResolver` pasan de `ctx` a `ctxSync` (sus usos FACTORÍA quedan
  como `ctx.modalContent`/`ctx.toast` y los BUZÓN como `ctxSync`). **Verificación:** suite
  completa 675 tests / 47 suites verdes + cobertura global 94.32/83.68/98.45/97.01.

---

- `2026-10-24 · @AI-agent · #bugfix/scroll-caja-fuerte-pwa · Síntoma reportado (usuario):` en la
  vista de CAJA FUERTE (Copia de seguridad) de la PWA se veía la BARRA del scroll del documento.
  **Causa:** sus dos tarjetas miden ~283px más que el viewport (de ahí el scroll, correcto) y era
  la ÚNICA scrollbar de la app sin esconder: la del NAV de pestañas (`scrollbar-width:none`),
  la del `.modal-box` y la del nombre de alimento ya se ocultaban con el mismo precedente. Siendo
  la barra del DOCUMENTO (el scrollport es `html`), no hay forma de apuntarla por menos que la
  vista activa. **Arreglo:** en `style.css`, regla con `:has()` que esconde la barra SÓLO con la
  vista de caja fuerte activa (`html:has(#view-backup.active) { scrollbar-width: none }` +
  `::-webkit-scrollbar { display:none }` para Chromium viejo): la barra muere, el scroll NO —
  táctil/rueda/teclado/botón flotante siguen vivos y las DEMÁS vistas conservan la barra nativa
  (alcance exactamente el pedido; con WebKit sin `:has` la regla no aplica ⇒ degradación grácil).
  **Verificación:** nuevo e2e repetible `node e2e/scroll-caja-fuerte.mjs` — 6 checks en Brave
  real móvil (390×844): none con la caja activa, scroll vivo hasta el fondo (scrollTop 283),
  alto del documento intacto, sin barra horizontal nueva, `auto` de vuelta en Alimentos y
  re-ocultado al volver; suite completa 675/675 intacta; captura reports/ui-brave/scroll-caja-fuerte.


- `2026-10-25 · @AI-agent · #bugfix/favicon-tabs · Síntoma reportado (usuario):` el icono de
  Mr Cheff NO salía en las tabs del navegador en la PWA servida
  (https://inigo9777-design.github.io/webapp/ — tab genérica).
  **Causa:** `index.html` no llevaba ningún `<link rel="icon">` — sólo apple-touch-icon y
  manifest — así que el navegador caía a pedir `/favicon.ico` en la RAÍZ del dominio, que en
  GitHub Pages es 404 (esta app se sirve bajo `/webapp/`; el favicon vive fuera de la mkapa app-shell).
  **Arreglo:** `<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">`
  con ruta RELATIVA (una ruta absoluta `/icons/…` rompería bajo el sub-directorio de Pages).
  **Verificación:** servido con el layout real de Pages el head resuelve
  `…/webapp/icons/icon-192.png` → 200 image/png (Brave headless); suite 685/685 intacta.
