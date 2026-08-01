// ============================================================================
// parserCcmei.ts
// ----------------------------------------------------------------------------
// Parser local (sem IA) do CCMEI — Certificado da Condição de Microempreendedor
// Individual, emitido no Portal do Empreendedor / Receita Federal.
//
// Modelo treinado: cabeçalho "Certificado da Condição de Microempreendedor
// Individual", blocos Empresário(a) (Nome Civil + CPF), CNPJ + Data de Abertura,
// Nome Empresarial, Situação Cadastral Vigente, Endereço Comercial e o rodapé
// com o link de verificação https://mei.receita.economia.gov.br/certificado.
//
// Serve de base para o grupo de OCUPAÇÃO LÍCITA (renda_ccmei).
// ============================================================================

export interface CcmeiParseado {
  tipoDocumento: "renda_ccmei";
  nome_civil?: string;
  cpf?: string;
  cnpj?: string;
  nome_empresarial?: string;
  data_abertura?: string;      // ISO
  situacao_cadastral?: string; // ATIVA / BAIXADA / ...
  data_situacao?: string;      // ISO
  ocupacao_principal?: string;
  cnae_principal?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  autenticavel: boolean;       // rodapé oficial de verificação presente
}

function normalizar(t: string): string {
  return (t || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\r/g, "")
    .toUpperCase();
}

function isoDaData(br?: string | null): string | undefined {
  if (!br) return undefined;
  const m = br.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return undefined;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function depoisDoRotulo(texto: string, rotulo: RegExp, linhas = 3): string[] {
  const arr = texto.split("\n");
  const idx = arr.findIndex((l) => rotulo.test(l));
  if (idx < 0) return [];
  return arr.slice(idx + 1, idx + 1 + linhas).map((l) => l.trim()).filter(Boolean);
}

/** Marcadores que identificam o modelo oficial do CCMEI. */
export function ehCcmei(textoBruto: string): boolean {
  const t = normalizar(textoBruto);
  const titulo =
    t.includes("CERTIFICADO DA CONDICAO DE") && t.includes("MICROEMPREENDEDOR INDIVIDUAL");
  const rodape =
    t.includes("MEI.RECEITA.ECONOMIA.GOV.BR/CERTIFICADO") ||
    t.includes("ENQUADRADO NA CONDICAO DE MEI") ||
    t.includes("PERIODOS DE ENQUADRAMENTO COMO MEI");
  return titulo || (rodape && t.includes("CNPJ"));
}

/**
 * Lê o CCMEI. Devolve null quando o texto não é do modelo oficial — nesse caso
 * o fluxo segue para a IA normalmente.
 */
export function parseCcmei(textoBruto: string): CcmeiParseado | null {
  if (!ehCcmei(textoBruto)) return null;
  const t = normalizar(textoBruto);

  const cnpj = t.match(/\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/)?.[1];
  const cpf = t.match(/\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/)?.[1];
  const cep = t.match(/\b(\d{5}-\d{3})\b/)?.[1];

  // "CNPJ ... Data de Abertura" ficam na mesma linha de rótulos; os valores
  // vêm na linha seguinte, na mesma ordem.
  const linhaValoresCnpj = depoisDoRotulo(t, /^\s*CNPJ\b.*DATA DE ABERTURA/, 2)[0] ?? "";
  const dataAbertura =
    isoDaData(linhaValoresCnpj.match(/(\d{2}\/\d{2}\/\d{4})/)?.[1]) ??
    isoDaData(t.match(/DATA DE ABERTURA[\s\S]{0,80}?(\d{2}\/\d{2}\/\d{4})/)?.[1]);

  const nomeCivil = depoisDoRotulo(t, /NOME CIVIL/, 2)[0]?.replace(/\s{2,}.*$/, "").trim();
  const nomeEmpresarial = depoisDoRotulo(t, /NOME EMPRESARIAL/, 2)[0]?.trim();

  const linhaSituacao = depoisDoRotulo(t, /SITUACAO CADASTRAL VIGENTE/, 2)[0] ?? "";
  const situacao = linhaSituacao.match(/\b(ATIVA|BAIXADA|SUSPENSA|INAPTA|NULA)\b/)?.[1];
  const dataSituacao = isoDaData(linhaSituacao.match(/(\d{2}\/\d{2}\/\d{4})/)?.[1]);

  const ocupacao = depoisDoRotulo(t, /OCUPACAO PRINCIPAL/, 2)[0]?.trim();
  const cnae = depoisDoRotulo(t, /ATIVIDADE PRINCIPAL \(CNAE\)/, 2)[0]?.trim();

  const linhaEndereco = depoisDoRotulo(t, /^BAIRRO\b.*MUNICIPIO/, 2)[0] ?? "";
  const partes = linhaEndereco.split(/\s{2,}/).map((p) => p.trim()).filter(Boolean);
  const uf = partes.length ? partes[partes.length - 1].match(/^[A-Z]{2}$/)?.[0] : undefined;
  const municipio = partes.length >= 2 ? partes[partes.length - 2] : undefined;

  return {
    tipoDocumento: "renda_ccmei",
    nome_civil: nomeCivil,
    cpf,
    cnpj,
    nome_empresarial: nomeEmpresarial,
    data_abertura: dataAbertura,
    situacao_cadastral: situacao,
    data_situacao: dataSituacao,
    ocupacao_principal: ocupacao,
    cnae_principal: cnae,
    municipio,
    uf,
    cep,
    autenticavel: t.includes("MEI.RECEITA.ECONOMIA.GOV.BR/CERTIFICADO"),
  };
}
