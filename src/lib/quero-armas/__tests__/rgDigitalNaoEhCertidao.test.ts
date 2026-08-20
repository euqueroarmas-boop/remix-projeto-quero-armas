/**
 * CASO REAL (20/08/2026): o RG DIGITAL de São Paulo era recusado no slot de
 * identidade ("não aceita o RG digital"). Causa: o detector de órgãos
 * classificava qualquer documento com o timbre "IIRGD / Ricardo Gumbleton
 * Daunt" como CERTIDÃO DE ANTECEDENTES — mas o IIRGD é o instituto de
 * identificação, que emite também o próprio RG. O RG Digital caía como
 * "antecedentes criminais" e o Hub recusava por tipo incorreto.
 *
 * O texto abaixo é a camada de texto REAL do PDF do RG Digital (app SSP-SP,
 * assinado ICP-Brasil, com QR de validação no iti.gov.br).
 */
import { describe, expect, it } from "vitest";
import { identificarOrgao, parseCertidao } from "../parsersCertidoes";
import { avaliarPdfIdentidade } from "../identidadePdfQrCode";

const TEXTO_RG_DIGITAL = `Você também pode escanear o Código QR ao lado

Esse é um arquivo assinado digitalmente pela Secretaria de Segurança Pública do estado de São
Paulo em conformidade com o padrão de Assinatura Digital ICP Brasil. Caso necessite acesse
https://validar.iti.gov.br e faça o upload desse documento para aferir a sua conformidade.
.

Departamento de Inteligência da Polícia Civil - DIPOL
Instituto de Identificação Ricardo Gumbleton Daunt - IIRGD

POLÍCIA CIVIL DO ESTADO DE SÃO PAULO
SECRETARIA DE SEGURANÇA PÚBLICA`;

const TEXTO_ATESTADO_IIRGD = `SECRETARIA DE SEGURANÇA PÚBLICA
POLÍCIA CIVIL DO ESTADO DE SÃO PAULO
Instituto de Identificação Ricardo Gumbleton Daunt - IIRGD
ATESTADO DE ANTECEDENTES CRIMINAIS
Nome: FULANO DE TAL
Data de Nascimento: 01/01/1980
NADA CONSTA`;

describe("RG Digital SP não é certidão de antecedentes", () => {
  it("o detector de órgãos NÃO classifica o RG Digital como iirgd", () => {
    expect(identificarOrgao(TEXTO_RG_DIGITAL)).toBeNull();
    expect(parseCertidao(TEXTO_RG_DIGITAL)).toBeNull();
  });

  it("a trava de identidade ACEITA o RG Digital (QR + características de RG)", () => {
    const v = avaliarPdfIdentidade(TEXTO_RG_DIGITAL);
    expect(v.ok).toBe(true);
    expect(v.temQr).toBe(true);
    expect(v.tipoDetectado).toBe("rg_com_cpf");
  });

  it("o ATESTADO de antecedentes do mesmo IIRGD continua sendo certidão", () => {
    expect(identificarOrgao(TEXTO_ATESTADO_IIRGD)).toBe("iirgd");
  });
});
