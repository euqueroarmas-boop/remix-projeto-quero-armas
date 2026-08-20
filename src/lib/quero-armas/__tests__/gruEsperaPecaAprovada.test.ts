// ============================================================================
// A GRU só abre depois da defesa aprovada
// ----------------------------------------------------------------------------
// Furo confirmado no dado real em 20/08/2026, no processo do Anthony:
// documentação inteira entregue, boleto da GRU aberto no checklist do cliente,
// e NENHUMA peça gerada na base.
//
// A ordem do serviço é: documentos → a equipe jurídica escreve a defesa com o
// que o cliente trouxe → ele lê e aprova → aí paga a GRU, libera o gov.br e
// assina a juntada. Quem abre esses quatro passos é a promoção do processo a
// `pronto_para_protocolar`, feita por `qa-processo-checar-conclusao-checklist`.
// O freio que existia lá só mordia a peça JÁ enviada e pendurada; processo sem
// peça nenhuma passava reto e o cliente era convidado a pagar R$ 88 antes de
// existir defesa.
//
// Estes testes travam as duas metades da correção: o serviço declara que tem
// defesa escrita, e a função recusa a promoção enquanto não houver `aprovada`.
// ============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const r = (p: string) => readFileSync(resolve(process.cwd(), p), "utf-8");

const EDGE = r("supabase/functions/qa-processo-checar-conclusao-checklist/index.ts");
const SQL = r("supabase/migrations/20260820120000_gru_espera_peca_aprovada.sql");

/** Só o que o Postgres executa — comentário não vale como garantia. */
const semComentario = (sql: string) =>
  sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

describe("a migration", () => {
  it("só acrescenta coluna — nada é removido nem renomeado", () => {
    const executavel = semComentario(SQL);
    expect(executavel).not.toMatch(/DROP COLUMN/i);
    expect(executavel).not.toMatch(/RENAME/i);
    expect(executavel).toMatch(/ADD COLUMN IF NOT EXISTS exige_peca_defesa boolean NOT NULL DEFAULT false/);
  });

  it("marca fail-safe: todo serviço que gera processo passa a exigir a defesa", () => {
    const executavel = semComentario(SQL);
    expect(executavel).toMatch(/UPDATE public\.qa_servicos_catalogo/);
    expect(executavel).toMatch(/SET exige_peca_defesa = true/);
    expect(executavel).toMatch(/WHERE gera_processo = true/);
  });

  it("a exceção fica comentada — ninguém isenta serviço sem querer", () => {
    expect(SQL).toMatch(/-- UPDATE public\.qa_servicos_catalogo/);
    expect(semComentario(SQL)).not.toMatch(/SET exige_peca_defesa = false/);
  });
});

describe("o gate da edge function", () => {
  it("lê no catálogo se o serviço tem defesa escrita", () => {
    expect(EDGE).toMatch(/from\("qa_servicos_catalogo"\)/);
    expect(EDGE).toMatch(/exige_peca_defesa/);
    expect(EDGE).toMatch(/servico_id, servico_nome/);
  });

  it("recusa a promoção quando o serviço exige defesa e não há peça aprovada", () => {
    expect(EDGE).toMatch(/exigePeca && !status\.includes\("aprovada"\)/);
    expect(EDGE).toMatch(/peticao_nao_escrita/);
    expect(EDGE).toMatch(/peticao_em_rascunho_nao_enviada/);
  });

  it("continua barrando a peça enviada e pendurada", () => {
    expect(EDGE).toMatch(/peticao_aguardando_aprovacao_do_cliente/);
    expect(EDGE).toMatch(/peticao_devolvida_pelo_cliente/);
  });

  it("procura a peça também pelo cliente — a minuta nasce sem processo_id", () => {
    // `qa-gerar-peca` grava só `cliente_id`; quem preenche `processo_id` é
    // `qa-peca-enviar-cliente`. Buscar só por processo cegaria o rascunho.
    expect(EDGE).toMatch(/and\(processo_id\.is\.null,cliente_id\.eq\./);
  });

  it("o gate roda ANTES de promover o status", () => {
    const posGate = EDGE.indexOf("peticao_nao_escrita");
    const posUpdate = EDGE.indexOf('status: "pronto_para_protocolar"');
    expect(posGate).toBeGreaterThan(0);
    expect(posUpdate).toBeGreaterThan(posGate);
  });

  it("o id do processo é validado antes de entrar no filtro .or()", () => {
    // Filtro do PostgREST é string: id livre ali é porta de injeção.
    expect(EDGE).toMatch(/processo_id_invalido/);
    const posValidacao = EDGE.indexOf("processo_id_invalido");
    const posOr = EDGE.indexOf(".or(filtro)");
    expect(posOr).toBeGreaterThan(posValidacao);
  });
});
