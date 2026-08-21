// ============================================================================
// enderecosAnteriores.ts
// ----------------------------------------------------------------------------
// A régua dos estados onde o cliente morou nos últimos 5 anos.
//
// O SINARM CAC e o SIGMA exigem certidão de antecedentes de CADA estado de
// residência no período. No fim, só o ESTADO importa: quem morou em três
// cidades de São Paulo entrega as certidões de São Paulo uma vez só. A cidade
// fica como registro, para a conferência do dossiê.
//
// Espelho TypeScript do que qa_seed_certidoes_estados_anteriores faz no banco
// (migration 20260821080000).
// ============================================================================
import { UFS_BR } from "@/lib/quero-armas/localidadesBr";

export interface EnderecoAnterior {
  uf: string;
  cidade: string;
}

/**
 * Estados distintos e reconhecidos — é o que vira bloco de certidões.
 * O estado onde o cliente mora HOJE fica de fora: as certidões dele já são
 * pedidas no bloco do estado atual.
 */
export function estadosDistintos(
  lista: ReadonlyArray<EnderecoAnterior>,
  ufAtual?: string | null,
): string[] {
  const atual = String(ufAtual || "").trim().toUpperCase();
  const validas = new Set(UFS_BR.map((u) => u.sigla));
  const vistos: string[] = [];
  for (const item of lista) {
    const uf = String(item?.uf || "").trim().toUpperCase();
    if (!uf || !validas.has(uf)) continue;
    if (uf === atual) continue;
    if (!vistos.includes(uf)) vistos.push(uf);
  }
  return vistos.sort();
}
