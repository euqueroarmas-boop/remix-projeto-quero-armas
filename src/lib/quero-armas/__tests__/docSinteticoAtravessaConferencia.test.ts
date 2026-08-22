// ============================================================================
// AS AMOSTRAS SINTÉTICAS ATRAVESSAM A CONFERÊNCIA COMO O DOCUMENTO DE VERDADE
// ----------------------------------------------------------------------------
// Pergunta que este teste responde: dá para exercitar o fluxo documental sem
// ter o documento do cliente? Dá — porque a conferência não olha o arquivo,
// olha o TEXTO extraído dele. O texto aqui vem do gerador de amostras
// (scripts/gerar-doc-teste.mjs), não do PDF de cliente nenhum.
//
// O teste tem dois trabalhos:
//   1. provar que a decisão que sai das amostras é a mesma que saiu no caso
//      real do Igor (22/08/2026), quando a CTPS foi lida como certidão cível;
//   2. amarrar as amostras às regras. Se alguém mexer na trava de escopo, as
//      iscas do gerador cobram o comportamento aqui, e não em produção.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { slotEsperaCertidao, detectarEscopoCertidao } from "../escopoCertidao";
import { mesmaExigenciaHolerite, mesmaExigenciaIdentidade } from "../identidadeUnica";
// @ts-expect-error — utilitário de linha de comando em JS puro, sem tipos.
import { MODELOS, GRUPOS, SERVICOS } from "../../../../scripts/gerar-doc-teste.mjs";

type Modelo = {
  grupo: string;
  titulo: string;
  slot: string;
  linhas?: string[];
  formato?: string;
  servicos: number[];
};
const CATALOGO = MODELOS as Record<string, Modelo>;

// ── O CATÁLOGO VIVO ─────────────────────────────────────────────────────────
// Export de qa_servicos_documentos tirado do banco em 22/08/2026. É a fonte da
// verdade: o repositório não é. Enquanto este arquivo não for atualizado, ele
// congela o que o banco dizia naquele dia — e é isso que o teste cobra.
const CSV = readFileSync(
  resolve(process.cwd(), "src/lib/quero-armas/__tests__/fixtures/catalogo-autorizacao-compra-20260822.csv"),
  "utf-8",
);

type LinhaCatalogo = { servicoId: number; tipo: string; formato: string; nome: string };

function linhasDoCatalogo(): LinhaCatalogo[] {
  return CSV.split("\n")
    .slice(1)
    .filter(Boolean)
    .map((linha) => {
      const col = linha.split(";");
      return {
        formato: col[2] ?? "",
        nome: col[3] ?? "",
        servicoId: Number(col[col.length - 2]),
        tipo: (col[col.length - 1] ?? "").trim(),
      };
    })
    .filter((r) => Boolean(r.tipo));
}

/**
 * Uma linha do checklist só é UPLOAD quando pede arquivo. Não são upload:
 *  - `pergunta_*`   — resposta do cliente, o portal desenha botões;
 *  - `*_definir`    — decisão que ramifica o checklist (condição profissional,
 *                     exames da instituição), também sem arquivo.
 * O nome é o critério, não o `formato_aceito`: veja o teste de anomalias
 * abaixo — há pergunta cadastrada com formato de PDF no catálogo vivo.
 */
function ehUpload(r: LinhaCatalogo): boolean {
  return !r.tipo.startsWith("pergunta_") && !r.tipo.endsWith("_definir") && r.formato !== "[]";
}

function exigenciasDoCatalogo(): Array<{ servicoId: number; tipo: string }> {
  return linhasDoCatalogo()
    .filter(ehUpload)
    .map(({ servicoId, tipo }) => ({ servicoId, tipo }));
}

/** O texto que o parser enxerga é a junção das linhas do modelo. */
function textoDe(chave: string): string {
  const linhas = CATALOGO[chave]?.linhas ?? [];
  return linhas.join(" ");
}

describe("o gerador cobre o dossiê da Autorização de Compra", () => {
  it("todo modelo declara grupo, slot e conteúdo", () => {
    for (const [chave, m] of Object.entries(CATALOGO)) {
      expect(m.slot, `${chave} sem slot`).toBeTruthy();
      expect(Object.keys(GRUPOS), `${chave} com grupo desconhecido`).toContain(m.grupo);
      // Ou tem texto, ou é a foto 3x4 — único tipo que aceita imagem.
      expect(Boolean(m.linhas?.length) || m.formato === "png", `${chave} sem conteúdo`).toBe(true);
    }
  });

  // São OITO certidões de idoneidade no dossiê deferido — nem sete, nem quatro.
  it("as oito certidões de idoneidade têm amostra", () => {
    const oito = [
      "antecedentes_eleitoral",
      "antecedentes_militar",
      "antecedentes_militar_estadual",
      "antecedentes_federal_trf3_regional",
      "antecedentes_federal_sjsp_jef",
      "antecedentes_estadual_distribuicao",
      "antecedentes_estadual_execucoes",
      "antecedentes_criminais",
    ];
    for (const tipo of oito) expect(Object.keys(CATALOGO), tipo).toContain(tipo);
  });

  // Esta é a rede de verdade: se o catálogo do banco ganhar uma exigência
  // nova, o gerador fica devendo uma amostra — e o teste avisa aqui, em vez de
  // você descobrir no meio de um teste manual que faltou documento.
  it("toda exigência de upload dos serviços 50, 51 e 60 tem amostra", () => {
    const semAmostra = [
      ...new Set(exigenciasDoCatalogo().map((e) => e.tipo)),
    ].filter((tipo) => !CATALOGO[tipo]);
    expect(semAmostra, `sem amostra no gerador: ${semAmostra.join(", ")}`).toEqual([]);
  });

  it("o mapa de serviço por tipo bate com o catálogo exportado", () => {
    const divergentes: string[] = [];
    for (const { servicoId, tipo } of exigenciasDoCatalogo()) {
      const m = CATALOGO[tipo];
      if (m && !m.servicos.includes(servicoId)) {
        divergentes.push(`${tipo} deveria constar no serviço ${servicoId}`);
      }
    }
    expect(divergentes, divergentes.join(" | ")).toEqual([]);
  });

  // ── ANOMALIA REGISTRADA, NÃO CORRIGIDA ────────────────────────────────────
  // No catálogo vivo de 22/08/2026 há PERGUNTAS cadastradas com formato de
  // arquivo (pdf/jpg/png) em vez de `[]`. Pergunta não tem anexo: quem lê o
  // `formato_aceito` para decidir se desenha upload ou botão vai desenhar
  // upload numa pergunta. Isto aqui não conserta nada — só congela a lista,
  // para a correção ser uma decisão consciente e não um efeito colateral.
  // Quando o catálogo for arrumado, este teste falha e a lista some.
  it("as perguntas com formato de upload continuam sendo estas — e só estas", () => {
    const anomalas = linhasDoCatalogo()
      .filter(
        (r) =>
          (r.tipo.startsWith("pergunta_") || r.tipo.endsWith("_definir")) && r.formato !== "[]",
      )
      .map((r) => `${r.servicoId}:${r.tipo}`)
      .sort();

    expect([...new Set(anomalas)]).toEqual([
      "50:pergunta_titular_estado_civil",
      "50:pergunta_titular_profissao",
      "60:exames_instituicao_definir",
      "60:pergunta_titular_estado_civil",
      "60:pergunta_titular_profissao",
    ]);
  });

  it("os três serviços de autorização de compra estão declarados", () => {
    expect(Object.keys(SERVICOS).map(Number).sort((a, b) => a - b)).toEqual([50, 51, 60]);
  });

  it("cada ramo de ocupação lícita tem por onde ser testado", () => {
    const ramos = [
      "ctps", // assalariado
      "renda_holerite_mes_atual", // assalariado
      "renda_holerite_funcionario_publico", // servidor público
      "renda_contrato_social", // empresário
      "renda_ccmei", // autônomo/MEI
      "renda_extrato_inss", // aposentado
    ];
    for (const tipo of ramos) expect(Object.keys(CATALOGO), tipo).toContain(tipo);
  });
});

describe("as amostras produzem a decisão certa na trava de escopo", () => {
  it("toda certidão criminal do dossiê é lida como CRIMINAL", () => {
    const criminais = [
      "antecedentes_federal_trf3_regional",
      "antecedentes_federal_sjsp_jef",
      "antecedentes_estadual_distribuicao",
      "antecedentes_estadual_execucoes",
      "antecedentes_criminais",
      "antecedentes_militar",
      "antecedentes_militar_estadual",
    ];
    for (const tipo of criminais) {
      expect(detectarEscopoCertidao(textoDe(tipo)), tipo).not.toBe("civel");
    }
  });

  it("a isca CÍVEL é lida como cível e cai num slot que espera certidão", () => {
    const m = CATALOGO.certidao_civel_isca;
    expect(detectarEscopoCertidao(textoDe("certidao_civel_isca"))).toBe("civel");
    expect(slotEsperaCertidao(m.slot)).toBe(true); // ou seja: será barrada
  });

  it("a isca COMBINADA (cível+criminal+eleitoral) cumpre a exigência criminal", () => {
    expect(detectarEscopoCertidao(textoDe("certidao_combinada_isca"))).toBe("criminal");
  });

  // O caso do Igor, reproduzido sem a CTPS do Igor.
  it("nenhuma amostra que NÃO é certidão pode ser barrada pela trava", () => {
    const naoCertidoes = Object.entries(CATALOGO)
      .filter(([, m]) => m.grupo !== "certidoes" && m.formato !== "png")
      .map(([chave]) => chave);

    expect(naoCertidoes.length).toBeGreaterThan(10);
    for (const chave of naoCertidoes) {
      // A trava só roda onde o slot espera certidão. Como nenhum destes
      // espera, o texto pode tropeçar em qualquer marcador sem derrubar o
      // envio — foi exatamente isso que quebrou com a Carteira de Trabalho.
      expect(slotEsperaCertidao(CATALOGO[chave].slot), chave).toBe(false);
    }
  });
});

describe("as amostras respeitam as exigências que já foram unificadas", () => {
  it("holerite privado e de servidor são a mesma exigência", () => {
    expect(
      mesmaExigenciaHolerite("renda_holerite_mes_atual", "renda_holerite_funcionario_publico"),
    ).toBe(true);
  });

  it("a identidade continua com via única", () => {
    expect(mesmaExigenciaIdentidade("rg_com_cpf", "rg_com_cpf")).toBe(true);
  });
});
