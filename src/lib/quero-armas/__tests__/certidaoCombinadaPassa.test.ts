// ============================================================================
// CERTIDÃO COMBINADA (cível + criminal + eleitoral) CUMPRE A EXIGÊNCIA
// ----------------------------------------------------------------------------
// Achado em 22/08/2026, testando o caminho ANTES de o cliente tentar: vários
// portais — o TRF3 à frente — emitem um PDF único "Certidão de Distribuição
// Cível, Criminal e Eleitoral". A trava lia "cível" no título e reprovava,
// mandando o cliente "voltar ao site do órgão e emitir a certidão criminal" —
// que é exatamente o documento que ele já tinha na mão. Beco sem saída.
//
// Regra: se o CABEÇALHO traz marcador cível E criminal, é combinada → vale
// como criminal. Certidão puramente cível continua barrada.
// ============================================================================

import { describe, it, expect } from "vitest";
import { detectarEscopoCertidao } from "../escopoCertidao";

const CRIMINAIS: Record<string, string> = {
  "TRF3 combinada": "PODER JUDICIARIO JUSTICA FEDERAL TRIBUNAL REGIONAL FEDERAL DA 3A REGIAO CERTIDAO DE DISTRIBUICAO CIVEL, CRIMINAL E ELEITORAL CERTIFICO NADA CONSTA",
  "TRF3 regional criminal": "TRIBUNAL REGIONAL FEDERAL DA 3A REGIAO CERTIDAO DE DISTRIBUICAO CRIMINAL ABRANGENCIA REGIONAL NADA CONSTA",
  "SJSP e JEF": "JUSTICA FEDERAL SECAO JUDICIARIA DE SAO PAULO E JUIZADO ESPECIAL FEDERAL CERTIDAO DE DISTRIBUICAO DE ACOES CRIMINAIS NADA CONSTA",
  "TJSP distribuicao": "TRIBUNAL DE JUSTICA DO ESTADO DE SAO PAULO CERTIDAO ESTADUAL DE DISTRIBUICOES CRIMINAIS NADA CONSTA",
  "TJSP execucoes": "TRIBUNAL DE JUSTICA DO ESTADO DE SAO PAULO CERTIDAO DE EXECUCOES CRIMINAIS NADA CONSTA",
  "Policia Civil": "SECRETARIA DA SEGURANCA PUBLICA ATESTADO DE ANTECEDENTES CRIMINAIS NADA CONSTA",
  "TJM/SP": "TRIBUNAL DE JUSTICA MILITAR DO ESTADO DE SAO PAULO CERTIDAO CRIMINAL NADA CONSTA",
  "Justica Eleitoral": "JUSTICA ELEITORAL CERTIDAO DE CRIMES ELEITORAIS NADA CONSTA",
};

describe("escopo da certidão", () => {
  it("as certidões que o processo exige passam", () => {
    for (const [nome, txt] of Object.entries(CRIMINAIS)) {
      expect(detectarEscopoCertidao(txt), nome).toBe("criminal");
    }
  });

  it("certidão puramente cível continua barrada", () => {
    expect(
      detectarEscopoCertidao(
        "TRIBUNAL DE JUSTICA DO ESTADO DE SAO PAULO CERTIDAO ESTADUAL DE DISTRIBUICOES CIVEIS NADA CONSTA",
      ),
    ).toBe("civel");
    expect(
      detectarEscopoCertidao(
        "TRIBUNAL REGIONAL FEDERAL DA 3A REGIAO CERTIDAO JUDICIAL CIVEL NADA CONSTA",
      ),
    ).toBe("civel");
  });

  it("documento que não é certidão nunca vira cível", () => {
    for (const [nome, txt] of Object.entries({
      Holerite: "DEMONSTRATIVO DE PAGAMENTO SALARIO BASE DESCONTOS INSS FGTS LIQUIDO A RECEBER",
      CNIS: "EXTRATO DE CONTRIBUICOES CNIS CADASTRO NACIONAL DE INFORMACOES SOCIAIS RELACOES PREVIDENCIARIAS",
      CTPS: "CARTEIRA DE TRABALHO DIGITAL DADOS PESSOAIS NOME CIVIL CPF CONTRATOS DE TRABALHO EMPREGADOR CNPJ RAIZ CARGO CBO ESOCIAL",
    })) {
      expect(detectarEscopoCertidao(txt), nome).not.toBe("civel");
    }
  });
});
