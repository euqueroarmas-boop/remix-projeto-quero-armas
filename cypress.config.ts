import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "https://dell-shine-solutions.lovable.app",
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.{ts,tsx}",
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    videoCompression: 32,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    reporter: "mochawesome",
    reporterOptions: {
      reportDir: "cypress/results",
      overwrite: false,
      html: false,
      json: true,
      quiet: true,
    },
  },
});
