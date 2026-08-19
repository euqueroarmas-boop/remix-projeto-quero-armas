import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const FN = "supabase/functions/qa-checkout-criar-venda/index.ts";

describe("qa-checkout-criar-venda source guards", () => {
  const src = readFileSync(FN, "utf8");

  it("resolve carrinho legado por servico_id numerico e por slug", () => {
    expect(src).toContain("function isLegacyNumericId");
    expect(src).toContain('.in("servico_id", legacyIds)');
    expect(src).toContain(".in(\"slug\", slugs)");
    expect(src).toContain("byCartId.get(String(it.servico_id)) ?? bySlug.get(it.slug)");
  });

  it("aceita cliente legado vinculado diretamente em qa_clientes.user_id", () => {
    expect(src).toContain('.from("qa_clientes")');
    expect(src).toContain('.eq("user_id", userId)');
    expect(src).toContain('.from("cliente_auth_links").insert');
    expect(src).toContain("qaClienteId = (clienteDireto as any).id");
  });

  it("recusa compra repetida em minutos e compra acima do limite, salvo confirmação", () => {
    expect(src).toContain("TRAVA DE COMPRA REPETIDA");
    expect(src).toContain('error: "servico_ja_contratado"');
    expect(src).toContain("body.recompra_confirmada !== true");
    expect(src).toContain("JANELA_COMPRA_REPETIDA_MIN = 30");
    expect(src).toContain('motivo: "repeticao_em_minutos"');
    expect(src).toContain('motivo: "limite_do_servico"');
    // a busca é por VENDA viva do cliente, não por processo: no caso que
    // originou a trava a segunda compra aconteceu antes de existir processo.
    expect(src).toContain('.from("qa_itens_venda")');
    expect(src).toContain('tipo_evento: "venda_recompra_confirmada"');
  });

  it("lê o limite do catálogo por categoria do titular, sem regra fixa no código", () => {
    expect(src).toContain('.from("qa_servicos_limite_compra")');
    expect(src).toContain('.select("id, id_legado, categoria_titular")');
    // serviço sem linha de limite não pode travar
    expect(src).toContain("return escolhido ? Number((escolhido as any).limite) : null;");
    expect(src).toContain("limite != null && existente.unidades + doCarrinho.quantidade > limite");
  });
});
