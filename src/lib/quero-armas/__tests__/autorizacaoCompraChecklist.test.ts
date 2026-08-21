// ============================================================================
// AUTORIZAÇÃO DE COMPRA — ATIRADOR (serviço 50) x os dossiês DEFERIDOS
// ----------------------------------------------------------------------------
// O checklist deste serviço não foi inventado: ele é a cópia da espinha 01–12
// que a própria equipe numerou em três dossiês que a Polícia Federal DEFERIU
// (Eduardo Rizek, Rivelino Pereira e Édson Campos). Se um item sumir do
// catálogo, o dossiê chega incompleto ao protocolo — e ninguém percebe, porque
// nada quebra: o processo simplesmente anda sem o documento.
//
// Este teste é a rede embaixo disso. Ele lê a migration e cobra, item por
// item, o que os três dossiês deferidos trouxeram.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SQL = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260820220000_autorizacao_compra_atirador_checklist_dossie_real.sql",
  ),
  "utf-8",
);

/** Os 12 itens numerados pela equipe nos dossiês, na ordem do dossiê. */
const ITENS_DO_DOSSIE: Array<[string, string[]]> = [
  ["01 capacidade técnica", ["laudo_capacidade_tecnica"]],
  ["02 treinamentos e competições", ["comprovante_competicao"]],
  ["03 DSA", ["dsa_declaracao_seguranca_acervo"]],
  ["04 antecedentes Justiça Federal", [
    "antecedentes_federal_trf3_regional",
    "antecedentes_federal_sjsp_jef",
  ]],
  ["05 declaração de inquérito", [
    "pergunta_responde_inquerito_criminal",
    "declaracao_sem_inquerito_processo_criminal",
  ]],
  ["06 documento de identidade", ["rg_com_cpf"]],
  ["07 laudo psicológico", ["laudo_psicologico"]],
  ["08 residência", ["comprovante_residencia", "declaracao_responsavel_imovel"]],
  ["09 ocupação lícita", ["renda_definir_condicao"]],
  ["10 antecedentes Justiça Estadual", [
    "antecedentes_estadual_distribuicao",
    "antecedentes_estadual_execucoes",
    "antecedentes_criminais",
  ]],
  ["11 antecedentes Justiça Militar", ["antecedentes_militar"]],
  ["12 antecedentes Justiça Eleitoral", ["antecedentes_eleitoral"]],
];

/** Fora da numeração, mas presentes nos três dossiês. */
const FORA_DA_NUMERACAO = ["foto_3x4", "gru", "gru_comprovante", "autorizacao_compra"];

describe("o checklist do serviço 50 cobre os dossiês deferidos", () => {
  for (const [item, tipos] of ITENS_DO_DOSSIE) {
    it(`item ${item}`, () => {
      for (const tipo of tipos) expect(SQL).toContain(`('${tipo}'`);
    });
  }

  it("os itens fora da numeração também entram", () => {
    for (const tipo of FORA_DA_NUMERACAO) expect(SQL).toContain(`('${tipo}'`);
  });

  it("a filiação à entidade de tiro está lá — anuidade vencida derruba o pedido", () => {
    expect(SQL).toContain("('comprovante_filiacao_entidade_tiro'");
  });
});

describe("as regras que os dossiês ensinaram", () => {
  it("o ANEXO C fala em ESPÉCIE de arma, não em calibre (IN DG/PF 311)", () => {
    const i = SQL.indexOf("('declaracao_compromisso_habitualidade'");
    const bloco = SQL.slice(i, SQL.indexOf("-- ── item 03", i));
    expect(bloco).toContain("espécie de arma");
    expect(bloco).not.toContain("por calibre");
  });

  it("o ANEXO C aponta para o modelo v2, não para o de maio", () => {
    expect(SQL).toContain("'declaracao_compromisso_habitualidade_v2'");
  });

  it("a autorização vale 180 dias — nos três dossiês foram 6 meses exatos", () => {
    const i = SQL.indexOf("('autorizacao_compra'");
    expect(SQL.slice(i, i + 260)).toContain("180");
  });

  it("a declaração de homonímia entra como condicional, sem travar quem não precisa", () => {
    const i = SQL.indexOf("('declaracao_homonimia'");
    const bloco = SQL.slice(i, i + 320);
    expect(bloco).toContain("false"); // obrigatorio = false
  });

  it("reativa o que estava apagado sem motivo", () => {
    expect(SQL).toContain("ativo               = true");
  });

  it("as perguntas ganham chave e opções, senão o portal desenha upload", () => {
    expect(SQL).toContain("'chave', 'responde_inquerito_criminal'");
    expect(SQL).toContain("'opcoes'");
  });
});

describe("o que este bloco deliberadamente NÃO faz", () => {
  it("não semeia os 5 anos de endereço — quem faz isso é qa_seed_endereco_5_anos", () => {
    expect(SQL).not.toContain("comprovante_endereco_ano_");
    expect(SQL).toContain("qa_seed_endereco_5_anos");
  });

  it("não lista os documentos de renda um a um — quem injeta é a edge da condição", () => {
    expect(SQL).not.toContain("('renda_holerite");
    expect(SQL).not.toContain("('renda_ctps");
    expect(SQL).toContain("qa-processo-set-condicao");
  });

  it("não toca no serviço 51 — os três dossiês são de atirador, não de caçador", () => {
    expect(SQL).not.toContain("servico_id = 51");
    expect(SQL).not.toContain("IN (50, 51)");
  });

  it("NÃO reexplode processo nenhum — o checklist vale só daqui pra frente", () => {
    // Decisão do titular (20/08/2026): há processos já concluídos, e nenhum
    // processo existente pode ganhar exigência nova em lote. A função de
    // explosão só pode aparecer no SQL dentro de comentário, nunca executada.
    const executavel = SQL.split("\n").filter((l) => !l.trimStart().startsWith("--")).join("\n");
    expect(executavel).not.toContain("qa_explodir_checklist_processo");
    expect(executavel).not.toContain("DO $$");
    expect(executavel).not.toContain("DELETE FROM public.qa_processo_documentos");
    expect(executavel).not.toContain("qa_processo_documentos");
  });
});
