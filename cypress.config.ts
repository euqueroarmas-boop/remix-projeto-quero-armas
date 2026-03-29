import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "https://dell-shine-solutions.lovable.app",
    supportFile: "cypress/support/e2e.ts",
    specPattern: "cypress/e2e/**/*.cy.{ts,tsx}",
    viewportWidth: 1280,
    viewportHeight: 720,
    video: false,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
  },
});
