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
 * Usa o Scope Engine quando disponível, fallback para texto genérico.
 */
export function getServiceContractObject(serviceSlug: string): string {
  const scope = getServiceScopeBySlug(serviceSlug);
  if (scope) {
    console.log(`[WMTi Scope Engine] Contract clause loaded from scope: ${serviceSlug}`);
    return generateObjectClause(scope);
  }

  console.warn(`[WMTi Scope Engine] No scope found for "${serviceSlug}" — using fallback`);
  // Fallback seguro — nunca deixar o campo vazio
  return `Os serviços de T.I. objeto deste contrato serão aqueles especificamente definidos no momento da contratação, conforme escopo acordado entre as partes. O escopo limita-se exclusivamente aos serviços expressamente contratados, não abrangendo demandas extraordinárias, projetos, implantações, migrações, aquisições de infraestrutura ou quaisquer serviços não expressamente previstos.`;
}
