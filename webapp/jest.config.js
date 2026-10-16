/** Jest configuration for Mr Cheff webapp.
 *  The app is plain browser JS (no build step, no modules). We load index.html +
 *  data.js + app.js into jsdom and exercise the real code paths via DOM events. */
module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/tests"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.js"],
  collectCoverageFrom: [
    "<rootDir>/app.js",
    "<rootDir>/data/data.js"
  ],
  coverageThreshold: {
    global: { statements: 70, branches: 65, functions: 70, lines: 70 }
  },
  testMatch: ["**/*.test.js"]
};
