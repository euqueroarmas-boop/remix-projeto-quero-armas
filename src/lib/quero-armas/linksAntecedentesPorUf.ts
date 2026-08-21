// ============================================================================
// linksAntecedentesPorUf.ts
// ----------------------------------------------------------------------------
// Catálogo de links oficiais de emissão de antecedentes criminais por UF.
// O cérebro do sistema resolve a UF do cliente (via cadastro/comprovante de
// endereço) e injeta o link correto do TJ estadual, Polícia Civil e TRF
// regional no popup guiado — nunca mais link fixo de SP para clientes de
// outros estados.
//
// Regras:
// - Certidões FEDERAIS uniformes (STM/TSE) não entram aqui — os links delas
//   ficam no `qa_servicos_documentos` global e não dependem de UF.
// - Se a UF não estiver mapeada, `getLinksAntecedentesPorUf` devolve `null`
//   e o popup mantém o texto/link genérico existente.
// ============================================================================

import { UFS_BR } from "@/lib/quero-armas/localidadesBr";

export interface LinksAntecedentesUf {
  uf: string;
  /** Portal de Certidão de Distribuição Criminal do TJ estadual. */
  tj?: string;
  /** Portal de Atestado de Antecedentes da Polícia Civil estadual. */
  policiaCivil?: string;
  /** TJM estadual (só existe em SP, MG e RS). */
  tjm?: string;
  /** TRF regional correspondente. */
  trfRegional?: string;
  /** Sigla do TRF regional (TRF1..TRF6) para uso no título. */
  trfSigla?: string;
}

// Mapa UF → TRF regional (Justiça Federal).
// TRF1: DF, MG, GO, MT, TO, BA, PI, MA, PA, AM, AC, RO, RR, AP
// TRF2: RJ, ES
// TRF3: SP, MS
// TRF4: RS, SC, PR
// TRF5: PE, CE, AL, SE, PB, RN
// TRF6: MG (desde 2022 — MG saiu do TRF1)
const TRF_POR_UF: Record<string, { sigla: string; url: string }> = {
  AC: { sigla: "TRF1", url: "https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/" },
  AP: { sigla: "TRF1", url: "https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/" },
  AM: { sigla: "TRF1", url: "https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/" },
  BA: { sigla: "TRF1", url: "https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/" },
  DF: { sigla: "TRF1", url: "https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/" },
  GO: { sigla: "TRF1", url: "https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/" },
  MA: { sigla: "TRF1", url: "https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/" },
  MT: { sigla: "TRF1", url: "https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/" },
  PA: { sigla: "TRF1", url: "https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/" },
  PI: { sigla: "TRF1", url: "https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/" },
  RO: { sigla: "TRF1", url: "https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/" },
  RR: { sigla: "TRF1", url: "https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/" },
  TO: { sigla: "TRF1", url: "https://portal.trf1.jus.br/portaltrf1/servicos/certidoes/certidao-negativa/" },
  RJ: { sigla: "TRF2", url: "https://www10.trf2.jus.br/portal/certidoes/" },
  ES: { sigla: "TRF2", url: "https://www10.trf2.jus.br/portal/certidoes/" },
  SP: { sigla: "TRF3", url: "https://web.trf3.jus.br/certidao-regional/CertidaoCivelEleitoralCriminal/SolicitarDadosCertidao" },
  MS: { sigla: "TRF3", url: "https://web.trf3.jus.br/certidao-regional/CertidaoCivelEleitoralCriminal/SolicitarDadosCertidao" },
  RS: { sigla: "TRF4", url: "https://www2.trf4.jus.br/trf4/controlador.php?acao=pagina_visualizar&id_pagina=1471" },
  SC: { sigla: "TRF4", url: "https://www2.trf4.jus.br/trf4/controlador.php?acao=pagina_visualizar&id_pagina=1471" },
  PR: { sigla: "TRF4", url: "https://www2.trf4.jus.br/trf4/controlador.php?acao=pagina_visualizar&id_pagina=1471" },
  PE: { sigla: "TRF5", url: "https://www.trf5.jus.br/index.php/servicos-do-cidadao/certidoes" },
  CE: { sigla: "TRF5", url: "https://www.trf5.jus.br/index.php/servicos-do-cidadao/certidoes" },
  AL: { sigla: "TRF5", url: "https://www.trf5.jus.br/index.php/servicos-do-cidadao/certidoes" },
  SE: { sigla: "TRF5", url: "https://www.trf5.jus.br/index.php/servicos-do-cidadao/certidoes" },
  PB: { sigla: "TRF5", url: "https://www.trf5.jus.br/index.php/servicos-do-cidadao/certidoes" },
  RN: { sigla: "TRF5", url: "https://www.trf5.jus.br/index.php/servicos-do-cidadao/certidoes" },
  MG: { sigla: "TRF6", url: "https://portal.trf6.jus.br/servicos/certidoes/" },
};

// Portais estaduais (TJ + Polícia Civil). Cobre as 27 UFs; onde a PC não
// oferece emissão online oficial, aponta para o portal institucional.
const CATALOGO: Record<string, LinksAntecedentesUf> = {
  AC: { uf: "AC", tj: "https://www.tjac.jus.br/servicos/certidoes/", policiaCivil: "https://www.pc.ac.gov.br/" },
  AL: { uf: "AL", tj: "https://www2.tjal.jus.br/certidaoOnline/", policiaCivil: "https://policiacivil.al.gov.br/servicos/atestado-de-antecedentes-criminais" },
  AP: { uf: "AP", tj: "https://tucujuris.tjap.jus.br/", policiaCivil: "https://www.policiacivil.ap.gov.br/" },
  AM: { uf: "AM", tj: "https://consultasaj.tjam.jus.br/sco/abrirCadastro.do", policiaCivil: "https://www.pc.am.gov.br/atestado-de-antecedentes-criminais/" },
  BA: { uf: "BA", tj: "http://esaj.tjba.jus.br/sco/abrirCadastro.do", policiaCivil: "https://servicos.policiacivil.ba.gov.br/atestado-de-antecedentes/" },
  CE: { uf: "CE", tj: "https://esaj.tjce.jus.br/sco/abrirCadastro.do", policiaCivil: "https://www.pc.ce.gov.br/servicos/atestado-de-antecedentes-criminais/" },
  DF: { uf: "DF", tj: "https://cnc.tjdft.jus.br/", policiaCivil: "https://www.pcdf.df.gov.br/servicos/atestado-de-antecedentes-criminais" },
  ES: { uf: "ES", tj: "https://sistemas.tjes.jus.br/certidaonegativa/sistemas/certidaonegativa/CERTIDAOPESQUISA.cfm", policiaCivil: "https://pc.es.gov.br/atestado-de-antecedentes-criminais" },
  GO: { uf: "GO", tj: "https://www.tjgo.jus.br/index.php/servicos/certidoes", policiaCivil: "https://www.policiacivil.go.gov.br/" },
  MA: { uf: "MA", tj: "https://www.tjma.jus.br/servicos/certidoes-online", policiaCivil: "https://www.pc.ma.gov.br/" },
  MT: { uf: "MT", tj: "https://cia.tjmt.jus.br/publico/CartaoDeCredito", policiaCivil: "https://www.pjc.mt.gov.br/atestado-de-antecedentes" },
  MS: { uf: "MS", tj: "https://esaj.tjms.jus.br/sco/abrirCadastro.do", policiaCivil: "https://www.pc.ms.gov.br/" },
  MG: { uf: "MG", tj: "https://www8.tjmg.jus.br/juridico/certidaoJudicial/publico/formConsultaAntecedentes.jsf", policiaCivil: "https://atestado.policiacivil.mg.gov.br/", tjm: "https://www.tjmmg.jus.br/index.php/servicos/certidoes" },
  PA: { uf: "PA", tj: "https://consultas.tjpa.jus.br/certidaoportalexterno/", policiaCivil: "https://www.policiacivil.pa.gov.br/servicos/atestado-de-antecedentes-criminais/" },
  PB: { uf: "PB", tj: "https://app.tjpb.jus.br/certidaoonline/pages/publico/consulta-registro-solicitacao.xhtml", policiaCivil: "https://www.policiacivil.pb.gov.br/" },
  PR: { uf: "PR", tj: "https://portal.tjpr.jus.br/certidoes/publico/consultaSolicitacao.do", policiaCivil: "https://www.policiacivil.pr.gov.br/servicos/atestado-de-antecedentes-criminais" },
  PE: { uf: "PE", tj: "https://portaltjpe.tjpe.jus.br/servicos/certidoes/certidao-judicial", policiaCivil: "https://antecedentes.policiacivil.pe.gov.br/" },
  PI: { uf: "PI", tj: "https://www.tjpi.jus.br/certidoesonline/", policiaCivil: "https://www.pc.pi.gov.br/" },
  RJ: { uf: "RJ", tj: "https://www3.tjrj.jus.br/certidoeseletronicas/publico/solicitacao/incluir", policiaCivil: "https://portalservicos.policiacivilrj.net.br/" },
  RN: { uf: "RN", tj: "https://www.tjrn.jus.br/index.php/servicos/certidoes", policiaCivil: "https://www.pc.rn.gov.br/" },
  RS: { uf: "RS", tj: "https://www.tjrs.jus.br/novo/servicos-e-consultas/certidoes/", policiaCivil: "https://ww4.pc.rs.gov.br/pcnet-fs-web/", tjm: "https://www.tjmrs.jus.br/servicos/certidoes" },
  RO: { uf: "RO", tj: "https://webapp.tjro.jus.br/certidao/pages/certidao/emissaoCertidao.xhtml", policiaCivil: "https://www.pc.ro.gov.br/" },
  RR: { uf: "RR", tj: "https://certidao.tjrr.jus.br/", policiaCivil: "https://www.pc.rr.gov.br/" },
  SC: { uf: "SC", tj: "https://esaj.tjsc.jus.br/sco/abrirCadastro.do", policiaCivil: "https://www.pc.sc.gov.br/servicos/atestado-de-antecedentes" },
  SP: { uf: "SP", tj: "https://esaj.tjsp.jus.br/sco/abrirCadastro.do", policiaCivil: "https://servicos.sp.gov.br/fcarta/259d189e-dc87-4308-9812-7abed7494412", tjm: "https://certidaocriminal.tjmsp.jus.br/" },
  SE: { uf: "SE", tj: "https://www.tjse.jus.br/portal/servicos/certidoes-1", policiaCivil: "https://www.ssp.se.gov.br/" },
  TO: { uf: "TO", tj: "https://wwa.tjto.jus.br/certidaonada/", policiaCivil: "https://www.policiacivil.to.gov.br/" },
};

/**
 * Devolve os links oficiais de antecedentes para a UF do cliente.
 * Retorna `null` se a UF não for válida — nesse caso o popup mantém o
 * texto/link genérico estático.
 */
/**
 * Sigla da UF a partir de sigla OU nome por extenso, com ou sem acento.
 * O cadastro grava o estado dos dois jeitos ("PR" e "Paraná"), e sem esta
 * normalização o resto do módulo tratava "Paraná" como UF desconhecida (links
 * de SP continuavam valendo) e escrevia rótulos como "TJPARANÁ".
 * Espelha `qa_uf_normalizar` no banco.
 */
export function normalizarUf(uf: string | null | undefined): string | null {
  if (!uf) return null;
  const bruto = String(uf).trim();
  if (!bruto) return null;
  const semAcento = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const alvo = semAcento(bruto);
  const achado = UFS_BR.find(
    (u) => u.sigla.toLowerCase() === alvo || semAcento(u.nome) === alvo,
  );
  return achado?.sigla ?? null;
}

export function getLinksAntecedentesPorUf(uf: string | null | undefined): LinksAntecedentesUf | null {
  const key = normalizarUf(uf);
  if (!key) return null;
  const base = CATALOGO[key];
  if (!base) return null;
  const trf = TRF_POR_UF[key];
  return {
    ...base,
    trfRegional: trf?.url,
    trfSigla: trf?.sigla,
  };
}

/**
 * Dado o `rawTipo` de uma pendência de antecedente e a UF do cliente,
 * decide qual link específico usar (Polícia Civil, TJ estadual, TJM, TRF).
 * Retorna `null` quando o tipo não é state-aware (ex.: TSE, STM) ou quando
 * a UF não estiver no catálogo.
 */
export function resolveLinkAntecedentePorUf(
  rawTipo: string | null | undefined,
  uf: string | null | undefined,
): string | null {
  if (!rawTipo || !uf) return null;
  const t = String(rawTipo).trim().toLowerCase();
  const links = getLinksAntecedentesPorUf(uf);
  if (!links) return null;

  // Certidões da UNIÃO: valem para o país inteiro e não têm link por estado.
  // Este guarda vem PRIMEIRO porque `antecedentes_militar` (STM) casaria com a
  // regra do TJM logo abaixo se dependesse só de "militar".
  if (t === "antecedentes_militar" || t === "antecedentes_eleitoral") {
    return null;
  }
  // Polícia Civil estadual.
  if (
    t === "antecedentes_criminais" || // código canônico do catálogo
    t.startsWith("certidao_antecedentes_policia_civil") ||
    t === "atestado_antecedentes_pc"
  ) {
    return links.policiaCivil ?? null;
  }
  // TJM estadual (só SP/MG/RS).
  //
  // `certidao_estadual_justica_militar` é apelido legado do TJM e PRECISA vir
  // antes do bloco do TJ estadual: lá embaixo o prefixo `certidao_estadual_`
  // o capturaria e devolveria o link do Tribunal de Justiça comum.
  if (
    t === "antecedentes_militar_estadual" || // código canônico do catálogo
    t === "certidao_estadual_justica_militar" || // apelido legado
    t.includes("tjm") ||
    t === "certidao_antecedentes_criminais_militar_estadual"
  ) {
    return links.tjm ?? null;
  }
  // TRF: regional e Seção Judiciária/JEF saem do MESMO portal do TRF da região,
  // mudando a opção de abrangência.
  if (
    t === "antecedentes_federal_trf3_regional" || // códigos canônicos do catálogo
    t === "antecedentes_federal_sjsp_jef" ||
    t.includes("trf") ||
    t === "certidao_antecedentes_criminais_federal"
  ) {
    return links.trfRegional ?? null;
  }
  // TJ estadual (distribuição, execuções, ações criminais).
  //
  // IGUALDADE EXATA, nunca prefixo: `antecedentes_estadual_<uf>` são os 27
  // códigos do cofre, que existem para guardar certidão de OUTRO estado
  // (residência anterior). Casá-los aqui devolveria o link do estado atual do
  // cliente para uma certidão de Minas. Espelha o lado SQL, que também casa
  // só os dois códigos do catálogo.
  if (
    t === "antecedentes_estadual_distribuicao" || // códigos canônicos do catálogo
    t === "antecedentes_estadual_execucoes" ||
    t.startsWith("certidao_tjsp") || // legado — inclui variantes
    t.startsWith("certidao_estadual_") ||
    t === "certidao_antecedentes_criminais_estadual" ||
    t === "certidao_distribuicao_criminal_estadual" ||
    t === "certidao_execucoes_criminais_estadual"
  ) {
    return links.tj ?? null;
  }
  return null;
}

/**
 * Reescreve o título/observação de uma explicação para refletir o estado
 * do cliente (ex.: "TJSP" → "TJ<UF>", "Polícia Civil/SP" → "Polícia Civil/<UF>").
 * Conservador: só troca strings que sabidamente citam SP hardcoded.
 */
export function aplicarUfEmTexto(texto: string, uf: string | null | undefined): string {
  if (!texto) return texto;
  // Normaliza ANTES de usar: o cadastro guarda o estado ora como sigla ("PR"),
  // ora por extenso ("Paraná"). Sem isto o texto saía "TJPARANÁ".
  const U = normalizarUf(uf);
  if (!U || U === "SP") return texto;

  // ── TRF: trocar o NÚMERO da região, não a sigla ────────────────────────
  //
  // Os textos foram escritos com "TRF3" e "3ª Região" fixos, porque São Paulo
  // foi o primeiro estado. Para um cliente da Bahia isso manda emitir no
  // tribunal errado — os processos federais dele correm no TRF1 e não
  // aparecem numa certidão do TRF3.
  //
  // Regra do usuário (31/07/2026): a certidão segue o ENDEREÇO do cliente, e
  // o sistema já sabe qual tribunal é o dele. Então aqui não se generaliza
  // para "sua região": mostra-se o número certo.
  //
  // MS fica de fora do `if` acima só por acaso (é TRF3 como SP); a troca
  // abaixo é inofensiva nesse caso porque o número resultante é o mesmo.
  const regiao = Number(String(TRF_POR_UF[U]?.sigla ?? "").replace(/\D/g, "")) || null;
  const comTrf = regiao
    ? texto
        // Ordem importa: a forma COMPLETA primeiro. Sem isto, "TRF 3ª Região"
        // virava "TRF1ª Região" — a regra do número solto casava antes e
        // engolia o espaço.
        .replace(/TRF\s*-?\s*3\s*ª\s*Região/g, `TRF ${regiao}ª Região`)
        .replace(/TRF\s*-?\s*3\s*a\s*Regiao/g, `TRF ${regiao}a Regiao`)
        .replace(/\b3ª\s*Região\b/g, `${regiao}ª Região`)
        .replace(/\b3a\s*Regiao\b/g, `${regiao}a Regiao`)
        // Lookahead: nao mexer quando ja veio "TRF 3ª Região" da regra acima —
        // senao o espaco some e vira "TRF3ª Região" (aparecia em SP e MS, que
        // sao TRF3 e por isso passavam pelas duas regras).
        .replace(/TRF\s*-?\s*3\b(?!\s*[ªa]\s*Regi)/g, `TRF${regiao}`)
        // "em SP, é o TRF3" vira "em BA, é o TRF1" — o estado citado também
        // precisa acompanhar, senão o texto fica contraditório.
        .replace(/\bem SP\b/g, `em ${U}`)
    : texto;

  const tj = U === "DF" ? "TJDFT" : `TJ${U}`;

  return comTrf
    // Formas NEUTRAS ganham nome e sobrenome quando a UF é conhecida. Elas
    // existem porque os avisos de vencimento também saem por e-mail, onde não
    // há UF para resolver — lá a frase neutra é a que vale.
    .replace(/portal do Tribunal de Justiça do seu estado/g, `portal do ${tj}`)
    .replace(/Tribunal de Justiça do seu estado/g, tj)
    .replace(/portal do TRF da sua região/g, regiao ? `portal do TRF${regiao}` : "portal do TRF da sua região")
    .replace(/TRF da sua região/g, regiao ? `TRF${regiao}` : "TRF da sua região")
    .replace(/Seção Judiciária\/JEF do seu estado/g, `Seção Judiciária/JEF de ${U}`)
    // No Distrito Federal o tribunal é o TJDFT, não "TJDF".
    .replace(/TJSP/g, tj)
    // Tribunal de Justiça Militar estadual só existe em SP, MG e RS. Fora
    // desses três não se inventa "TJ Militar/PR": o texto fica como está,
    // porque a exigência nem chega a ser pedida a esse cliente.
    .replace(/TJM-SP/g, U === "MG" ? "TJM-MG" : U === "RS" ? "TJM-RS" : "TJM-SP")
    .replace(/Polícia Civil\/SP/g, `Polícia Civil/${U}`)
    .replace(/Polícia Civil de SP/g, `Polícia Civil/${U}`)
    .replace(/\be-SAJ do TJSP\b/g, `portal do TJ${U}`)
    .replace(/\be-SAJ\b/g, `portal do TJ${U}`);
}