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

  it("barra só a compra repetida em minutos, e quem comprou desfaz sozinho", () => {
    expect(src).toContain("PROTEÇÃO CONTRA COMPRA REPETIDA POR ENGANO");
    expect(src).toContain("JANELA_COMPRA_REPETIDA_MIN = 30");
    expect(src).toContain('error: "compra_repetida_agora"');
    expect(src).toContain("body.recompra_confirmada !== true");
    expect(src).toContain('tipo_evento: "venda_recompra_confirmada"');
    // a busca é por VENDA recente, não por processo: no caso que originou a
    // proteção a segunda compra aconteceu antes de existir processo.
    expect(src).toContain('.from("qa_itens_venda")');
  });

  it("não impõe limite de quantidade nem consulta categoria do titular", () => {
    expect(src).not.toContain("qa_servicos_limite_compra");
    expect(src).not.toContain("categoria_titular");
    expect(src).not.toContain("limite_do_servico");
  });
});
