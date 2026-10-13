# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read this secondary rules
@.claude/rules/Accesibilidad.md

## What this is

**Mr Cheff** is a kitchen-assistant product. `Readme.html` describes the product vision
and badges it "Kotlin Multiplatform · Android · iOS", but **the only runnable code in this
repo is a vanilla-JS web prototype in `webapp/`**. There is no KMP/Android/iOS project, no
`package.json`, no Gradle, and no backend. Do not assume a native build target exists.

## Running / building / testing

- **Run**: open `webapp/index.html` directly in a browser. No server needed.
- **No build, no dependencies, no tests, no linter.** There is no command to build, lint,
  or run a single test — there is no test framework to invoke. "Verifying" a change means
  opening `index.html` in a browser and exercising the relevant tab.

## Architecture (the `webapp/` prototype)

A single-page, five-tab app. `index.html` loads scripts in this order (order matters):
`data.js` → `app.js`. `app.js` runs everything inside one `DOMContentLoaded` handler.

- `index.html` — static markup for all four views; views are toggled by adding/removing
  the `active` class on `.view` / `.tab` (a `data-view`/`view-${view}` convention).
- `app.js` — all logic. One IIFE-equivalent closure per feature, each section self-contained.
- `data.js` — static seasonal data. Exposes `window.MR_CHEFF_DATA = { MESES, TEMPORADA }`,
  which `app.js` reads. `app.js` depends on `data.js` having run first.
- `style.css` — hand-written CSS (no framework). CSS variables in `:root` drive the palette.

### The five views
1. **Alimentos (foods)** — home-inventory control.
2. **Recetas (recipes)** — turn a free-text description into a structured recipe.
3. **Innovación (innovation)** — invent new recipe "ideas" from what's in the pantry.
4. **Temporada (seasonal)** — which fruits/veg are in season for a month.
5. **Copia de seguridad (backup)** — cross-browser Export/Import (its own tab).

### Persistence — localStorage
State is persisted under these keys (see `LS` in `app.js`):
`mrcheff.foods`, `mrcheff.recipes`, `mrcheff.innov`, `mrcheff.innov.date`.
`load(key, default)` / `save(key, val)` are the only persistence helpers — use them, not
raw `localStorage`, so the default-fallback and JSON handling stay consistent.

- **Foods**: `{ id, name, score (1–10), qty, min, checked, createdAt }`. A food triggers a
  restock alert when `qty <= min` (see `needsRestock`). Urgency color derives from `score`
  via `urgencyLevel`: red 8–10, orange 6–7, green 1–5. The weekly alert shows the most
  urgent item's level and caps the list at 8.
- **Recipes**: `{ id, title, meal (desayuno|comida|cena), ingredients[], method[],
  createdAt }`. `source`, `from`, and `uses` fields appear on innovation-saved recipes.
- **Innovations** auto-expire: on load, if `mrcheff.innov.date` ≠ today's date, the
  `mrcheff.innov` list is wiped. The list is also capped at the most recent 30.

### Backup / restore (cross-browser)
`localStorage` is **per-browser** — data in one browser won't appear in another, and no local
DB (`IndexedDB`, `sql.js`/SQLite-WASM) shares across browsers either. Cross-browser transfer
is therefore done by **Export / Import** on its own **Copia de seguridad** tab/view (`buildBackup` / `applyBackup`
in `app.js`). Export builds a real-timestamp filename via `backupFilename()`
(`dataBackup-YYYY-MM-DD-HH-MM-SS.json` — the actual click time, not a literal string), then
downloads it as a `blob` + `a.download` into **Downloads**. An earlier `showSaveFilePicker`
(File System Access API) attempt was removed: opening `index.html` via `file://` left an
**empty** file and still fell through to the download, producing two dialogs. The separate
**📋 Copiar** button remains as a manual-copy fallback for browsers that won't download.
The payload is versioned `{ version, exportedAt, foods, recipes, innovations,
innovDate }`. Import reads it and **merges** into current data (foods de-duped by name,
recipes appended, innovations appended and re-capped to 30; imports are normalized + given
fresh `uid()`). Backups are meant to live in `dataBackup/` (project folder holding `README.md`
+ a sample `ejemplo.json`); a static page can't write to that folder by itself, so the user
moves the downloaded file into `dataBackup/` by hand (or copies it via 📋 Copiar).

### The "AI" is simulated — no LLM call
`simulateRecipe` (recipes) and the innovation generators (below) are **deterministic
heuristics, not a model**. The UI labels this "Modo simulado". If real LLM integration is
the intent, that is the place to replace the simulation — it is not hidden elsewhere.

Innovation ideas come from four generators dispatched by `generateInnovations(count, focus)`:
`makeVariation` (mutate a saved recipe), `makeCombo` (archetype + pantry), `makeFreeform`
(random pantry mix), `makeSolo` (one-ingredient focus). Each idea has a `source`
(`variacion|combo|libre|protagonista|nueva`) mapped to a label by `SOURCE_LABEL`.
Pantry classification is a keyword heuristic: `classifyFood` matches `FOOD_TYPES`
(proteína/lácteo/cereal/fruta/verdura/especias) in `TYPE_ORDER`, defaulting to `"otros"`.
The `focus` filter chooses which generators run: `"nuevas"` runs only variations;
`"variaciones"` runs the other three; `"todo"` runs all.

## Conventions and gotchas

- **Everything user-facing and every code comment is in Spanish.** Match that when editing
  UI text or comments.
- **Escape user content** with `escapeHTML` before inserting into innerHTML — user-supplied
  food names, recipe titles, and descriptions are rendered into the DOM. New rendered user
  fields must follow suit.
- **Food-type keywords in `data.js`/`FOOD_TYPES` are accent-stripped** via `norm`
  (NFD normalization) for matching, but the seasonal `TEMPORADA` `nombre` fields keep
  accents. Keep this distinction in mind when adding food types or seasonal items.
- `app.js` contains a **stale duplicated comment block** around line 247
  (`// ===== RECETAS =====` / `// ... (todo lo anterior...) ...`). It is a leftover from an
  edit, not real code — safe to delete.
