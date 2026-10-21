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

- `2026-10-21 · @AI-agent · #epic-ocr-despensa-camara · Síntoma (bug reportado por el usuario
  probando el diálogo 2 del escáner):` las columnas del diálogo de revisión (Nuevos y Dudas)
  salían DESCUADRADAS — la cabecera etiquetaba en sitios donde no había campo, y los campos
  quedaban apelotonados a la derecha/bajo el nombre. **Causa:** la cabecera (flex, gap 8px)
  y las filas (flex, gap 10px) calzaban distinto: anchuras no correspondidas, el checkbox
  (19px) contra una columna de 62px y el aplanado lateral descompensado. **Arreglo:** cada
  sección comparte una RETÍCULA (`grid`) por cabecera y filas `.rev-cab-nueva/.rev-fila-nueva`
  y `.rev-cab-duda/.rev-fila-duda` con la MISMA plantilla de columnas y calzado — la etiqueta
  cae siempre sobre el campo que nombra; en ≤640px el bloque del alimento pasa a línea completa
  y los campos se reparten debajo con la misma plantilla estrecha. **Verificación:** guardia
  geométrica en `e2e/ocr-despensa.mjs` (D): el centro de cada etiqueta sobre el centro de su
  campo (±6px, Brave real).
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
