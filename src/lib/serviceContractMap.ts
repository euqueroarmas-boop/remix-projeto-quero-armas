/**
 * Mapa de objetos contratuais por slug de serviço.
 * 
 * REFATORADO: Agora usa o WMTi Scope Engine como source of truth.
 * A função generateObjectClause gera automaticamente a cláusula do contrato
 * a partir do escopo estruturado do serviço.
 */

import { getServiceScopeBySlug, generateObjectClause } from "@/data/serviceScopes";

/**
 * Retorna o objeto contratual específico para um slug de serviço.
 * Usa o Scope Engine quando disponível, fallback para texto genérico com alerta forte.
 */
export function getServiceContractObject(serviceSlug: string): string {
  const scope = getServiceScopeBySlug(serviceSlug);
  if (scope) {
    console.log(`[WMTi Scope Engine] Contract clause loaded from scope: ${serviceSlug}`);
    return generateObjectClause(scope);
  }

  console.error(`[WMTi Scope Engine] ⚠️ CRITICAL: No scope found for "${serviceSlug}" — fallback contratual ativo. CORRIGIR IMEDIATAMENTE: adicionar escopo em serviceScopes.ts`);
  console.error(`[WMTi Scope Engine] ⚠️ MISMATCH_ALERT: Contrato gerado sem escopo estruturado para "${serviceSlug}"`);
  // Fallback seguro — nunca deixar o campo vazio, mas alertar fortemente
  return `Os serviços de T.I. objeto deste contrato serão aqueles especificamente definidos no momento da contratação, conforme escopo acordado entre as partes. O escopo limita-se exclusivamente aos serviços expressamente contratados, não abrangendo demandas extraordinárias, projetos, implantações, migrações, aquisições de infraestrutura ou quaisquer serviços não expressamente previstos.`;
}

/**
 * Validates that a service has a complete scope before allowing checkout.
 * Returns the scope if valid, throws if not (blocking operation).
 */
export function requireServiceScope(serviceSlug: string) {
  const scope = getServiceScopeBySlug(serviceSlug);
  if (!scope) {
    const msg = `[WMTi Scope Engine] Service scope incomplete — operation blocked for: "${serviceSlug}"`;
    console.error(msg);
    throw new Error(msg);
  }
  console.log(`[WMTi Scope Engine] Scope validated for checkout: ${serviceSlug}`);
  return scope;
}
