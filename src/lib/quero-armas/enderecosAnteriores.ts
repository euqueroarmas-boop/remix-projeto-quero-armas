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

/** Uma linha como ela vive em qa_cliente_enderecos_anteriores. */
export interface EnderecoAnteriorGravado extends EnderecoAnterior {
  id: string;
  /** 'cliente' = declarado; 'equipe' = lançado pelo escritório; 'sistema' =
   *  deduzido de uma mudança de estado no cadastro. */
  origem: string;
}

/**
 * Identidade da linha — o MESMO critério do índice único da tabela
 * (qa_cliente_id, uf, lower(btrim(coalesce(cidade,'')))). Errar aqui faz o
 * salvamento apagar a linha errada ou tentar inserir duplicata.
 */
export function chaveEnderecoAnterior(
  uf: string | null | undefined,
  cidade: string | null | undefined,
): string {
  return `${String(uf || "").trim().toUpperCase()}|${String(cidade || "").trim().toLowerCase()}`;
}

/**
 * O que gravar para a lista editada virar o estado do banco.
 *
 * Quando a resposta é "morou sempre no mesmo endereço", o que foi DECLARADO
 * sai e o que o próprio sistema registrou numa mudança de endereço real fica —
 * a mesma regra do gatilho que trata a resposta vinda do checklist. Mudança de
 * endereço é fato; declaração é o que a pessoa disse.
 */
export function diffEnderecosAnteriores(
  gravados: ReadonlyArray<EnderecoAnteriorGravado>,
  editados: ReadonlyArray<EnderecoAnterior>,
  moraSempreNoMesmoEndereco: boolean,
): { remover: string[]; inserir: EnderecoAnterior[] } {
  if (moraSempreNoMesmoEndereco) {
    return {
      remover: gravados.filter((l) => l.origem === "cliente").map((l) => l.id),
      inserir: [],
    };
  }

  const antes = new Map(gravados.map((l) => [chaveEnderecoAnterior(l.uf, l.cidade), l]));
  const agora = new Map(
    editados
      .filter((l) => String(l.uf || "").trim())
      .map((l) => [chaveEnderecoAnterior(l.uf, l.cidade), l]),
  );

  return {
    remover: [...antes.entries()].filter(([k]) => !agora.has(k)).map(([, l]) => l.id),
    inserir: [...agora.entries()]
      .filter(([k]) => !antes.has(k))
      .map(([, l]) => ({
        uf: String(l.uf).trim().toUpperCase().slice(0, 2),
        cidade: String(l.cidade || "").trim(),
      })),
  };
}
