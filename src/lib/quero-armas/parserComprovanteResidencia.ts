// ============================================================================
// parserComprovanteResidencia.ts — PARSE-FIRST do comprovante de endereço
// ----------------------------------------------------------------------------
// Cópia canônica do parser determinístico DANF3E que vivia apenas em
// `supabase/functions/_shared/danf3eParser.ts`. Documento parseável NÃO vai
// para IA: o Hub Documental precisava do mesmo parser no cliente para ler
// titular, CPF, UC e endereço sem depender de leitura probabilística.
// Mantenha os dois arquivos em sincronia — qualquer regra nova entra aqui e lá.
// ============================================================================


export interface DanF3eEnderecoEntrega {
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  endereco_completo: string;
}

export interface DanF3eExtraido {
  detectado: boolean;
  empresa_emissora?: string;
  nome_titular?: string;
  cpf_titular?: string;
  uc?: string;              // unidade consumidora, apenas dígitos
  numero_nota?: string;
  mes_referencia?: string;  // YYYY-MM
  data_emissao?: string;    // YYYY-MM-DD
  data_vencimento?: string; // YYYY-MM-DD
  data_proxima_leitura?: string; // YYYY-MM-DD — calcula validade do comprovante
  endereco_entrega?: DanF3eEnderecoEntrega;
}

const MESES_PT: Record<string, string> = {
  jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06",
  jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12",
};

function parseDateBR(s: string): string | undefined {
  const m = s?.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return undefined;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseMesRefBR(s: string): string | undefined {
  const m = s?.trim().match(/^([a-zA-ZÇç]{3})[a-zA-ZÇç]*[\s\/]+(\d{4})$/i);
  if (!m) return undefined;
  const abbr = m[1].toLowerCase().replace(/[^a-z]/g, "");
  const mes = MESES_PT[abbr.slice(0, 3)];
  return mes ? `${m[2]}-${mes}` : undefined;
}

function extrairCepBR(s: string): string | undefined {
  const m = s.match(/\b(\d{5})-?(\d{3})\b/);
  return m ? m[1] + m[2] : undefined;
}

// Extrai logradouro / numero / complemento de uma linha de endereço
// Ex.: "RUA SEBASTIÃO VASCONCELOS FILHO 180 C APTO 22"
// Ex.: "AV PAULISTA 1000"
function parseLinhaLogradouro(linha: string): {
  logradouro?: string; numero?: string; complemento?: string;
} {
  linha = linha.trim();
  if (!linha) return {};
  // Número pode ser: "180 C" / "123" / "100-A" / "S/N"
  const m = linha.match(
    /^([\p{L}\d\s.,'-]{3,60}?)\s+(\d+(?:\s*[A-Za-z]|\s*-?\s*[A-Za-z])?)\s*([\s\S]*)$/u,
  );
  if (!m) return { logradouro: linha };
  return {
    logradouro: m[1].trim(),
    numero: m[2].trim(),
    complemento: m[3].trim() || undefined,
  };
}

function extrairEnderecoEntrega(texto: string): DanF3eEnderecoEntrega | undefined {
  // O bloco pode ser rotulado de várias formas (EDP, CPFL, Enel, Sabesp-energia...)
  const rxBloco =
    /ENDERE[ÇC]O\s*DE\s*(?:ENTREGA|CORRESPOND[ÊE]NCIA|FORNECIMENTO)\s*[:\-]?\s*\r?\n([\s\S]{10,500}?)(?=\r?\n(?:\r?\n|CLASSIFICA|REF\.?\s*M|NOTA\s*FISCAL|MEDIDOR|N[ºo]?\s*DO\s*MEDIDOR|UC\b|\d{44}|PRÓXIMA\s*LEITURA|VENCIMENTO)|\z)/i;

  const match = texto.match(rxBloco);
  if (!match) return undefined;

  const bloco = match[1];
  const linhas = bloco.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!linhas.length) return undefined;

  // Linha 0: logradouro + número + complemento
  const { logradouro, numero, complemento } = parseLinhaLogradouro(linhas[0]);

  // Restante: bairro, cidade/UF, CEP (podem vir em qualquer ordem)
  const restante = linhas.slice(1).join(" ");
  const cep = extrairCepBR(bloco);

  // "SÃO PAULO SP 02454-020" ou "SÃO PAULO - SP"
  const cidadeUfM = restante.match(
    /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]{1,30})\s+([A-Z]{2})(?:\s+\d{5})?/i,
  );
  const cidade = cidadeUfM?.[1]?.trim();
  const uf = cidadeUfM?.[2]?.trim();

  // Bairro: segunda linha se não contiver dígitos CEP e não for cidade/UF
  const bairro = linhas
    .slice(1)
    .find(
      (l) =>
        !/\b[A-Z]{2}\s*\d{5}/.test(l) &&
        !/\b\d{5}-\d{3}\b/.test(l) &&
        !cidadeUfM?.[0]?.includes(l),
    );

  const partes = [logradouro, numero, complemento].filter(Boolean).join(" ");
  const cidadeStr = [cidade, uf].filter(Boolean).join("/");
  const cepStr = cep ? cep.slice(0, 5) + "-" + cep.slice(5) : "";
  const endereco_completo = [partes, bairro, cidadeStr, cepStr]
    .filter(Boolean)
    .join(" - ");

  return { logradouro, numero, complemento, bairro, cidade, uf, cep, endereco_completo };
}

export function parseDanf3e(texto: string): DanF3eExtraido {
  const t = texto || "";
  const tUpper = t.toUpperCase();

  // ── Detecção: DANF3E ou variantes de concessionárias ──
  const detectado =
    /\bDANF3E\b/.test(tUpper) ||
    /NOTA FISCAL DE ENERGIA EL[ÉE]TRICA ELETR[ÔO]NICA/.test(tUpper) ||
    ((/EDP|CPFL|ENEL|ELEKTRO|LIGHT\s|COELBA|CELPE|CEMIG|COPEL|CELESC|COSERN|COELCE|EQUATORIAL/.test(tUpper)) &&
      /NOTA FISCAL/.test(tUpper) &&
      /UNIDADE CONSUMIDORA|UC[:\s]|C[OÓ]D(?:IGO)?\s*DE\s*INSTALA/.test(tUpper));

  if (!detectado) return { detectado: false };

  // ── Empresa emissora (primeira linha não vazia que contenha nome de distribuidora) ──
  const empresaM = t.match(
    /^.*(EDP[A-Z\s.]*|CPFL[A-Z\s.]*|ENEL[A-Z\s.]*|ELEKTRO[A-Z\s.]*|LIGHT\s[A-Z\s.]*|COELBA[A-Z\s.]*|CELPE[A-Z\s.]*|CEMIG[A-Z\s.]*|COPEL[A-Z\s.]*|CELESC[A-Z\s.]*|COSERN[A-Z\s.]*|COELCE[A-Z\s.]*|EQUATORIAL[A-Z\s.]*).*/im,
  );
  const empresa_emissora = empresaM?.[1]?.trim().slice(0, 100);

  // ── Número da Nota Fiscal ──
  const nfM = t.match(/NOTA\s*FISCAL\s*(?:N[ºo]|Nº)?\s*[:\-]?\s*([0-9][0-9.]{5,20})/i);
  const numero_nota = nfM ? nfM[1].replace(/\./g, "").trim() : undefined;

  // ── Nome do Titular ──
  // Padrões: "NOME: X", "NOME DO TITULAR: X", "CLIENTE: X", "CONSUMIDOR: X"
  const nomeM = t.match(
    /(?:NOME(?:\s+DO\s+TITULAR)?|CLIENTE|CONSUMIDOR|TITULUAR)\s*[:\-]\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s.'-]{4,80})/i,
  );
  const nome_titular = nomeM?.[1]?.replace(/\s+/g, " ").trim();

  // ── CPF do Titular ──
  const cpfM = t.match(/CPF\s*[:\-]?\s*(\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2})/i);
  const cpf_titular = cpfM ? cpfM[1].replace(/\D+/g, "") : undefined;

  // ── Unidade Consumidora (UC) ──
  let uc: string | undefined;
  // EDP SP: 0.000.XXX.XXX.XXX-XX (14 dígitos)
  const ucEdpM = t.match(/\b0[.,]?\s*0{3}[.,]?\s*\d{3}[.,]?\s*\d{3}[.,]?\s*\d{3}\s*-?\s*\d{2}\b/);
  if (ucEdpM) uc = ucEdpM[0].replace(/\D+/g, "");
  if (!uc) {
    // Rótulos genéricos
    const ucGenM = t.match(
      /(?:N[ºo]?\s*DA\s*UC|UNIDADE\s*CONSUMIDORA|C[ÓO]DIGO\s*DE\s*INSTALA[CÇ][ÃA]O|N[ºo]?\s*INSTALA[CÇ][ÃA]O|MATR[ÍI]CULA)\s*[:\-]?\s*([0-9][0-9.\-]{7,25})/i,
    );
    if (ucGenM) uc = ucGenM[1].replace(/\D+/g, "");
  }
  if (uc && uc.length < 8) uc = undefined;

  // ── Mês de Referência ──
  const mesM = t.match(
    /(?:M[ÊE]S\s*(?:DE\s*)?REFER[ÊE]NCIA|REFERENTE\s+A|M[ÊE]S\/ANO)\s*[:\-]?\s*([A-Za-zÇç]+[\s\/]+\d{4})/i,
  );
  const mes_referencia = mesM ? parseMesRefBR(mesM[1]) : undefined;

  // ── Data de Emissão ──
  const emissaoM = t.match(/DATA\s*(?:DE\s*)?EMISS[ÃA]O\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/i);
  const data_emissao = emissaoM ? parseDateBR(emissaoM[1]) : undefined;

  // ── Data de Vencimento ──
  const vencM = t.match(/VENCIMENTO\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/i);
  const data_vencimento = vencM ? parseDateBR(vencM[1]) : undefined;

  // ── Data da Próxima Leitura ──
  const proxM = t.match(/PR[ÓO]XIMA\s*LEITURA\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/i);
  const data_proxima_leitura = proxM ? parseDateBR(proxM[1]) : undefined;

  // ── Endereço de Entrega ──
  const endereco_entrega = extrairEnderecoEntrega(t);

  return {
    detectado,
    empresa_emissora,
    nome_titular,
    cpf_titular,
    uc,
    numero_nota,
    mes_referencia,
    data_emissao,
    data_vencimento,
    data_proxima_leitura,
    ...(endereco_entrega ? { endereco_entrega } : {}),
  };
}

/**
 * Formata os campos extraídos pelo parser como bloco de texto para injetar
 * no prompt da IA como contexto prioritário. A IA usa esses dados para
 * confirmar — não para re-extrair do zero.
 */
export function formatarContextoDanf3e(d: DanF3eExtraido): string {
  if (!d.detectado) return "";
  const L: string[] = [
    "╔══ PRÉ-EXTRAÇÃO DETERMINÍSTICA (DANF3E — parser regex) ══╗",
    "  Extraído diretamente da estrutura do PDF, sem IA.",
    "  Use estes valores como REFERÊNCIA PRIORITÁRIA para os campos correspondentes.",
    "  Se o documento não for uma conta de energia, ignore este bloco.",
    "",
  ];
  if (d.empresa_emissora) L.push(`  Empresa emissora : ${d.empresa_emissora}`);
  if (d.numero_nota)      L.push(`  Nota Fiscal Nº   : ${d.numero_nota}`);
  if (d.nome_titular)     L.push(`  Nome do titular  : ${d.nome_titular}`);
  if (d.cpf_titular)      L.push(`  CPF (dígitos)    : ${d.cpf_titular}`);
  if (d.uc)               L.push(`  UC/Instalação    : ${d.uc}  ← use como codigo_instalacao e numero_documento`);
  if (d.mes_referencia)   L.push(`  Mês referência   : ${d.mes_referencia}`);
  if (d.data_emissao)     L.push(`  Data emissão     : ${d.data_emissao}`);
  if (d.data_vencimento)  L.push(`  Vencimento fatura: ${d.data_vencimento}`);
  if (d.data_proxima_leitura) L.push(`  Próxima leitura  : ${d.data_proxima_leitura}  ← armazene em campos_complementares.data_proxima_leitura`);
  if (d.endereco_entrega) {
    const e = d.endereco_entrega;
    L.push("");
    L.push("  ┌─ ENDEREÇO DE ENTREGA (fonte AUTORITATIVA — ignore qualquer outro bloco de endereço) ─┐");
    if (e.logradouro)      L.push(`  │ Logradouro  : ${e.logradouro}`);
    if (e.numero)          L.push(`  │ Número      : ${e.numero}`);
    if (e.complemento)     L.push(`  │ Complemento : ${e.complemento}`);
    if (e.bairro)          L.push(`  │ Bairro      : ${e.bairro}`);
    if (e.cidade)          L.push(`  │ Cidade      : ${e.cidade}`);
    if (e.uf)              L.push(`  │ UF          : ${e.uf}`);
    if (e.cep)             L.push(`  │ CEP         : ${e.cep.slice(0, 5)}-${e.cep.slice(5)}`);
    L.push(`  │ Completo    : ${e.endereco_completo}`);
    L.push("  └──────────────────────────────────────────────────────────────────────────────────────┘");
  }
  L.push("╚═══════════════════════════════════════════════════════╝");
  return L.join("\n");
}
