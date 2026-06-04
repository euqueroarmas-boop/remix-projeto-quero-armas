import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Como Escolher - roteamento comercial", () => {
  const quiz = readFileSync("src/pages/QuizPage.tsx", "utf8");
  const lpCac = readFileSync("src/pages/LpCacCr.tsx", "utf8");
  const lpDefesa = readFileSync("src/pages/LpDefesaPessoalPosse.tsx", "utf8");
  const lpAtividades = readFileSync("src/pages/LpAtividadesAvulsas.tsx", "utf8");

  it("nao termina o diagnostico em landing generica ou catalogo", () => {
    expect(quiz).not.toContain("navigate(`/lp/${winner}`)");
    expect(quiz).not.toContain("navigate('/servicos')");
    expect(quiz).not.toContain('navigate("/servicos")');
    expect(quiz).toContain("resolveCheckout");
    expect(quiz).toContain("/cadastro?");
  });

  it("CAC do zero leva direto para concessao-cr", () => {
    expect(quiz).toContain("objetivo === 'cac_objetivo'");
    expect(quiz).toContain("concessao-cr");
    expect(quiz).toContain("concessao_cr_operador");
    expect(quiz).toContain("servico_confirmado");
  });

  it("CR ativo nao manda para concessao-cr", () => {
    expect(quiz).toContain("documentacao === 'cr_ativo'");
    expect(quiz).toContain("autorizacao-de-compra-de-arma-de-fogo-atirador-esportivo-cac");
    expect(quiz).toContain("registro-e-apostilamento-de-arma-de-fogo-cac");
    expect(quiz).toContain("guia-de-trafego-especial-cac");
    expect(quiz).toContain("cr_ativo_compra_registro_gte");
  });

  it("landings principais apontam para checkout, nao para escolha generica", () => {
    expect(lpCac).toContain("CAC_CHECKOUT");
    expect(lpCac).toContain("servico=concessao-cr");
    expect(lpDefesa).toContain("DEFESA_CHECKOUT");
    expect(lpDefesa).toContain("servico=aquisicao-registro-posse-de-arma-de-fogo");
    expect(lpAtividades).toContain("CURSO_CHECKOUT");
    expect(lpAtividades).toContain("servico=operador-de-pistola-nivel-i");
  });
});
