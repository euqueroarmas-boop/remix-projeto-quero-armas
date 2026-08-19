// ============================================================================
// somentePdfOriginal.ts
// ----------------------------------------------------------------------------
// Regra canônica (03/08/2026): em NENHUMA fase do processo se aceita print,
// foto de tela ou "scan" de documento. Todo documento entra como PDF ORIGINAL
// emitido pelo órgão/emissor.
//
// ÚNICA exceção: a FOTO 3x4 do titular — que por natureza é uma imagem e pode
// ser reenquadrada pelo cliente e enviada como arquivo de imagem (JPG/PNG).
// ============================================================================

/** Tipos que aceitam arquivo de imagem (a foto do titular e nada mais). */
const TIPOS_IMAGEM_PERMITIDA = new Set<string>([
  "foto_3x4",
  "foto",
  "foto_titular",
  "fotografia",
  // Identidade funcional é um cartão físico da corporação: não existe PDF
  // original emitido por site. Vale a imagem da frente e do verso (ou o PDF
  // exportado do app funcional, quando houver).
  "renda_carteira_funcional",
  "identidade_funcional",
  "identidade_funcional_digital",
]);

export function tipoAceitaImagem(tipo: string | null | undefined): boolean {
  const t = String(tipo || "").toLowerCase().trim();
  if (!t) return false;
  if (TIPOS_IMAGEM_PERMITIDA.has(t)) return true;
  // Cobre variações do catálogo: "foto_3x4_titular", "foto 3x4" etc.
  return /^foto([_\s-]|$)/.test(t) || t.includes("3x4");
}

export const MSG_SOMENTE_PDF_ORIGINAL =
  "Só aceitamos o PDF ORIGINAL emitido pelo órgão. Foto, print ou digitalização do documento não são aceitos em nenhuma fase do processo. Baixe o arquivo em PDF no site do emissor e anexe aqui.";

export const MSG_FOTO_SOMENTE_IMAGEM =
  "Para a foto 3x4 envie um arquivo de imagem (JPG ou PNG) já reenquadrado.";

/**
 * SEGUNDA exceção (18/08/2026): o XML da nota fiscal.
 *
 * Não é uma flexibilização da regra — é a aplicação dela. Quem tem valor
 * fiscal é o XML assinado e autorizado pela SEFAZ; o DANFE em PDF é só o
 * "Documento Auxiliar", uma representação impressa. O XML é MAIS original que
 * o PDF, não menos.
 *
 * Entrou porque o DANFE salvo pelo botão "Compartilhar" do celular chega sem
 * camada de texto — arquivo legítimo que nenhum leitor consegue abrir — e o
 * cliente ficava travado sem ter errado nada. Recebendo o XML, o Hub gera o
 * DANFE com texto de verdade (`danfePdfDoXml`) e segue o fluxo normal.
 *
 * A trava real não está no seletor de arquivo e sim no parser: XML que não for
 * nota fiscal autorizada em produção é recusado com o motivo na tela.
 */
export const ACCEPT_XML_NOTA_FISCAL = "text/xml,application/xml,.xml";

/**
 * O slot é de nota fiscal? Só nele o XML tem serventia — e só nele a tela pode
 * dizer ao cliente que o XML serve.
 *
 * Existe porque, sem isso, a instrução da tela continuava dizendo apenas
 * "Anexe o PDF ORIGINAL": a função de importar o XML estava pronta e NENHUM
 * texto avisava o cliente de que ela existia. Foi o que aconteceu em 19/08 —
 * o cliente ficou tentando o PDF porque era o que a tela mandava fazer.
 */
export function tipoAceitaXmlNotaFiscal(tipo: string | null | undefined): boolean {
  const t = String(tipo || "").toLowerCase().trim();
  if (!t) return false;
  return t.includes("nota_fiscal") || /(^|_)nf(_|$)/.test(t);
}

/** Instrução do topo do Hub, conforme o que o slot aceita. */
export function instrucaoAnexoPorTipo(tipo: string | null | undefined): string {
  if (tipoAceitaImagem(tipo)) {
    return "Envie a foto 3x4 já reenquadrada (JPG ou PNG) — a leitura automática confere e preenche os campos. Você só revisa antes de salvar.";
  }
  if (tipoAceitaXmlNotaFiscal(tipo)) {
    return (
      "Anexe o PDF ORIGINAL da nota — ou, melhor ainda, o arquivo XML que o emissor gera junto com ela: " +
      "com o XML nós montamos o DANFE aqui, e a leitura sai exata. Print, foto ou digitalização não são aceitos."
    );
  }
  return "Anexe o PDF ORIGINAL emitido pelo órgão — print, foto ou digitalização não são aceitos. A leitura automática identifica o tipo e preenche os campos; você só revisa antes de salvar.";
}

/**
 * Recusa de arquivo que não é PDF. No slot de nota fiscal a mensagem aponta a
 * saída que o cliente tem na mão: o XML.
 */
export function mensagemSomentePdf(tipo: string | null | undefined): string {
  if (tipoAceitaXmlNotaFiscal(tipo)) {
    return (
      "Este arquivo não é um PDF. Na nota fiscal você pode anexar o PDF ORIGINAL da nota OU o arquivo XML " +
      "(terminado em .xml) que o emissor gera junto com ela. Foto, print ou digitalização não são aceitos."
    );
  }
  return MSG_SOMENTE_PDF_ORIGINAL;
}

/** `accept` do <input type="file"> conforme o tipo de documento. */
export function acceptPorTipo(tipo: string | null | undefined): string {
  if (tipoAceitaImagem(tipo)) return "image/jpeg,image/png,image/webp";
  return `application/pdf,${ACCEPT_XML_NOTA_FISCAL}`;
}
