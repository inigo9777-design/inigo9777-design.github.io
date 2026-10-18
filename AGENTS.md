# AGENTS.md — Mr Cheff

Compact guide for AI agents, now the single canonical in-repo reference (its former sibling, the stale `CLAUDE.md`, was folded into it and removed). For product vision read `Readme.html`; team coding/testing standards live in `CODING_STANDARDS.md`, referenced below. When docs and code disagree, **trust this file + the code**.

## What this actually is
- A kitchen-assistant prototype. `Readme.html` badges it "Kotlin Multiplatform · Android · iOS",
  but the **only runnable code is a vanilla-JS static web app in `webapp/`**. There is **no KMP,
  no Gradle, no native target, and no backend** — do not assume one exists or try to build it.
- Repo boundary: this folder (`Mr Cheff`, the dir with `.git`) *is* the repository. The parent dir
  `IA LOCAL/` also contains an unrelated `Scripts-Utilities/` shell script — leave it alone.

## Commands (run from `webapp/` unless noted)
- **Run:** open `webapp/index.html` in a browser. No server or build step needed for the app.
  There is no linter/formatter/typecheck for the app itself; "verify a change" = open index.html
  and exercise the affected tab.
- **Tests:** `cd webapp && npm test` (`jest`) / `npm run coverage` (`jest --coverage`). Jest IS a
  declared devDependency with installed `node_modules/`. Spec files now **do** exist under
  `webapp/tests/` — one per module so far: `classify.test.js`, `priority.test.js`, `recipe-analysis.test.js`,
  `innovations.test.js`, plus harness scaffolding (`boot.js` / `setup.js`). As of the last run on 2026-10-16,
  the whole suite is green (`4 passed / 60 tests total`) — verify with a fresh run before trusting it: **logic
- Note: there is **no `.gitignore`** and `webapp/node_modules/` is **untracked** — never `git add -A`
  it. `dataBackup/*.json` backups *are* tracked.

## Architecture (`webapp/`)
Single-page, five-tab app loaded via `index.html`, in this order (order matters): inline `<script>`
→ `data.js` → `app.js`. All logic lives inside one `DOMContentLoaded` closure in `app.js`, sectioned
by `// ===== SECTION =====` banners. Files:

- **data.js** — static seasonal data; exposes `window.MR_CHEFF_DATA = { MESES, TEMPORADA }`. `app.js`
  depends on this having run first (keep the script order).
- **app.js** — everything else, sectioned by banner.
- **style.css** — hand-written CSS (no framework); desde 2026-10-18 es un **sistema tokenizado**: todo color
  vive en `:root` (claro) / `[data-theme="dark"]` (oscuro), **ningún componente usa hex sueltos**; añadir un
  color nuevo = añadir token en ambos temas (con `color-scheme` nativo por tema). Tipografía: Georgia (serif
  editorial) para títulos/marca + sans del sistema para UI. [Light theme bug histórico: un texto basura fuera de
  comentario en la línea 2 (`Apply`) invalidaba el bloque `:root` entero del modo claro — parser CSS lo engulle
  como selector; mantener el fichero sin tokens basura fuera de comentario].

Views: **Alimentos** (pantry/restock alerts) · **Recetas** (free-text → structured recipe) ·
**Innovación** (invent recipes from the pantry) · **Temporada** (in-season fruit/veg by month) ·
**Copia de seguridad** (cross-browser Export/Import — its own tab).

- New module **`webapp/modules/recetas-espanolas.data.js`** (IIFE + dual-export identical to `classify.js`/`priority.js`,
  loaded before `innovations.js`) holds a curated catalog of real, plausible everyday Spanish recipes. Each record is minimal:
  `{ id, title, meal: "desayuno"|"comida"|"cena", ingredients[], method[] }`.
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
- Lista de la compra (Card 3): dedup por el matcher de tokens (`modules/ingredient-matching.js`,
  NO lower-case exacto) contra comida real (qty>0), y semáforo dinámico por fecha de preparación
  (`onDay`/`daysUntil`/`urgency`): hoy/mañana=rojo, 2–3 días=naranja, ≥4 días (o sin fecha)=verde;
  orden salida rojo→verde.
- Foods: restock alert when `qty <= min`; urgency color from `score` (1–10) via `urgencyLevel` —
  red 8–10, orange 6–7, green 1–5; weekly alert caps the list at 8.
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
- **Accent handling differs by context:** pantry food-type matching strips accents via `norm` (NFD +
  combining-mark strip) in `FOOD_TYPES`/`TYPE_ORDER`; the seasonal `TEMPORADA` `nombre` fields keep
  their accents. Mind this when adding foods or seasonal items.

## Other instruction / config sources worth knowing
- **`CODING_STANDARDS.md`** (repo root, canonical) — the team's coding/testing standards going forward: SOLID, per-feature modular architecture mandate
  (`modules/domain|infra|views`; `app.js` stays the legacy composition-root), and mandatory unit testing. **Follow it.**
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
