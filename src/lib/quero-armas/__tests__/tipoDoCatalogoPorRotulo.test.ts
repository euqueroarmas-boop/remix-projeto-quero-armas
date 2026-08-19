import { describe, expect, it } from "vitest";
import { tipoDoCatalogoPorRotulo } from "@/lib/quero-armas/documentosHubCatalogo";

// ============================================================================
// Caso REAL (18/08/2026, 20:31 e 20:34). A trilha gravou:
//   tipo_lido      = REQUERIMENTO_DE_POSSE_DE_ARMA_DE_FOGO   ← leitura acertou
//   exigencia_alvo = requerimento_de_posse_de_arma_de_fogo   ← slot pedia isso
//   motivo         = "identificado como Outro documento"     ← e reprovou
// A leitura estava certa e o slot estava certo. Quem errou foi a tradução do
// rótulo: o mapa de chaves exatas do site não conhecia aquela chave e devolveu
// "outro". Este teste existe para essa tradução nunca mais depender do mapa.
// ============================================================================
describe("tipoDoCatalogoPorRotulo", () => {
  it("resgata o rótulo que reprovou o requerimento do cliente", () => {
    expect(tipoDoCatalogoPorRotulo("REQUERIMENTO_DE_POSSE_DE_ARMA_DE_FOGO")).toBe(
      "requerimento_de_posse_de_arma_de_fogo",
    );
  });

  it.each([
    ["LAUDO_PSICOLOGICO", "laudo_psicologico"],
    ["antecedentes_federal_trf3_regional", "antecedentes_federal_trf3_regional"],
    ["Comprovante Residencia", "comprovante_residencia"],
    ["protocolo-processo", "protocolo_processo"],
    ["  renda_ccmei  ", "renda_ccmei"],
  ])("resgata %s para qualquer tipo do catálogo", (rotulo, esperado) => {
    expect(tipoDoCatalogoPorRotulo(rotulo)).toBe(esperado);
  });

  it.each([
    "DESCONHECIDO",
    "PROTOCOLO_REQUERIMENTO",
    "tipo_que_nao_existe",
    "",
    null,
    undefined,
  ])("devolve null para %s — inventar tipo é pior que não saber", (rotulo) => {
    expect(tipoDoCatalogoPorRotulo(rotulo)).toBeNull();
  });
});
