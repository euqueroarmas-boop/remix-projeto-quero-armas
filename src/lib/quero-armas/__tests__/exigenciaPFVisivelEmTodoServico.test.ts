// ============================================================================
// Toda exigência da Polícia Federal aparece para o cliente, em TODO serviço.
// ----------------------------------------------------------------------------
// O popup guiado filtra pendências por grupo, com um whitelist por serviço
// (`servicoGruposConfig`). Quando a PF notifica, `qa-manifestacao-analisar`
// cria a exigência com `regra_validacao.grupo_checklist = "exigencias_pf"` —
// mas o filtro classificava a linha pelo `tipo_documento`, e não pelo grupo
// gravado nela.
//
// Resultado medido em 18/08/2026, antes da correção: na Posse, 6 dos 30 tipos
// do cardápio da PF ficavam INVISÍVEIS para o cliente (declaracao_homonimia,
// craf, declaracao_endereco_acervo, declaracao_guarda_responsavel,
// dsa_declaracao_seguranca_acervo, comprovante_filiacao_entidade_tiro). A
// exigência continuava contando como pendência no motor de conclusão, então o
// processo travava para sempre — com prazo fatal de 10 dias correndo e sem
// alerta nenhum.
//
// Este teste varre o produto cartesiano serviço × cardápio da PF. Serviço novo
// que entre no whitelist sem `exigencias_pf` quebra aqui.
// ============================================================================

import { describe, it, expect } from "vitest";
import { TIPOS_EXIGENCIA_PF } from "../exigenciasPFTipos";
import { grupoDaPendencia, grupoDaPendenciaDoItem, GRUPOS_NAO_FILTRAVEIS } from "../pendenciasGrupos";
import { gruposPermitidosPorServico } from "../servicoGruposConfig";

/** Serviços que hoje possuem whitelist declarada. */
const SLUGS_COM_WHITELIST = [
  "posse-arma-fogo",
  "posse-de-arma-de-fogo",
  "aquisicao-registro-posse-de-arma-de-fogo",
  "renovacao-posse-de-arma-de-fogo",
  "porte-arma-fogo",
  "renovacao-de-porte-de-arma-de-fogo",
  "concessao-cr",
  "renovacao-cr",
  "registro-arma-fogo",
  "apostilamento-atualizacao",
  "registro-e-apostilamento-de-arma-de-fogo-cac",
  "autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac",
  "autorizacao-de-compra-de-arma-de-fogo-para-cacador-cac",
  "guia-de-trafego-especial-cac",
  "recurso-administrativo",
  "mandado-de-seguranca",
  "operador-de-pistola-nivel-i",
  "vip-operador-de-pistola-nivel-i",
];

/** Linha de checklist como `qa-manifestacao-analisar` a grava. */
function exigenciaDaPF(tipo: string) {
  return {
    tipo_documento: tipo,
    obrigatorio: true,
    status: "pendente",
    regra_validacao: { grupo_checklist: "exigencias_pf", origem: "manifestacao_pf" },
  };
}

describe("exigência da PF nunca é escondida do cliente", () => {
  it("os 18 serviços com whitelist declarada existem de fato", () => {
    for (const slug of SLUGS_COM_WHITELIST) {
      expect(gruposPermitidosPorServico(slug), `whitelist sumiu: ${slug}`).not.toBeNull();
    }
  });

  it("todo tipo do cardápio da PF fica visível em todo serviço com whitelist", () => {
    const ocultos: string[] = [];
    for (const slug of SLUGS_COM_WHITELIST) {
      const permitidos = gruposPermitidosPorServico(slug)!;
      for (const t of TIPOS_EXIGENCIA_PF) {
        const grupo = grupoDaPendenciaDoItem(exigenciaDaPF(t.tipo)).id;
        if (!permitidos.has(grupo)) ocultos.push(`${slug} :: ${t.tipo} (grupo=${grupo})`);
      }
    }
    expect(ocultos, `exigências da PF escondidas do cliente:\n${ocultos.join("\n")}`).toEqual([]);
  });

  it("exigência da PF cai no grupo exigencias_pf, que tem prioridade máxima", () => {
    const g = grupoDaPendenciaDoItem(exigenciaDaPF("craf"));
    expect(g.id).toBe("exigencias_pf");
    expect(g.ordem).toBe(5);
  });

  it("sem o grupo explícito, a classificação por tipo continua valendo", () => {
    expect(grupoDaPendenciaDoItem({ tipo_documento: "craf" }).id)
      .toBe(grupoDaPendencia("craf", null).id);
  });

  it("declaração de homonímia é idoneidade, não declaração genérica", () => {
    // Ela existe porque apareceu xará na certidão criminal. Cair em
    // `declaracoes` a escondia em todo serviço sem esse grupo no whitelist.
    expect(grupoDaPendencia("declaracao_homonimia", null).id).toBe("antecedentes");
  });

  it("todo whitelist declara os grupos não filtráveis", () => {
    for (const slug of SLUGS_COM_WHITELIST) {
      const permitidos = gruposPermitidosPorServico(slug)!;
      for (const g of GRUPOS_NAO_FILTRAVEIS) {
        expect(permitidos.has(g), `${slug} não permite ${g}`).toBe(true);
      }
    }
  });

  it("serviço fora do mapa continua sem filtro nenhum", () => {
    expect(gruposPermitidosPorServico("servico-que-nao-existe")).toBeNull();
    expect(gruposPermitidosPorServico(null)).toBeNull();
  });
});
