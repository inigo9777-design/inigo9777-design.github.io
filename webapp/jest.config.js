/** Jest configuration for Mr Cheff webapp.
 *  The app is plain browser JS (no build step, no modules). We load index.html +
 *  data.js + app.js into jsdom and exercise the real code paths via DOM events. */
module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/tests"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  collectCoverageFrom: [
    "<rootDir>/app.js",
    "<rootDir>/data/data.js",
    "<rootDir>/modules/classify.js",
    "<rootDir>/modules/innovations.js",
    "<rootDir>/modules/priority.js",
    "<rootDir>/modules/recipe-analysis.js",
    "<rootDir>/modules/backup.js",
    "<rootDir>/modules/util.js",
    "<rootDir>/modules/planner.js",
    "<rootDir>/modules/menu-semanal.js",
    "<rootDir>/modules/recipe-missing.js",
    "<rootDir>/modules/ingredient-matching.js",
    "<rootDir>/modules/recipe-editor.js",
    "<rootDir>/modules/origen-recetas.js",
    "<rootDir>/modules/busqueda-recetas.js",
    "<rootDir>/modules/swipe-tabs.js",
    "<rootDir>/modules/sync-crypto.js",
    "<rootDir>/modules/sync.js",
    "<rootDir>/modules/diff-merge.js",
    "<rootDir>/modules/tutorial.js",
    "<rootDir>/modules/ocr-despensa.js",
    "<rootDir>/modules/ocr-foto.js",
    "<rootDir>/modules/ocr-ticket-parser.js",
    "<rootDir>/modules/categoria-producto.js",
    "<rootDir>/modules/fotos-recetas.js",
    "<rootDir>/views/*.js"
  ],
  coverageThreshold: {
    global: { statements: 70, branches: 65, functions: 70, lines: 70 }
  },
  testMatch: ["**/*.test.js"]
};
