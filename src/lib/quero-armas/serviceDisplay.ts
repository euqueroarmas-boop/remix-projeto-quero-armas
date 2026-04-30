export type QAServiceIdentity = {
  service_slug?: string | null;
  servico_id?: number | null;
  servico_nome?: string | null;
  nome?: string | null;
};

export function getQAServiceDisplayName(service: QAServiceIdentity | null | undefined): string | null {
  const slug = service?.service_slug?.trim();

  if (slug === "porte-arma-fogo") return "Porte de arma de fogo";
  if (slug === "posse-arma-fogo") return "Posse de arma de fogo";

  if (!slug) return service?.servico_nome || service?.nome || null;

  return service?.nome || service?.servico_nome || null;
}