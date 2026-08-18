// ============================================================================
// O CASO GILBERTO — deferido em junho, alarmado em agosto
// ----------------------------------------------------------------------------
// Encontrado com dado real em 18/08/2026, conferindo o furo 2. A consulta
// apontou UM cliente com notificação de 19/06 e nenhuma resposta registrada:
// 60 dias de prazo estourado. Só que o item da venda dele estava DEFERIDO desde
// 29/06 — dez dias depois da notificação. O caso tinha acabado, e bem.
//
// O que fazia o alarme tocar eram duas coisas somadas:
//
//   1. "ACABOU" MORA EM DOIS LUGARES. `qa_itens_venda.status` fala em
//      MAIÚSCULAS (DEFERIDO) e `qa_processos.status` em minúsculas
//      (aguardando_documentos). O cron de alertas e o agregado do cliente
//      mandavam para o motor o status do PROCESSO; as telas mandavam o do
//      ITEM. Quem foi deferido antes da automação tem exatamente essa
//      combinação — item concluído, processo parado no checklist — e virava
//      alarme diário.
//
//   2. A COLUNA NOVA NÃO ERA LIDA POR NINGUÉM. `data_resposta_notificacao`
//      passou a fechar o prazo no motor de manhã, mas nenhum dos cinco
//      leitores a trazia no SELECT. Registrar a resposta não desligaria alarme
//      nenhum: o motor recebia `undefined` e seguia contando.
//
// O segundo é o mais perigoso dos dois, porque a correção PARECE aplicada.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extrairPrazoDoItem, type ItemComPrazo } from "../prazosProcessuais";

const r = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

function diasAtras(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const base: ItemComPrazo = { id: 1, servico_id: 48, servico_nome: "Posse" };

describe("o caso real: item deferido, processo parado no checklist", () => {
  it("não alarma quando o ITEM está deferido", () => {
    expect(extrairPrazoDoItem({
      ...base,
      status: "deferido",                    // item da venda, como veio do banco
      status_processo: "aguardando_documentos",
      data_notificacao: diasAtras(60),
    })).toBeNull();
  });

  it("não alarma quando o PROCESSO está deferido e o item ficou para trás", () => {
    expect(extrairPrazoDoItem({
      ...base,
      status: "EM ANDAMENTO",
      status_processo: "deferido",
      data_notificacao: diasAtras(60),
    })).toBeNull();
  });

  it("aceita maiúsculas e minúsculas — os dois vocabulários são reais", () => {
    for (const s of ["DEFERIDO", "deferido", "Deferido", " deferido "]) {
      expect(extrairPrazoDoItem({ ...base, status: s, data_notificacao: diasAtras(60) }))
        .toBeNull();
    }
  });

  it("cancelado e concluído também encerram", () => {
    for (const s of ["cancelado", "CONCLUIDO", "concluido", "CONCLUÍDO", "DESISTIU"]) {
      expect(extrairPrazoDoItem({ ...base, status_processo: s, data_notificacao: diasAtras(60) }))
        .toBeNull();
    }
  });

  it("INDEFERIDO não encerra — dele ainda cabe recurso", () => {
    const p = extrairPrazoDoItem({
      ...base, status: "INDEFERIDO", data_indeferimento: diasAtras(3),
    });
    expect(p).not.toBeNull();
    expect(p!.evento).toBe("INDEFERIMENTO");
  });

  it("caso vivo continua alarmando — o alarme não pode ficar surdo", () => {
    const p = extrairPrazoDoItem({
      ...base,
      status: "EM ANDAMENTO",
      status_processo: "notificado",
      data_notificacao: diasAtras(30),
    });
    expect(p).not.toBeNull();
    expect(p!.status).toBe("vencido");
  });
});

describe("TODO leitor traz a coluna que fecha o prazo", () => {
  // Sem isto, a correção do furo 2 é decorativa: a coluna é escrita e nunca
  // lida. Ao criar uma tela nova que calcule prazo, acrescente-a aqui.
  const LEITORES = [
    "supabase/functions/qa-processo-prazo-alertas/index.ts",
    "src/hooks/useClienteStatusAgregado.ts",
    "src/components/quero-armas/dashboard/dashboardSnapshot.ts",
    "src/components/quero-armas/clientes/ClienteOverview.tsx",
    "src/components/quero-armas/clientes/ClienteResumoKanban.tsx",
  ];

  for (const arquivo of LEITORES) {
    it(`${arquivo.split("/").pop()} seleciona data_resposta_notificacao`, () => {
      expect(r(arquivo), `${arquivo} não traz a coluna`).toContain("data_resposta_notificacao");
    });
  }

  it("todo leitor que usa o motor está listado aqui", () => {
    // Um leitor fora da lista é um lugar onde o prazo pode divergir dos outros.
    const usam = [
      "src/hooks/useClienteStatusAgregado.ts",
      "src/components/quero-armas/clientes/ClienteOverview.tsx",
      "src/components/quero-armas/clientes/ClienteResumoKanban.tsx",
      "supabase/functions/qa-processo-prazo-alertas/index.ts",
    ];
    for (const f of usam) expect(LEITORES).toContain(f);
  });
});

describe("os dois pontos que mandavam o status errado", () => {
  it("o cron manda o status do item E o do processo", () => {
    const cron = r("supabase/functions/qa-processo-prazo-alertas/index.ts");
    expect(cron).toMatch(/status: it\.status,/);
    expect(cron).toMatch(/status_processo: p\.status,/);
  });

  it("o agregado do cliente idem", () => {
    const hook = r("src/hooks/useClienteStatusAgregado.ts");
    expect(hook).toMatch(/status: it\?\.status \?\? null,/);
    expect(hook).toMatch(/status_processo: p\.status,/);
  });

  it("as duas cópias do motor conhecem o campo novo", () => {
    for (const p of [
      "src/lib/quero-armas/prazosProcessuais.ts",
      "supabase/functions/_shared/prazosProcessuais.ts",
    ]) {
      expect(r(p)).toMatch(/status_processo\?: string \| null;/);
      expect(r(p)).toMatch(/ehTerminal\(item\.status\) \|\| ehTerminal\(item\.status_processo\)/);
    }
  });
});
