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
