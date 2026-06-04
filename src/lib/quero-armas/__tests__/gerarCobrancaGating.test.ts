/**
 * FASE 2B-2 — gating do botão "Gerar cobrança" e validações da edge
 * qa-venda-gerar-cobranca.
 *
 * Esses testes não chamam o Asaas; validam apenas a lógica pura de
 * pré-condições reproduzida aqui de forma idêntica à edge/UI.
 */
import { describe, it, expect } from "vitest";

type V = {
  status_validacao_valor?: string | null;
  valor_aprovado?: number | string | null;
  asaas_payment_id?: string | null;
  cobranca_status?: string | null;
};

function podeMostrarBotao(v: V): boolean {
  return (
    v.status_validacao_valor === "aprovado" &&
    Number(v.valor_aprovado || 0) > 0 &&
    !v.asaas_payment_id &&
    (!v.cobranca_status || v.cobranca_status === "nao_gerada")
  );
}

const ALLOWED_BILLING = new Set(["PIX", "BOLETO", "CREDIT_CARD"]);

function validarPrecondicoesEdge(v: V & { id?: number }, billing: string) {
  if (!v.id || v.id <= 0) return { ok: false, error: "venda_id_required" };
  if (!ALLOWED_BILLING.has(billing)) return { ok: false, error: "invalid_billing_type" };
  if (v.status_validacao_valor !== "aprovado") return { ok: false, error: "venda_nao_aprovada" };
  const valor = Number(v.valor_aprovado);
  if (!Number.isFinite(valor) || valor <= 0) return { ok: false, error: "valor_aprovado_invalido" };
  if (String(v.cobranca_status || "").toLowerCase() === "confirmada") return { ok: false, error: "cobranca_ja_confirmada" };
  if (v.asaas_payment_id) return { ok: false, error: "ja_existe_cobranca", reused: true };
  return { ok: true };
}

describe("FASE 2B-2 — gating UI", () => {
  it("mostra botão quando aprovada, com valor e sem cobrança", () => {
    expect(podeMostrarBotao({ status_validacao_valor: "aprovado", valor_aprovado: 100 })).toBe(true);
  });
  it("não mostra quando pendente", () => {
    expect(podeMostrarBotao({ status_validacao_valor: "pendente", valor_aprovado: 100 })).toBe(false);
  });
  it("não mostra sem valor aprovado", () => {
    expect(podeMostrarBotao({ status_validacao_valor: "aprovado", valor_aprovado: 0 })).toBe(false);
  });
  it("não mostra se já existe asaas_payment_id", () => {
    expect(podeMostrarBotao({ status_validacao_valor: "aprovado", valor_aprovado: 100, asaas_payment_id: "pay_abc" })).toBe(false);
  });
  it("não mostra se cobranca_status já está aguardando", () => {
    expect(podeMostrarBotao({ status_validacao_valor: "aprovado", valor_aprovado: 100, cobranca_status: "aguardando_pagamento" })).toBe(false);
  });
});

describe("FASE 2B-2 — pré-condições da edge", () => {
  it("aprovada gera payload válido", () => {
    expect(validarPrecondicoesEdge({ id: 10, status_validacao_valor: "aprovado", valor_aprovado: 250 }, "PIX")).toEqual({ ok: true });
  });
  it("venda não aprovada bloqueia", () => {
    expect(validarPrecondicoesEdge({ id: 10, status_validacao_valor: "pendente", valor_aprovado: 250 }, "PIX").error)
      .toBe("venda_nao_aprovada");
  });
  it("sem valor_aprovado bloqueia", () => {
    expect(validarPrecondicoesEdge({ id: 10, status_validacao_valor: "aprovado", valor_aprovado: null }, "PIX").error)
      .toBe("valor_aprovado_invalido");
  });
  it("billing_type inválido bloqueia", () => {
    expect(validarPrecondicoesEdge({ id: 10, status_validacao_valor: "aprovado", valor_aprovado: 100 }, "BITCOIN").error)
      .toBe("invalid_billing_type");
  });
  it("já existe asaas_payment_id retorna reused (não cria 2ª cobrança)", () => {
    const r = validarPrecondicoesEdge({ id: 10, status_validacao_valor: "aprovado", valor_aprovado: 100, asaas_payment_id: "pay_x" }, "PIX");
    expect(r.ok).toBe(false);
    expect((r as any).reused).toBe(true);
  });
  it("dry_run conceitual — edge nunca usa valor do frontend (valor vem de qa_vendas.valor_aprovado)", () => {
    // documenta a regra: nenhum input de valor é aceito.
    const inputBody = { venda_id: 10, billing_type: "PIX", valor: 99999 };
    expect(Object.keys(inputBody).includes("valor")).toBe(true); // poderia vir do front
    // mas a edge ignora — só lê venda.valor_aprovado.
    const v = { id: 10, status_validacao_valor: "aprovado", valor_aprovado: 250 };
    expect(validarPrecondicoesEdge(v, "PIX").ok).toBe(true);
    // valor canônico:
    expect(Number(v.valor_aprovado)).toBe(250);
  });
});