// ============================================================================
// A efetiva necessidade pertence a UM processo — e passa pela equipe antes do
// protocolo.
// ----------------------------------------------------------------------------
// Dois furos medidos em 18/08/2026, no mesmo par de arquivos:
//
// 1) `qa-efetiva-aprovar` fechava a exigência do checklist filtrando só por
//    `cliente_id`. Cliente com dois processos tinha a petição de um marcada
//    como aprovada nos dois. A devolução pela equipe (`qa-efetiva-revisar`)
//    sempre foi escopada por `processo_id` — então só o processo certo
//    reabria, e o outro seguia com uma petição reprovada carimbada de
//    aprovada, livre para entrar na juntada.
//
// 2) O aceite do cliente deixa o registro em `em_revisao` (a equipe ainda
//    precisa ler) mas já marca a linha do checklist como `aprovado`. Com o
//    checklist 100%, o processo virava `pronto_para_protocolar` com a peça que
//    decide o pedido sem revisão nenhuma.
//
// São regras de backend (Deno), sem runtime aqui — o teste lê a fonte, no
// mesmo padrão de `efetivaNecessidadeDevolvida.test.ts`.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const r = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

describe("aceite do cliente escopado no processo", () => {
  const src = r("supabase/functions/qa-efetiva-aprovar/index.ts");

  it("filtra a linha do checklist por processo_id, não só por cliente_id", () => {
    expect(src).toMatch(/\.eq\("processo_id", reg\.processo_id\)/);
  });

  it("mantém o cliente_id como filtro adicional", () => {
    expect(src).toMatch(/\.eq\("cliente_id", reg\.cliente_id\)/);
  });

  it("o aceite do cliente deixa o registro em revisão da equipe", () => {
    expect(src).toMatch(/status: "em_revisao"/);
    expect(src).toMatch(/aprovado_cliente: true/);
  });
});

describe("gate: petição sem revisão da equipe não vira pronto para protocolar", () => {
  const src = r("supabase/functions/qa-processo-checar-conclusao-checklist/index.ts");

  it("consulta a efetiva necessidade do processo antes de promover", () => {
    expect(src).toMatch(/from\("qa_efetiva_necessidade"\)/);
    expect(src).toMatch(/\.eq\("processo_id", processoId\)/);
  });

  it("bloqueia enquanto o status não for aprovado pela equipe", () => {
    expect(src).toMatch(/efetiva_necessidade_sem_revisao_da_equipe/);
    expect(src).toMatch(/!==\s*"aprovado"/);
  });

  it("o gate roda ANTES do update que promove o status", () => {
    const posGate = src.indexOf("efetiva_necessidade_sem_revisao_da_equipe");
    const posUpdate = src.indexOf('status: "pronto_para_protocolar"');
    expect(posGate).toBeGreaterThan(-1);
    expect(posUpdate).toBeGreaterThan(-1);
    expect(posGate).toBeLessThan(posUpdate);
  });

  it("serviço sem efetiva necessidade não é afetado (só bloqueia se houver registro)", () => {
    expect(src).toMatch(/if \(efetiva &&/);
  });
});

describe("a devolução continua escopada e visível", () => {
  it("qa-efetiva-revisar devolve por processo_id", () => {
    const src = r("supabase/functions/qa-efetiva-revisar/index.ts");
    expect(src).toMatch(/\.eq\("processo_id", reg\.processo_id\)/);
    expect(src).toMatch(/status: "ajuste_necessario"/);
  });

  it("ajuste_necessario tem rótulo próprio no painel (não cai em PENDENTE)", () => {
    const src = r("src/components/quero-armas/processos/processoConstants.ts");
    expect(src).toMatch(/ajuste_necessario:\s*\{\s*label:\s*"AJUSTE NECESSÁRIO"/);
  });
});
