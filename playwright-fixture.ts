// Re-export Playwright primitives. Mantido como ponto único de import para os
// specs do projeto. Caso seja preciso estender com fixtures customizadas
// (auditReporter, seedDeUsuário etc.), faça aqui — não nos specs.
export { test, expect } from "@playwright/test";
