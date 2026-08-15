import { describe, expect, it } from "vitest";
import { montarLinhaEntrega } from "../hubEntregaAuditoria";
import { montarArvoreExigencias, chaveExigencia, resumoSituacoes } from "../arvoreExigencias";
import { posicaoProtocolo } from "../ordemProtocolo";

/**
 * Caso real que originou a árvore (cliente #0048, 15/08/2026):
 * a foto 3x4 aparecia no meio da lista porque chegou depois, o reenvio do
 * antecedente SJSP/JEF virava um item 17 solto em vez de empilhar sobre o
 * rejeitado, e o laudo de capacidade técnica caía em "Grupo 9 — Outros".
 */
const docs = [
  { id: "d-mil", tipo_documento: "antecedentes_militar_estadual", status: "aprovado", origem: "equipe", created_at: "2026-08-03T20:19:38Z" },
  { id: "d-foto", tipo_documento: "foto_3x4", status: "aprovado", origem: "cliente", created_at: "2026-08-04T16:15:08Z" },
  { id: "d-sjsp-1", tipo_documento: "antecedentes_federal_sjsp_jef", status: "reprovado", origem: "cliente", created_at: "2026-08-06T21:33:20Z" },
  { id: "d-laudo-tec", tipo_documento: "laudo_capacidade_tecnica", status: "pendente_aprovacao", origem: "cliente", created_at: "2026-08-14T21:20:21Z" },
  { id: "d-sjsp-2", tipo_documento: "antecedentes_federal_sjsp_jef", status: "pendente_aprovacao", origem: "cliente", created_at: "2026-08-15T16:00:04Z" },
];

const exigencias = [
  { tipo_documento: "foto_3x4", nome_documento: "Foto 3x4", status: "aprovado", ordem: 2, obrigatorio: true, processo_id: "p1" },
  { tipo_documento: "certidao_federal_trf3_sjsp_jef", nome_documento: "Certidão SJSP e JEF", status: "pendente", ordem: 8, obrigatorio: true, processo_id: "p1" },
  { tipo_documento: "laudo_capacidade_tecnica", nome_documento: "Atestado de capacidade técnica", status: "em_analise", ordem: 14, obrigatorio: true, processo_id: "p1" },
  { tipo_documento: "comprovante_residencia", nome_documento: "Comprovante de residência", status: "pendente", ordem: 4, obrigatorio: true, processo_id: "p1" },
  { tipo_documento: "pergunta_possui_cr", nome_documento: "Possui CR?", status: "pendente", ordem: 1, processo_id: "p1" },
  // Seletor de condição profissional fechado como `dispensado_grupo` sem que
  // ninguém tenha escolhido a condição (caso Mizael, processo de 01/08/2026).
  { tipo_documento: "renda_definir_condicao", nome_documento: "Defina sua condição profissional — COORDENADOR DE PRODUÇÃO", status: "dispensado_grupo", ordem: 20, obrigatorio: true, processo_id: "p1" },
];

const arvore = montarArvoreExigencias(montarLinhaEntrega(docs, exigencias), exigencias);
const acharNo = (chave: string) =>
  arvore.flatMap((g) => g.nos).find((n) => n.chave === chave);

describe("Árvore de exigências do Hub", () => {
  it("põe cada exigência no seu grupo do protocolo, na ordem canônica", () => {
    expect(arvore.map((g) => g.grupo)).toEqual([...arvore.map((g) => g.grupo)].sort((a, b) => a - b));
    // A foto chegou em 4º na ordem de entrega, mas é o grupo 2 do dossiê.
    const grupoFoto = arvore.find((g) => g.nos.some((n) => n.chave === "foto_3x4"))!;
    const grupoIdoneidade = arvore.find((g) => g.nos.some((n) => n.chave === "antecedentes_federal_sjsp_jef"))!;
    expect(grupoFoto.grupo).toBe(2);
    expect(grupoIdoneidade.grupo).toBe(6);
    expect(arvore.indexOf(grupoFoto)).toBeLessThan(arvore.indexOf(grupoIdoneidade));
  });

  it("empilha o reenvio: o mais recente é o principal e o rejeitado vira histórico", () => {
    const no = acharNo("antecedentes_federal_sjsp_jef")!;
    expect(no.principal?.doc.id).toBe("d-sjsp-2");
    expect(no.historico.map((h) => h.doc.id)).toEqual(["d-sjsp-1"]);
    expect(no.situacao).toBe("em_analise");
  });

  it("casa o slug do processo com o tipo do Hub (certidao_federal_trf3_sjsp_jef)", () => {
    expect(chaveExigencia("certidao_federal_trf3_sjsp_jef")).toBe("antecedentes_federal_sjsp_jef");
    expect(acharNo("antecedentes_federal_sjsp_jef")!.exigencias).toHaveLength(1);
  });

  it("não colapsa exigências fora do catálogo do Hub num nó 'outro'", () => {
    // toHubTipoCompartilhado devolve "outro" para tipo desconhecido; se a
    // chave aceitasse esse fallback, dois slots distintos virariam um só.
    expect(chaveExigencia("apostila_consular_x")).toBe("apostila_consular_x");
    expect(chaveExigencia("declaracao_nova_do_catalogo")).not.toBe(
      chaveExigencia("apostila_consular_x"),
    );
    expect(chaveExigencia("outro")).toBe("outro");
  });

  it("trata CIN, RG e CNH como o mesmo slot de identidade civil", () => {
    expect(chaveExigencia("rg_com_cpf")).toBe("identidade_civil");
    expect(chaveExigencia("cnh")).toBe("identidade_civil");
    expect(chaveExigencia("cin")).toBe("identidade_civil");
    expect(chaveExigencia("identidade_funcional")).not.toBe("identidade_civil");
  });

  it("classifica o laudo de capacidade técnica em Laudos, não em Outros", () => {
    const no = acharNo("laudo_capacidade_tecnica")!;
    expect(no.grupo).toBe(7);
    expect(no.numero).toBe("14");
  });

  it("mostra exigência sem documento como pendente e ignora perguntas do checklist", () => {
    const pendente = acharNo("comprovante_residencia")!;
    expect(pendente.principal).toBeNull();
    expect(pendente.situacao).toBe("pendente");
    expect(pendente.obrigatorio).toBe(true);
    expect(acharNo("pergunta_possui_cr")).toBeUndefined();
  });

  it("mantém o documento entregue sem exigência dentro do seu grupo", () => {
    const no = acharNo("antecedentes_militar_estadual")!;
    expect(no.grupo).toBe(6);
    expect(no.situacao).toBe("aprovado");
    expect(no.exigencias).toHaveLength(0);
  });

  it("separa o CRAF pelos dois sistemas: SINARM (PF) e SIGMA (Exército)", () => {
    // O documento é o CRAF nos dois casos; o que muda é o sistema de registro.
    // O CAC hoje é analisado pela PF, mas emitido em nome do Exército — o
    // documento continua saindo como SIGMA.
    const sinarm = posicaoProtocolo("sinarm");
    const craf = posicaoProtocolo("craf");
    expect(sinarm.rotulo).toContain("SINARM");
    expect(sinarm.rotulo).toContain("defesa pessoal");
    expect(craf.rotulo).toContain("SIGMA");
    expect(craf.rotulo).toContain("CAC");
    expect(sinarm.rotulo).not.toBe(craf.rotulo);

    // O CRAF é resultado do 2º processo (registro), não peça do dossiê de
    // aquisição — fica fora dos grupos 1..8.
    expect(sinarm.grupo).toBe(9);
    expect(craf.grupo).toBe(9);

    // O requerimento nunca foi este tipo: tem os seus.
    expect(posicaoProtocolo("requerimento_sinarm").grupo).toBe(1);
    expect(posicaoProtocolo("requerimento_de_posse_de_arma_de_fogo").grupo).toBe(1);
  });

  it("não deixa o seletor de condição profissional passar por exigência cumprida", () => {
    // `dispensado_grupo` é status de cumprido no checklist, mas este item não é
    // documento: enquanto ele existe, a condição não foi definida e nenhum
    // comprovante de renda foi pedido. Grupo 5 tem que ficar em aberto.
    const no = acharNo("renda_definir_condicao")!;
    expect(no.itemDeFluxo).toBe(true);
    expect(no.principal).toBeNull();
    expect(no.situacao).toBe("pendente");

    const grupo5 = arvore.find((g) => g.grupo === 5)!;
    expect(grupo5.entregues).toBe(0);
    expect(grupo5.pendentes).toBe(1);
    expect(resumoSituacoes(grupo5.nos)).toEqual([{ situacao: "pendente", qtd: 1 }]);
  });

  it("resume as situações do grupo na ordem da legenda, sem zerados", () => {
    // Grupo 6: militar estadual aprovado + SJSP/JEF reenviado (em análise).
    const grupo6 = arvore.find((g) => g.grupo === 6)!;
    expect(resumoSituacoes(grupo6.nos)).toEqual([
      { situacao: "aprovado", qtd: 1 },
      { situacao: "em_analise", qtd: 1 },
    ]);
    // Grupo 4: só o comprovante de residência, ainda sem envio.
    const grupo4 = arvore.find((g) => g.grupo === 4)!;
    expect(resumoSituacoes(grupo4.nos)).toEqual([{ situacao: "pendente", qtd: 1 }]);
    expect(resumoSituacoes([])).toEqual([]);
  });

  it("conta entregues e pendentes por grupo", () => {
    const grupo6 = arvore.find((g) => g.grupo === 6)!;
    expect(grupo6.entregues).toBe(2);
    expect(grupo6.pendentes).toBe(0);
    const grupo4 = arvore.find((g) => g.grupo === 4)!;
    expect(grupo4.pendentes).toBe(1);
  });
});
