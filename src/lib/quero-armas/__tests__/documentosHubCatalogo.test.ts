import { describe, expect, it } from "vitest";
import {
  getHubCategoriaMeta,
  getTipoDocumentoMeta,
  inferEscopoDocumental,
  inferHubCategoriaFromTipo,
  isCategoriaArmaAcervo,
  isCategoriaPermanente,
  listTiposByCategoria,
} from "../documentosHubCatalogo";

describe("documentosHubCatalogo", () => {
  it("expõe os rótulos alinhados na taxonomia nova", () => {
    expect(getHubCategoriaMeta("identificacao").label).toBe("Identificação civil");
    expect(getHubCategoriaMeta("endereco").label).toBe("Residência");
    expect(getHubCategoriaMeta("renda_ocupacao").label).toBe("Renda / ocupação");
    expect(getHubCategoriaMeta("documentos_processo").label).toBe("Documentos processuais");
  });

  it("mantém arma/acervo isolado do restante do hub", () => {
    expect(isCategoriaArmaAcervo("arma_acervo")).toBe(true);
    expect(isCategoriaArmaAcervo("identificacao")).toBe(false);
  });

  it("reconhece categorias permanentes corretamente", () => {
    expect(isCategoriaPermanente("identificacao")).toBe(true);
    expect(isCategoriaPermanente("laudos_exames")).toBe(true);
    expect(isCategoriaPermanente("arma_acervo")).toBe(false);
    expect(isCategoriaPermanente("documentos_processo")).toBe(false);
  });

  it("classifica documentos jurídicos como documentos processuais", () => {
    expect(inferHubCategoriaFromTipo("procuracao")).toBe("documentos_processo");
    expect(inferHubCategoriaFromTipo("recurso_administrativo_doc")).toBe("documentos_processo");
    expect(inferHubCategoriaFromTipo("mandado_seguranca_doc")).toBe("documentos_processo");
    expect(inferHubCategoriaFromTipo("oficio")).toBe("documentos_processo");
  });

  it("mantém documentos CAC/atividade no escopo dedicado", () => {
    expect(inferHubCategoriaFromTipo("comprovante_habitualidade")).toBe("cac_atividade");
    expect(inferEscopoDocumental({ tipo_documento: "comprovante_habitualidade" })).toBe("cac_atividade");
  });

  it("oferece tipos novos do catálogo expandido", () => {
    const docsProcesso = listTiposByCategoria("documentos_processo").map((item) => item.value);
    const declaracoes = listTiposByCategoria("declaracoes").map((item) => item.value);
    const necessidade = listTiposByCategoria("efetiva_necessidade").map((item) => item.value);

    expect(docsProcesso).toContain("oficio");
    expect(docsProcesso).toContain("procuracao");
    expect(declaracoes).toContain("declaracao_correlata");
    expect(necessidade).toContain("documento_complementar_caso");
  });

  it("preserva metadados dos tipos de arma/acervo", () => {
    const craf = getTipoDocumentoMeta("craf");
    expect(craf?.categoria).toBe("arma_acervo");
    expect(craf?.escopo).toBe("arma");
    expect(craf?.aceitaVinculoArma).toBe(true);
  });
});
