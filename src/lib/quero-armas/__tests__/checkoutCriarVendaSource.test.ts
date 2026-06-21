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
});
