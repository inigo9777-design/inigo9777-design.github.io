# Código & testing — Estándares del proyecto Mr Cheff (webapp)

Vigentes a partir de 2026-10. Esta es la **fuente única** y canónica de los estándares de código y
testing del MVP; `AGENTS.md` lo referencia como tal (sustituyendo al *pointer* previo
`.claude/rules/CodingStandards.md`, ya eliminado junto a toda la carpeta `.claude/`). Este archivo
tiene siempre prioridad si alguna versión está desactualizada.

Aplica **solo a `webapp/`** del MVP de Mr Cheff. No aplica a `Scripts-Utilities/`, ni a ningún
proyecto KMP/Android/iOS (no existe — ver AGENTS.md).

---

## 1. Principios base ("what we care about, in priority order")

1. **Corrección > legibilidad > mantenibilidad > velocidad de escritura.** Lo que se pruebe es lo
   que se mantiene. Un cambio sin su prueba correspondiente no entra en `main`.
2. **Testabilidad antes que comodidad de implementación.** Si una decisión hace más difícil el test,
   probablemente rompe un principio SOLID y hay que reconsiderarla — salvo justificación explícita
   documentada al final del archivo con motivo ("why").
3. **Cambios son *expand-contract / Boy Scout Rule*.** No reescribir `app.js` de una vez; en cada
   PR: dejar el código que tocas un poco mejor (extract function, inyectar dependencia, separar lógica
   del DOM) que cuando llegas. La refactor total es opcional y gradual ("per-feature").
4. **Sin build step hoy** — la app se abre como `index.html`. Cualquier propuesta que introduzca
   bundler/compilador debe abrirse como PR *explícita* con justificación, no "de pasada".

---

## 2. SOLID en JavaScript (adaptado, no copiado literal)

Java-oriented en origen; aquí se traduce a patrones pragmáticos JS:

| Principio | En esta app significa | Ejemplo concreto (Mr Cheff webapp) |
|---|---|---|
| **S** Single Responsibility | Un módulo = un motivo de cambio. Separar *lógica pura/decidir* de *renderizar DOM* de *persistir*. | `urgencyLevel()`, `classifyFood()`, los generadores de innovación, `buildBackup()`/`applyBackup()` deben ser funciones/módulos **puros** (sin tocar DOM ni localStorage). Hoy están dentro del closure de `app.js`; el objetivo per-feature es extraerlos. |
| **O** Open/Closed | Añadir capacidad sin editar código existente que ya funciona. | Nuevos *arquidiólogos* de innovación (`makeVariation`/`makeCombo`/…) o nuevos tipos de alimento se registran en un **array de generadores clasificados por `source`**, no mediante `if/else` anidados dentro `generateInnovations()`. |
| **L** Liskov Substitution | Un "objeto" solo es válido si cumple su *shape* contract; una suplantación (`mock storage`, un futuro real-LLM en lugar del simulado) debe comportarse igual. Los shapes de `Food`/`Recipe`/`Innovation`/payload-de-backup son contratos: **no amplíes ni rompas su forma** (ver §5). |
| **I** Interface Segregation | Dependencias inyectadas deben ser **estrechas**: un módulo que solo necesita "leer y escribir un diccionario de clave-valor" no se le pasa `window` entero. | Definir interfaces mínimas: `Storage { get(key); set(key,val) }`, `IdeaGenerator { generate(count, focus, pantry): Idea[] }`. Los consumidores reciben exactamente eso por argumento (factory inyectado), no el estado global del DOM. |
| **D** Dependency Inversion / testability | El código de alto nivel (**decisiones: generar innovación, avisar reponer, mergear backup**) no debe llamar a detalles concretos (`localStorage`, `document`); esos detalles se inyectan desde abajo hacia arriba en un **composition root**. | Esto lo que hoy es el cierre único de `DOMContentLoaded`: mañana, un módulo `main()` (composition root) crea y *inyecta* en los servicios ya creados las dependencias. Hasta ese día: funciones puras exportables + DOM solo en la capa vista. Es **la** razón por la que los unit tests deben poder ejecutarse sin jsdom (§6). |

> Nota: si un cambio *no puede* cumplir un principio, documentar el "Por qué no" al final de este
> archivo antes del merge (con autor + fecha), que quede registrado en la decisión, no en silencio.

---

## 3. Arquitectura objetivo (mandato **per-feature**, no forzado global)

Estado actual: toda la lógica vive dentro de un único closure `document.addEventListener("DOMContentLoaded", …)`
en `app.js`, con acceso directo a `window`/`localStorage`/`document`. Esto hace que testear "todo" requiera
cargar el app completo en jsdom (ver §6), no probar unidades aisladas.

**Mandato per-feature:** cada **nuevo módulo o feature** se escribe modular y testeable; el código
*legacy* (lo que ya está en ese closure) se va refactoring *oportunístico* cuando se toca, nunca una
reescritura monolítica.

Estructa recomendada en la nueva capa (no obligatoria migrar `app.js` de golpe):

```
webapp/
├─ index.html            # composition root visual: carga <script>s en orden fijo
├─ data.js               # datos estáticos puros → window.MR_CHEFF_DATA { MESES, TEMPORADA }
├─ main.js  (nuevo)      # composition root JS: crea e inyecta deps; reemplaza el "inicio" del closure de app.js
└─ modules/              # nuevo directorio para código modularizado
    ├─ domain/           # funciones/módulos PUROS, sin DOM ni I/O  → objeto Food/Recipe/Idea builders,
    │   ├─ urgency.mjs         urgLevel(score), needsRestock(food, today)
    │   ├─ classify.mjs        FOOD_TYPES/TYPE_ORDER + norm() + classifyFood()
    │   └─ innovations/
    │       ├─ registry.mjs   # array de { source, run() } → cumple Open/Closed al añadir generador
    │       └─ variation.mjs  combo.mjs  libre.mjs  foco.mjs (protagonista)
    ├─ infra/            # adaptadores concretos detrás de interfaces (DI desde abajo hacia arriba)
    │   ├─ storage.localJsdomSafe.mjs   implementa Storage usando localStorage + try/catch
    │   └─ ai.simulated.mjs  implementa IdeaGenerator con las heurísticas deterministas actuales ("Modo simulado")
    └─ views/            # capa de "binding": recibe store+generators inyectados, manipula el DOM
        ├─ alimentos.mjs
        ├─ recetas.mjs
        ├─ innovacion.mjs
        ├─ temporada.mjs
        └─ backup.mjs
```

Patrones aceptados de módulo (elige por feature; ambos válidos dada la ausencia de build step):

- **(A) Factory global + namespace bajo `window.MrCheff`** — sin migrar a ESM nativo todavía: cada archivo
  new-feature expone una factory p.ej. `window.MrCheff.Innovations = { generate, ... }`; el DOM/seguimos
  cargándolo por `<script>` en `index.html`. Sin server requirement, cero fricción migratoria. (Recomendado hoy)
- **(B) Native ES Modules** (`<script type="module">` + `import/export`) — cuando se quiera desplegar servido (no `file://`); trae requerimiento de **servidor HTTP para tests E2E/UI** (CORS/restrictiones del navegador con módulos nativos vía file://), que hay que asumir explícitamente en ese momento.

Ambos caminos deben respetar: **lógica pura fuera del DOM**, deps inyectadas por factory argumento,
un `main.js`/composition-root como "entrada única" de inicio (hoy el cierre de `DOMContentLoaded`; mañana
`main.js`). La carga ordenada `data.js → app.js → ...modules…` se preserva.

Recomendación de migración: empezar por extraer `domain/urgency.mjs`, `domain/classify.mjs` y un
`infra/storage.localJsdomSafe.mjs` como PR piloto (dejan la app funcionando idénticamente), luego una feature
nueva ya nace completa en el patrón elegido.

---

## 4. Convenciones de código

- **Idioma** — Todo texto visible al usuario y todo comentario de código **en español** (convención
  histórica del repo; ver AGENTS.md). No mezclar en un mismo archivo sin justificación documentada.
- **Seguridad XSS** — Todo contenido de usuario que se inserte en HTML (`innerHTML`, `insertAdjacentHTML`)
  se pasa por `escapeHTML()` (ver `app.js`). **Nueva** UI que renderice datos de usuario: aplicar la misma
  regla; si no puede aplicarse, justificar por qué ese campo no es inyectable. Nunca string-concatenar un
  nombre de alimento / receta de entrada del usuario sin escapar.
- **Acentos** — Los *keywords* para clasificar alimentos se normalizan (NFD + quitar combining-marks) antes
  de comparar (`norm`), pero los nombres en `TEMPORADA`/`MESES` conservan acento real (es datos de
  presentación, no de matching). No homogeneizar sin entender la distinción.
- **Persistencia** — Solo vía helpers `load(key, def)` / `save(key, val)` sobre las claves del objeto `LS`
  (`mrcheff.foods`, `.recipes`, `.innov`, `.innov.date`), nunca `localStorage.*` crudo nuevo en el código:
  así se conserva la fallback y el manejo de JSON consistentes. Cuando se migre a patrón (A)/(B): estas
  helpers conviven con un objeto `Storage` inyectado que ya las encapsula por dentro; no duplicar la lógica.
- **Concurrencia de estado** — No asumir atomicidad entre leer + escribir localStorage si dos pestañas abren
  el app a la vez (no hay transacción); documentar esta limitación si algún feature dependiera de ella.
- **Naming** - Los nombres de las variables de las funciones y de las clases tienen que ser autoExplicativos que
  leas el código y se parezca más a leer en español que tener variables con nombres p2, x1 etc o funciones como
  play a secas, a que se refiere a jugar? a reproducir?. Si una función es muy larga extraer trozos de ella a 
  funciones privadas con nombres coherentes.
- **Comentarios** - No abusar de los comentarios el código debe entenderse según se lee

---

## 5. Data model: contratos que no puedes romper sin avisar *(Liskov)*

Estos shapes son públicos entre varios módulos (alertas, backup merge, innovación): **cualquier cambio de
forma es un change breaking a nivel contrato** y necesita: test + nota en esta sección + decisión registrada.

- `Food` = `{ id, name, score(1–10), qty, min, checked(boolean), createdAt }`. Regla invariante del alertado:
  `qty <= min` ⇒ *necesita reponer*; `urgencyLevel(score)` → rojo [8–10], naranja [6–7], verde [1–5]. El aviso
  semanal muestra el nivel del item más urgente y **capa a 8**.
- `Recipe` = `{ id, title, meal: "desayuno"|"comida"|"cena", ingredients[], method[], createdAt }`. Las
  recetas guardadas *desde innovación* añaden opcionalmente `source`, `from`, `uses[]` — no obligantes al crear
  una receta manualmente.
- `Innovation idea` = shape compatible con Recipe + `{ source: "variacion"|"combo"|"libre"|"protagonista"|"nueva", uses?, ... }`.
  **Expiración automática**: si `mrcheff.innov.date != hoy`, al cargar se vacía la lista; además siempre
  recortada a las 30 ideas más recientes. Ambos invariantes están sujetos a test de integración (§6).
- Payload de copia de seguridad = `{ version, exportedAt, foods[], recipes[], innovations[], innovDate }`.
  IMPORT **anexa** los datos de otra copia: alimentos deduplicados por nombre, recetas/innovaciones añadidas 
  al final del histórico (nada de lo guardado desaparece) y cada una recibe un `uid()` fresco; el histórico previo no se borra. No romper este flujo — debe seguir cubierto por un test de integración (§6).


(Nota sobre tipado: hoy no usamos TS ni tipos estáticos en la app, pero las pruebas de integración actúan como
nuestro "contract test": si un shape cambia, el test roto es el aviso.)

---

## 6. Testing — obligatorio para lógica nueva; capa por capa

Pila ya configurada: **Jest + jsdom** (`webapp/jest.config.js`), con `tests/boot.js` que simula la carga
del app en un DOM real y `tests/setup.js` con polyfills (requestAnimationFrame, scrollIntoView, mock de
Clipboard/FileReader). Umbrales de cobertura configurados: statements 70 / branches 65 / functions 70 / lines 70.

### Capa 1 — Unitarias · **OBLIGATORIAS** (todo código nuevo en este repo)
- Cada módulo *puro* de `modules/domain/` y cualquier función nueva que decida comportamiento (no solo
  renderiza DOM) **debe tener su spec co-ubicada** (`tests/<modulo>.test.js`, naming `*.test.js` por
  convención del `jest.config`). Ejemplos: urgLevel score→color, needsRestock, classifyFood con/ sin acento,
  generadores de innovación (seed fijo determinista → salida predecible), merge/dedup de backup, auto-expire.
- Sin jsdom lo antes posible para estas unidades: si un "unit test" necesita lanzar `tests/boot.js` y cargar el
  app completo es señal que la lógica **no está bien separada del DOM** — refactorizar hasta lograr
  requerirla directa (esto es literalmente lo que §2-D pide).
- Cobertura mínima por módulo nuevo/refactorizado: **≥80 lines / ≥75 branches** para el código 
- Si creamos un nuevo fichero de tests tenemos que añadir la clase correspondiente sobre la que se hacen los tests en jest.config.js en collectCoverageFrom como una nueva entrada.
*nuevo* de ese
  PR. Las cifras de cobertura globales (~65/70 %) se mantienen como piso del proyecto; pueden subirse 
  lentamente pero nunca reducirse sin justificación en §8.
- Workflow del equipo (ver `.continue/prompts/unit-tests.md`): escribir specs → correr `cd webapp && npm run coverage`
  → iterar hasta que todo pase con la cobertura mínima → commit. No se entra un PR sin esto.
- **Determinismo**: tests no pueden depender de fecha real (`new Date()`), ni de `Date.now()`/random para ids en
  lógica: inyectar "hoy" y un `uid` provider cuando el código lo permita; si algún path exige reloj real, usar
  mocks/fakes de jsdom que ya existen en `tests/setup.js`.


### Capa 2 — Integración vía jsdom/harness · **OBLIGATORIA cuando el cambio atraviesa módulos**
- Requerida cada vez que un PR toca más de uno módulo o altera el flujo DOM↔localStorage: guardar→recargar→re-render,
  auto-expire 24h real, round-trip export→import (merge correcto, deduplicado por nombre). Viven en `tests/**/*.integration.test.js`,
  reutilizando `tests/boot.js` + `setup.js`. Ejemplo canónico: un nuevo generador de innovación que se integre a la
  vista → debe existir una test de integración que lo pruebe *cargando* el app como si fuera un usuario.

### Capa 3 — UI / E2E · **"si es posible"** (camino recomendado, no bloqueante todavía)
- Herramienta sugerida: **Playwright**, corriendo sobre una versión *servida* de `index.html` (no via `file://`),
  ya que cualquier migración hacia ESM nativo (§3, patrón B) necesitará servidor HTTP para CORS/módulos.
- Cuando se elija adotar este nivel: crear carpeta `/webapp/e2e/` con un `playwright.config.js` + al menos una smokes
  de flujo principal p.ej. "crear receta → guardar → recargar página → verla en lista; exportar backup → importar en
  contexto vacío y comprobar merge" — antes o junto a la feature que lo añade.
- No es **obligatorio hoy** ni bloqueante para merges si no se está tocando flujo visible al usuario de forma nueva; pero **si** un PR toca/crea un flujo *visible al usuario* nuevo (un tab, una acción que antes no existía),
  debe dejar al menos un *stub* E2E registrado (aunque sea `todo:`) para no perder la trazibilidad.

> Nota opcional/recomendada (no obligatoria en este momento dado el escopio acordado): añadir ESLint + Prettier y
> precargarlo vía pre-commit/CI haría que los estándares sean ejecutables, no solo convenciones. Se recomienda
> revisarlo como siguiente paso independiente, no mezclar con otro PR.

---

## 7. Definición "Done" por PR / cambio (Definition of Done)

Antes de dar un change como terminable:

- [ ] Lógica nueva tiene **unit test(s)** en `tests/*.test.js` y pasa con cobertura ≥ el mínimo del módulo (≥80/75)
  para ese trecho de código; y no se reducen los umbrales globales sin registro decidido (§8).
- [ ] Si cruza módulos o toca persistencia/DOM: **integrción via jsdom** presente y verde
      (`npm test` / `npm run coverage`).
- [ ] `cd webapp && npm run coverage` pasa sin warnings nuevos; si hay cobertura caída, justificarlo.
- [ ] No rompe ningún shape de §5; si cambia uno: nota documentada aquí + decisión registrada (autor/fecha) al final del archivo.
- [ ] Si crea/toca un flujo *visible al usuario* nuevo: stub E2E registrado en `e2e/` (aunque sea pending).
- [ ] No se ha añadido dependencias (`package.json`) sin PR explícito justificándole; `node_modules/` sigue sin
      tracking por git (no `.gitignore` hoy — ver AGENTS.md, **nunca** `git add -A`).
- [ ] Cambios de UI: texto en español + escapeHTML aplicado a nuevo contenido injectable.
- [ ] `AGENTS.md` actualizado si cambió arquitectura o comandos/directorio de config (p. ej. `.opencode/commands/`, `.opencode/skills/`) para no quedar desactualizados; `CLAUDE.md` fue eliminado, ya no existe como referencia aparte.

---

## 8. Log de excepciones (decisiones que violan un principio)

_Aquí se anota cualquier "Por qué rompimos X en este caso", con formato_ `YYYY-MM-DD · @autor · #tarea · Principio: <S/O/L/I/D> · Justificación: …`. _

- `2026-10-18 · @AI-agent · #bugfix-matching · Principio: O, D · Justificación:` el matcher bidireccional
  por subcadena-cruda (`includes()`) de `planner.js` e `innovations.js` daba falsos positivos graves
  (ingrediente "Sal" encajaba dentro del alimento "Salchichón ibérico"). Se extrae el módulo puro
  compartido `modules/ingredient-matching.js` (tokens+deplural, sin prefijos sueltos) y ambos módulos
  lo consumen: se CIERRA la duplicación de matcher que existía entre ambos (deuda §3 previa) en lugar
  de corregir dos copias idénticas.
- `2026-10-18 · @AI-agent · #feature-menu-7x3 · Principio: O, D · Justificación:` cambios de contrato
  acordados con el usuario (menú semanal de 3 comidas/día + cambio individual de receta):
  1. `planner.buildWeeklyMenu` pasa de `plan[7] = { dayLabel, recipe, missing }` a
     `plan[7] = { dayLabel, meals[3] = { meal, recipe, missing } }` (shape evoluciona, tests actualizados).
  2. Se AÑADE una 6ª función pública a planner (`pickRecipeForSlot`) rompiendo temporalmente la "API
     cerrada de 5" porque el swap por día+comida pertenece al dominio del planner (ranking compartido,
     un solo mecanismo §3); la lista cerrada se re-valida en `planner.test.js` con las 6 funciones.
  3. Se RETIRA `opts.rng` de `buildWeeklyMenu` (la rama aleatoria de rampa B no aporta valor con 21
     slots por tipo de comida: el relleno es determinista por ranking + degradación por repeticiones
     inter-día; los tests del contrato rng se reescriben en consecuencia).
  4. En `menu-semanal.js` se RETIRA `regenerateAfterCook` (regeneración completa al cocinar) y se
     sustituye por la composición `cookEntry` + `swapSlotRecipe`: cocinar desde el menú renueva SOLO
     el hueco del plato cocinado en lugar de descartar el resto del plan (mejor semántica para el
     usuario, misma pureza). `"🔄 Cambiar"` persiste además un campo opcional `triedKeys` por slot
     para que clicks sucesivos recorran el ranking sin oscilar (shape persistido extendido, sólo para
     `mrcheff.weekmenu`).
- `2026-10-18 · @AI-agent · #feature-editar-recetas · Principio: O · Justificación:` el plan semanal
  aprobado era un SNAPSHOT de sólo lectura ("no muta hasta regenerar/cambiar"). Con el editor de
  recetas (botón "✏️ Editar" del modal de detalle), si la receta editada proviene de Mis Recetas el
  hueco del plan que la incrusta NO puede quedar mostrando el estado viejo: `aplicarEdicionAlPlan`
  (app.js, capa views) parchea las copias del objeto embedded en `mrcheff.weekmenu.plan` por
  `recipe.id`; para una copia nueva creada desde el catálogo se parchea por el id ORIGINAL del plato
  del menú. El resto del plan (missing flags, needyFoods) NO se recalcula: el plan sigue siendo
  snapshot para el cálculo de compra; lo editado es la ficha visible del plato, no su análisis de
  disponibilidad. Regenerar el menú reancla todo al estado nuevo de Mis Recetas.
- `2026-10-18 · @AI-agent · #feature-cocinar-hoy-y-rotacion-sugerencias · Principio: O · Justificación:`
  se AÑADE una 7ª función pública a `planner.js` (`loteRotado`) rompiendo temporalmente la "API
  cerrada de 6" porque la composición del lote del botón "↻ Sugerir ahora" (máx 4 tarjetas con
  1 desayuno + 1 comida + 1 cena + una 4ª que rota de tipo, avanzando un cursor por tipo de comida)
  pertenece al dominio del planner (opera sobre SU ranking de `suggestToday`; un solo mecanismo §3);
  la lista cerrada se re-valida en `planner.test.js` con las 7 funciones. La persistencia y el toast
  del registro "cocinado hoy" (`registrarCocinado`) SÍ quedan en `app.js` como glue del composition
  root: la parte pura ya vive y se testea en `menu-semanal.cookEntry` (§6 Capa 1) y el wrapper no
  contiene más que load/save/toast (§3: `app.js` permanece como composition-root legacy).
- `2026-10-18 · @AI-agent · #feature-etiqueta-origen · Principio: S-O · Justificación`: el catálogo
  curado pasa a incluir 20 recetas italianas (dataset 200 registros), y la etiqueta de fuente de
  Innovación era "Receta española" FIJA vía `SOURCE_LABEL.curada`. Se extrae la decisión a un módulo
  puro NUEVO `modules/origen-recetas.js` (2 funciones: `esItaliana` / `etiquetaOrigen`; decisión por
  id del catálogo + respaldo por título normalizado, porque ideas/sugerencias/huecos del plan
  generan un uid propio que NO conserva el id del dataset); el valor `curada` del dataset sigue
  siendo su única marca de fuente. Los ids italianos se publican como PROPIEDAD del array exportado
  (`dataset.idsItalianas`) para no romper el contrato "module.exports = array" de consumers
  existentes. La etiqueta se pinta dinámicamente en TODAS las vistas de recetas (Recetas, Innovación,
  Sugerencias, Menú, modal); fuentes legacy distintas de curada/receta_sugerida conservan su tag
  clásico y una receta de usuario manual sin señal de origen se trata como española (señal ausente
  ≠ italiana).
- `2026-10-18 · @AI-agent · #feature-sello-origen-guardado · Principio: O · Justificación`: guardar
  una copia (⭐ estrella / ✏️ editor desde catálogo/plan) derivaba la etiqueta por TÍTULO en el
  render, con dos defectos: renombrar la copia perdía el origen de la idea italiana (quedaba como
  "española") y la guardada con `source:"curada"` pintaba DOS veces "Receta española" (badge nuevo +
  tag clásico). Se SELLAN ahora al momento del guardado: campo opcional `origen:"italiana"|"espanola"`
  en la receta persistida — `recipe-editor.applyEdit` lo recibe por `deps.origen` SOLO en modo copia
  (in-situ preserva el de la guardada) y `patchPlan` lo lleva a las copias incrustadas del plan; el
  módulo `origen-recetas` le da PRECEDENCIA sobre id/título. En las vistas, el tag clásico `curada`
  se oculta cuando duplica literalmente la etiqueta de origen (los demás tags, como
  "Sugerencia de hoy", se conservan). Copias guardadas ANTES de este cambio no tienen sello: para
  ellas sigue rigiendo la deducción por id/título (o corrección manual).
- `2026-10-18 · @AI-agent · #feature-matching-casa · Principio: O, D · Justificación:` se REFuerza la
  decisión del matcher tomada en `#bugfix-matching` (subconjunto de tokens) retirando su regla (2)
  "comparten el token NÚCLEO ⇒ match": el propio core-token volvía a fabricar falsos positivos de
  la misma familia que arrancó el módulo — con "Lomo ibérico" en la despensa, planner/innovations/
  recipe-missing consideraban que ya tenías "Lomos de bacalao", "Lomo de atún", "Lomo cerdo entero",
  "Lomos de merluza"… (bug reportado por el usuario: el alimento aparecía como disponible para
  recetas que no lo piden). El conector queda SÓLO en subconjunto bidireccional: el género genérico
  cubre al específico ("Vino" ↔ "Vino blanco", "Tomate" ↔ "Tomates triturados", "Queso" ↔
  "Queso rallado" siguen ok) pero dos ESPECÍFICOS distintos ya no se casan por el primer token
  ("Queso azul" ≠ "Queso rallado"; "Lomo de cerdo" ≠ "Lomo salado"). Cambio semántico asumido:
  la despensa es más honesta y las sugerencias pueden exigir el ingrediente específico en la
  lista de la compra; tests de matching actualizados a ambos lados + suite completa verde.
- `2026-10-18 · @AI-agent · #epic-download-web-like-app-from-browser · Principio: O · Justificación:`
  la webapp se hace INSTALABLE como app (PWA) sin cambiar ningún framework ni añadir build: NO se pasa
  a React — una web estática es el caso ideal y sólo faltaba el embalaje. Se añaden ficheros nuevos
  `manifest.webmanifest` + `sw.js` + `icons/` (192/512 derivados del logo) y tres líneas en el head de
  `index.html` (manifest, theme-color, apple-touch-icon) con el registro del service worker GUARDADO a
  contexto seguro (`http(s)`; en `file://` no hay SW y la app estática sigue funcionando idéntica). El
  SW es cache-primero del app-shell (26 recursos) con red de respaldo y cache versionado `mrcheff-v1`
  (+1 para refrescar a los instalados). Contrato nuevo IMPLÍCITO que conviene no olvidar: el flujo
  "⋮ → Instalar aplicación" de Android exige manifest + SW + **https** — por `file://` o LAN-http el
  navegador no lo oferta (por eso los e2e documentan las 2 vías de prueba real: GitHub Pages/Netlify
  Drop, o localhost en el Mac). Verificado con Brave real servido en 127.0.0.1: SW activado, cache
  completo (13 módulos), recarga offline viva (`e2e/pwa-instalable.mjs`, 9 checks); suite 291/291 intacta.
- `2026-10-18 · @AI-agent · #tasks-analisis-texto-recetas · Principio: O · Justificación:` el análisis
  del texto libre de "Crear receta" (módulo puro `recipe-analysis.js`, sin red) perdía contenido que el
  usuario escribió a mano: (1) toda palabra inicial en MAYÚSCULA se cortaba en el tokenizador ("Tortilla"
  → "ortilla") — el split es `[^a-z0-9]+` y strip no minúscula: ahora se minúscula ANTES; (2) nombres sin
  diccionario ("harina", "chirla", "wakame"…) desaparecían salvo inventario: nuevo FALLBACK DE CANTIDADES
  que captura el nombre de fragmentos con cifra/medida ("200 gramos de harina", "un puñado de chirlas")
  con filtros anti-basura (no arranca por verbo, no es cláusula temporal, sin palabras de tiempo/recipiente);
  (3) el patrón DID NOT MAYUSCIZE: compuestos con "de" interno ya se conservan ("Pementón dulce" — y
  el diccionario se amplía con básicos: patata, agua, harina, vino, perejil, pescado blanco, frutos secos…);
  (4) imperativos irregulares ("Bate", "Fríe", "Cuece", "Vierte"…) no reconocidos por la raíz de 4 letras
  se añaden como tokens EXACTOS; (5) el recorte por COMAS + anclaje de frases SIN verbo: colas temporales
  ("a fuego medio durante 3 minutos") van al paso ANTERIOR y las introductorias ("Cuando la cebolla esté
  dorada") al SIGUIENTE — antes se descartaban ambas; y los compuestos subsumen al simple capturado en la
  MISMA pieza ("Pimentón dulce" sustituye "Pimentón", en su sitio — el 1º pone título), mientras que en
  piezas distinas son 2 alimentos ("tomate" + "tomate triturado"). Contrato público intacto
  (`analyzeRecipe(texto, {meal, pantry}) → {title, ingredients, method, possible}`); tope de pasos 10 → 16;
  trampas documentadas: los patrones de cifra/medida/ruido comparan en GRAFÍA STRIP ("puñado"→"punado",
  "sartén"→"sarten") porque NFD deshace la Ñ; se evita dict con participios ambiguos ("dorada"). Spec
  ampliada (19 tests) + suite verde 291/291 + e2e Brave real (`e2e/analisis-texto.mjs`).
- `2026-10-18 · @AI-agent · #feature-front-end-a11y · Principio: O · Justificación:` la accesibilidad
  de la webapp se eleva sin rediseñar la identidad ("La cocina tranquila"): la barra de vistas DEJA el
  patrón `role="tablist/tab"` incompleto (sin tabpanels ni gestión de flechas, tal como estaba era un
  patrón ARIA mal aplicado) y pasa a navegación honesta de botones con `aria-current="true"`; el modal
  es `role="dialog" aria-modal` con nombre accesible dinámico, el foco entra al abrir y VUELVE al
  control que lo abrió al cerrar; tarjetas y filas que abren detalle con click ganan teclado
  (`tabindex` + Enter/Espacio vía helper de vista `activablePorTeclado`); todos los botones de icono
  (✏️ 🍳 🗑 ⭐ ➕ ➖ 🍳) y campos sin label visible llevan `aria-label`; el toast es `role="status"
  aria-live="polite"`; inputs con indicador de foco por halo + fallback `@media (prefers-contrast: more)`
  (su `outline: none` anulaba el anillo global). Sin lógica nueva de dominio: es glue de vista en
  `app.js` + atributos/CSS; verificada con Brave real (`e2e/a11y-brave.mjs`, 16 checks) y suite verde.
- `2026-10-18 · @AI-agent · #tasks-menu-cocinar-aprobado · Principio: O, D · Justificación:` añade la
  7ª función pública a `menu-semanal.js` (`accionesMenuSlot`) para poder pintar el botón "🍳 Cocinar"
  de las filas del menú SÓLO en planes APROBADOS (el preview no compromete nada que pueda entrar en
  cooldown, y cocinar desde él escribiría `mrcheff.cooked` de un plan que se puede regenerar sin más).
  La regla es de negocio, no de vista: la decide el módulo y `app.js` sólo moldea. Dos costes
  asumidos: (1) el handler de "Generar" ahora asienta el preview ANTES de renderizar las filas
  (antes el orden daba igual porque los botones eran incondicionales) y (2) "Aprobar plan" re-renderiza
  las filas para que el botón aparezca. Afecta SÓLO al menú semanal: el "🍳" de tarjetas Recetas y del
  modal de detalle sigue siendo incondicional.
- `2026-10-18 · @AI-agent · #feature-compra-pregunta · Principio: O, D · Justificación:` la lista de
  la compra "colaba" el alimento marcado como comprado con qty=0/min=0/score=5 sin preguntar nada.
  `menu-semanal.markItemBought` amplía contrato con un 6º parámetro OPCIONAL `compra = { qty, score, min }`
  (las 5 llamadas legacy sin él conservan el comportamiento anterior, por lo que el cambio es no
  rompiente). Con `compra`: alta con la cantidad/importancia/MÍNIMO-de-alerta pedidos y — cuando el
  alimento YA está en la despensa aunque sea con qty 0 — UPDATE en-situ de qty/score/min (sin `min`
  pedido conserva el suyo) + se quita de `needyFoods` (antes
  el "ya está" no tocaba nada y el ítem no se cruzaba nunca del plan). El resultado devuelve además
  el campo `actualizado` para distinguir alta/update en el toast de la UI; `compra` se sanitiza en
  el módulo (qty entera ≥1, score 1–10) para que la UI no pueda colar basura.
- `2026-10-19 · @AI-agent · #tasks-viewpager-tab-activo-visible · Principio: O · Justificación:`
  el viewpager API "CERRADA (2 funciones)" de `modules/swipe-tabs.js` se amplía con la 3ª función
  pública `scrollIzquierdaParaTab(ctx) → scrollLeft`: al llegar por swipe a las vistas de la
  derecha (p. ej. Temporada) el tab activo quedaba FUERA de la ventana visible del nav (scroller-x
  interno invisible — 638px de contenido en 358px visibles, 0px del pill en pantalla), así que el
  usuario veía en el header aún las primeras dos pills. La decisión (centrar + fijar a [0, máximo]
  con métricas raras normalizadas a 0) vive en el módulo puro; `app.js` sólo mide DOM (rects +
  scrollLeft) y hace el `scrollTo` — coordinado viewpager-header: tabs y vista se mueven EN
  CONJUNTO, como pidió el producto. Spec extendida (5 tests nuevos) + e2e Brave (`e2e/swipe-vistas.mjs`).
- `2026-10-19 · @AI-agent · #bugfix-pwa-no-refresca-cambios · Principio: O · Justificación:`
  la entrega de releases dependía de un ritual manual: SUBIR +1 el nombre del caché del
  sw.js a mano en cada deploy. No se hizo en las dos últimas releases y el sw.js iba
  byte-idéntico (la v2 sin tocar desde `4ec8456`) ⇒ el navegador no re-instalaba el worker,
  el `addAll` del install no se repetía y el caché servía los ASSETS de la primera
  instalación para siempre (el índice network-first llegaba fresco, pero ningún css/js/
  módulo: "la PWA no se actualiza" pese a ver la web y Pages al día — deploy confirmado
  byte-a-byte con curl). Las variantes con `?v=N` tampoco valían: el matcher del caché
  ignoraba la query (ignoreSearch). Se pasa a entrega NETWORK-FIRST con revalidación para
  índice Y assets (`fetch(req, {cache:"no-cache"})`): el caché queda como respaldo offline,
  repoblado en cada acierto de red; la revisión del worker SALTA la caché HTTP
  (`updateViaCache:"none"` + `reg.update()` al entrar/al primer plano/cada 10 min por el
  max-age=600 de Pages) y un worker nuevo que toma el mando recarga la página UNA vez por
  sesión (controllerchange + guard en sessionStorage). El nombre del caché deja de ser la
  llave de la frescura: +1 sólo si cambia la lista SHELL o la estrategia. Afecta SÓLO a
  `sw.js` + su registro (sin shapes de §5 — suite 307 tests verde) y estrena guardia
  externa `e2e/pwa-entrega.mjs` (6 checks con servidor mutable).
- `2026-10-19 · @AI-agent · #feature-sync-buzon · Principio: O, D · Justificación:` sincronización de
  2 dispositivos vía gesto + gist de GitHub con cifrado extremo a extremo (plan completo en
  `webapp/e2e/plan-sync-buzon.md`, 6 fases branch+merge). Cambios de contrato y desviaciones trazadas:
  1. **Payload backup v2** (§1 del plan): `buildBackup`/`mergeIncoming` (`modules/backup.js`) añaden
     `version: 2` con `cooked` y `weekmenu`; el import v1 sigue funcionando sin esas claves (no rompiente,
     probado en `tests/merge-identidad.test.js`). Recetas con `uid` PRESERVADO al importar + dedup por
     fingerprint de ingredientes (`claveIngredientes`, réplica literal de la mecánica Jaccard-1.0 del
     hard-exclude) — precedent §8 del feature "matching-casa", duplicado A PROPÓSITO en backup/diff-merge
     para mantener los módulos puros independientes.
  2. **`editedAt`**: rutas de guardado/edición (`recipe-editor.applyEdit` por deps + guardado ⭐/✏️ de
     app.js) añaden el campo ISO cuando tocan una receta — ancla del fallback LWW del primer sync.
  3. **`sync.ejecutar`** amplía su resultado de rama "conflictos" con `estadoProvisional` + `avisos`
     (necesarios para reconstruir el estado final tras el modal — cruzar `continuarTrasConflictos`).
  4. **Desviación §3 literal del plan, trazada en la cabecera de sync.js**: al publicar un ACK se limpia
     la marca "offer pendiente" propia (`almacen.escribir("pendiente", null)`); el ACK full-snapshot
     SUSTITUYE a la offer y el bucle converge sin vaivén de ACKs idénticos ("convergecidoYa" evita el
     ACK que no aporta). weekmenu fusiona por **LWW `generatedOn`** y foods/cooked/innovations por
     **unión idempotente (gana local)** — sin diff3 fino, decisión §8 propia de esta release.
  5. **`merge3` (modules/diff-merge.js, FASE 4)** recetas por identidad id → fingerprint (gemelos LEGACY
     con uids distintos comparten columna, gana el uid LOCAL como canónico); escalares diff3 canónico
     con base / LWW `editedAt` sin base (aviso NO bloqueante — la perdedora NO se descarta, viaja al
     resolver); `editedAt` es ANCLA del LWW y nunca campo en disputa (0 avisos/conflictos propios);
     listas por listDiff3-LCS a mano (CERO dependencias) — sin base, unión literal del plan §4.
  6. **Ubicación de specs de integración:** `tests/*.integration.test.js` (Jest real) en lugar de los
     `e2e/*.spec.js` que el plan §7 pedía — los stubs de e2e/ son dead-code que Jest NO ejecuta
     (`roots` de jest.config.js); los stubs se mantienen SÓLO como trazabilidad del flujo real
     (sync-protocol.spec.js / sync-ui.spec.js) + `e2e/sync-buzon.mjs` para la verificación manual con
     token de entorno (MCHEFF_TOKEN/MCHEFF_GIST, NUNCA hardcodeados).
  7. **Inyecciones de test de boot.js y contextos** (§6): `bootApp({cryptoImpl})` expone
     `window.__mrcheffCryptoImpl` (jsdom no trae `.subtle`) y re-aprovecha TextEncoder/TextDecoder de
     Node (jsdom no los implementa — navegadores sí); `mrcheff.sync.iteraciones` en localStorage baja el
     coste de PBKDF2 en suite (los parámetros viajan en el header de la envolvente, así que es libre).
  8. **Caché v4 del sw.js** con los 3 módulos del sync en SHELL (§7 del plan) — la entrega ya era
     network-first, pero el respaldo offline debe precachear los ficheros nuevos.
  Suite al cierre: **382 tests / 27 suites verdes** (global 93.24/81.90); cobertura de los módulos
  nuevos ≥ 91/80. Verificación de 2 dispositivos + gist real queda manual (`e2e/sync-buzon.mjs`,
  checklists §8 del plan) — no ejecutable en CI.
  9. **"🛒 Despensa?"** (2026-10-19): el matcher anti-falsos-positivos (2026-10-18) dejó FUERA los
     matches por subconjunto que unían variantes del mismo alimento ("Jamón serrano" ↔ "Jamón
     ibérico") — correcto para el aforo, pero la lista de la compra necesitaba reconocerlas. En vez
     de heurísticas de "calidad/tipo" (meten más casos raros de los que resuelven), regla simple de
     candidatos (`menuSemanal.candidatosDespensa`: token común del matcher, sin match total) y la
     decisión SIEMPRE en el usuario vía modal de confirmación; `markItemBoughtComo` amplía el
     contrato de menu-semanal a 9 funciones públicas (compra IN-SITU al alimento elegido, sin alta
     nueva). Tests: unitarios en menu-semanal.test.js + integración en
     despensa-candidatos.integration.test.js.
   10. **Memoria de scroll por vista del viewpager** (2026-10-20): API pública de swipe-tabs
      ampliada a 7 funciones (`crearMemoriaScroll`/`recordarScroll`/`scrollParaVista`, objeto
      memoria puro sin DOM; default SIEMPRE arriba). El behavior de scroll NO es estado del
      módulo: app.js·activarVista(view, origen) captura la vista saliente (ANTES de tocar las
      clases: el alto del documento cambia al ocultarse la vista) y aplica swipe=restaurar
      instantáneo (sujeto al alto scrolleable real) / click=subida animada ({top:0,
      behavior:"smooth"}, con reduce-motion a "auto" y fallback para WebViews sin options).
      Trazas de harnés registradas: jsdom NO implementa window.scrollTo → boot.js trae sustituto
      propio (licencia §6: aplica el resultado final sin el flag "Not implemented"); y el
      page.click(selector) de Playwright hace scrollIntoViewIfNeeded y MUEVE el scroll del
      documento antes del gesto — el e2e clica con page.mouse+coords y SOLO tabs SIEMPRE
      visibles (la 5ª pill queda fuera del scroller del header en 390px). Tests: unitarios en
      swipe-tabs.test.js + integración en viewpager-scroll.integration.test.js + e2e real en
      e2e/scroll-vistas.mjs.
   11. **Match por prefijo en el buscador del catálogo** (2026-10-20, petición "menos letras,
      como el buscador de alimentos"): `busquedaRecetas.buscar` casaba SOLO token exacto y exigía
      reescribir la palabra entera ("croqu" no encontraba Croquetas). Ahora el token dicho casa
      EXACTO preferente y, a falta de exacto, con cualquier token del campo que EMPIECE por él;
      pesos título exacto 3 / título prefijo 2 / ingrediente 1 — la afinidad real sigue mandando.
      El mínimo de 3 letras lo fija ya el matcher compartido (TOKEN_MIN_LEN): nada de ruido
      prefijo de 1-2 letras. Firma de API SIN CAMBIO (1 función pública). Tests: unit en
      busqueda-recetas.test.js (describe 5) + e2e Brave real en e2e/buscador-prefijos.mjs.
   12. **Tutorial interactivo de entrada** (2026-10-20, epic `tutorial-interactivo`, 1 rama de
      tarea por pantalla: core + alimentos + recetas + innovación + menú + temporada; merge
      `--no-ff` a la épica, borrado de las ramas de tarea; el merge a develop lo hace el equipo
      tras revisar): guion PURO en `modules/tutorial.js` (pasos en grupos + máquina de sesión;
      `pasoValido` protege de pasos rotos; target inexistente degrada el paso a informativo =
      NUNCA se atasca) y wiring en app.js con dos decisiones registradas: (a) el VOCABULARIO de
      avance es bidireccional por diseño del feature — pasos ACCIONABLES avanzan tocando el
      elemento real vía listener de CAPTURA en document (sin stopPropagation: el gesto ejecuta
      su función de siempre: focus, generar lote, plan 7×3…) mientras los informativos usan el
      botón; (b) el overlay comió clicks del elemento real hasta descubrir en el e2e de Brave
      que el CONTENEDOR `.tutorial` (fixed a viewport entero) los interceptaba: regla nueva para
      overlays full-viewport — contenedor `pointer-events:none` y remate SOLO en hijos interactivos
      (velos `auto`, tarjeta `auto`, foco `none`). jsdom NO implementa `Element.scrollIntoView` →
      boot.js trae stub (§6, mismo espíritu que window.scrollTo) y app.js lleva doble guard
      try/catch para WebViews viejos sin options object. El auto-abre SOLO en contexto web
      instalable (protocolo http/https, con UA sin "jsdom" para no dispararlo en la capa 2 — el
      e2e lo prueba con servidor python http://localhost:8617). Tests: unit en tutorial.test.js
      (contrato, grupos por pantalla, sesión) + integración en tutorial-ui.integration.test.js
      (boot real, auto/X/Escape/Terminar/reabrir, guion INYECTADO en la ventana para desacoplar
      los flujos del contenido que crece por ramas, recorrido completo de 16 pasos) + e2e Brave
      en e2e/tutorial.mjs (20 checks). Suite al cerrar la épica: 470 tests / 33 suites.
