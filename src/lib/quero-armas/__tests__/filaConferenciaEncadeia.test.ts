// ============================================================================
// QUINTA AUDITORIA — a fila destravada não podia virar um botão que não fecha
// ----------------------------------------------------------------------------
// A quarta auditoria descobriu que a FILA DE CONFERÊNCIA da equipe estava vazia
// por construção e a corrigiu. Isso criou um risco novo, e é o risco de sempre
// quando se liga um caminho que nunca rodou: ele pode estar incompleto.
//
// E estava. `qa-doc-acao-equipe` — a função que a fila chama — aprovava o
// documento e parava ali. O painel do processo, ao aprovar na mão, já
// disparava duas coisas que ela não disparava:
//
//   1. `qa-exigencia-pf-checar` — quando a última exigência de uma notificação
//      da PF é cumprida, alguém precisa saber que a delegacia pode ser
//      respondida. Corre prazo de 10 dias.
//
//   2. `qa-processo-checar-conclusao-checklist` — aprovar o último documento é
//      o que torna o processo `pronto_para_protocolar`. Sem a chamada, o
//      checklist fica 100% e o processo parado, esperando um clique que
//      ninguém sabe que precisa dar.
//
// Enquanto a fila estava morta isso era inofensivo: ninguém nunca aprovou nada
// por ali. Ligada a fila, viraria buraco vivo no caminho que a equipe mais usa.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const r = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");
const ACAO = r("supabase/functions/qa-doc-acao-equipe/index.ts");
const DRAWER = r("src/components/quero-armas/processos/ProcessoDetalheDrawer.tsx");
const FILA = r("src/components/quero-armas/admin/QAFilaRevisaoHumana.tsx");

describe("aprovar pela fila faz o mesmo que aprovar pelo processo", () => {
  it("a fila chama qa-doc-acao-equipe", () => {
    expect(FILA).toMatch(/qa-doc-acao-equipe/);
  });

  it("aprovar encadeia a checagem da exigência da PF", () => {
    expect(ACAO).toMatch(/qa-exigencia-pf-checar/);
    // O painel do processo já fazia isto; a paridade é o ponto.
    expect(DRAWER).toMatch(/qa-exigencia-pf-checar/);
  });

  it("aprovar encadeia a checagem de conclusão do checklist", () => {
    expect(ACAO).toMatch(/qa-processo-checar-conclusao-checklist/);
    expect(DRAWER).toMatch(/qa-processo-checar-conclusao-checklist/);
  });

  it("o encadeamento roda nos DOIS caminhos de aprovação", () => {
    // `aprovar` e `aprovar_e_modelar` aprovam o documento igual; só o segundo
    // ainda promove a modelo. Esquecer um deixaria metade das aprovações sem
    // fechar o ciclo.
    const chamadas = ACAO.match(/await encadearPosAprovacao\(\);/g) ?? [];
    expect(chamadas.length).toBe(2);
  });

  it("o encadeamento é best-effort — não derruba a aprovação", () => {
    // A aprovação já está gravada quando isto roda. Derrubar a resposta faria
    // a equipe reaprovar um documento que já está aprovado.
    const bloco = ACAO.slice(
      ACAO.indexOf("const encadearPosAprovacao"),
      ACAO.indexOf("switch (acao)"),
    );
    expect(bloco).toMatch(/catch \(e\) \{[\s\S]{0,120}console\.warn/);
    expect(bloco).not.toMatch(/throw/);
  });

  it("não encadeia quando o documento não tem processo", () => {
    const bloco = ACAO.slice(ACAO.indexOf("const encadearPosAprovacao"));
    expect(bloco).toMatch(/if \(!doc\.processo_id\) return;/);
  });

  it("rejeitar NÃO encadeia — nada foi cumprido", () => {
    const rejeitar = ACAO.slice(
      ACAO.indexOf('case "rejeitar"'),
      ACAO.indexOf('case "solicitar_novo_envio"'),
    );
    expect(rejeitar).not.toContain("encadearPosAprovacao");
  });
});

describe("pedir reenvio avisa o cliente, como a rejeição", () => {
  it("solicitar_novo_envio manda o aviso", () => {
    // Para o cliente os dois significam a mesma coisa: reenvie este documento.
    // Só um deles avisava.
    const bloco = ACAO.slice(
      ACAO.indexOf('case "solicitar_novo_envio"'),
      ACAO.indexOf('case "aprovar_e_modelar"'),
    );
    expect(bloco).toMatch(/notificarCliente\("documento_invalido", m\)/);
  });

  it("o evento usado existe no notificador", () => {
    const notif = r("supabase/functions/qa-processo-notificar/index.ts");
    expect(notif).toMatch(/\| "documento_invalido"/);
  });

  it("o motivo volta escrito para o cliente ver no guiado", () => {
    const bloco = ACAO.slice(
      ACAO.indexOf('case "solicitar_novo_envio"'),
      ACAO.indexOf('case "aprovar_e_modelar"'),
    );
    expect(bloco).toMatch(/observacoes_cliente: m/);
    expect(bloco).toMatch(/status: "pendente"/);
  });
});
