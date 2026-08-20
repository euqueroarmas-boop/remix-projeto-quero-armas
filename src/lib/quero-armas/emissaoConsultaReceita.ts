/**
 * EMISSÃO DE CONSULTAS DA RECEITA FEDERAL (cartão CNPJ, QSA e afins).
 *
 * Esses documentos são CONSULTAS geradas na hora do download: a data de
 * emissão é a do rodapé "Emitido no dia DD/MM/AAAA". O layout, porém, imprime
 * em destaque a DATA DE ABERTURA e a DATA DA SITUAÇÃO CADASTRAL da empresa —
 * e quando o parser local não roda (PDF sem camada de texto, worker do pdf.js
 * fora do ar) a IA já devolveu a abertura como se fosse a emissão. Com a regra
 * "validade = emissão + 30 dias", um cartão de empresa aberta em 2008 nascia
 * VENCIDO em 2008, era gravado assim no Hub e contaminava o QSA por herança.
 *
 * Este módulo é a guarda determinística: emissão implausível é descartada
 * (fica melhor SEM data — que vira presunção/confirmação humana — do que com
 * uma data que reprova o documento sozinha).
 */
import { hojeISOBRT } from "./validadeDocumento";

const TIPOS_CONSULTA_RECEITA = new Set([
  "renda_cartao_cnpj",
  "cartao_cnpj_mei",
  "renda_cnpj_autonomo",
  "cartao_cnpj",
  "renda_qsa",
  "qsa",
]);

export function isConsultaReceita(tipo?: string | null): boolean {
  return TIPOS_CONSULTA_RECEITA.has(String(tipo || "").trim().toLowerCase());
}

/**
 * Idade máxima plausível (em dias) para a emissão de uma consulta da Receita
 * no momento em que o cliente a envia. A validade oficial é 30 dias; 60 dá
 * folga para reenvio de arquivo antigo sem deixar passar a data de abertura,
 * que erra por anos, não por semanas.
 */
export const EMISSAO_CONSULTA_RECEITA_MAX_DIAS = 60;

function paraIso(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const raw = valor.trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

function diasDesde(iso: string, hojeIso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const [hy, hm, hd] = hojeIso.split("-").map(Number);
  return Math.round((Date.UTC(hy, hm - 1, hd) - Date.UTC(y, m - 1, d)) / 86400000);
}

/**
 * Sanea a data de emissão vinda da IA para um documento de consulta da
 * Receita. Devolve a emissão em ISO quando plausível; `null` quando ela deve
 * ser DESCARTADA:
 *
 *  - é igual à data de abertura ou à data da situação cadastral extraídas
 *    do mesmo documento (leitura trocada, o caso clássico);
 *  - está a mais de {@link EMISSAO_CONSULTA_RECEITA_MAX_DIAS} dias no passado
 *    (consulta é impressa na hora — emissão de anos atrás é leitura errada);
 *  - está no futuro (mais de 1 dia à frente do hoje de Brasília).
 *
 * Tipos que não são consulta da Receita passam direto, sem julgamento.
 */
export function sanearEmissaoConsultaReceita(
  tipo: string | null | undefined,
  emissao: unknown,
  campos?: Record<string, unknown> | null,
  ref: Date = new Date(),
): string | null {
  const iso = paraIso(emissao);
  if (!iso) return null;
  if (!isConsultaReceita(tipo)) return iso;
  const abertura = paraIso(campos?.["data_abertura"]);
  const situacao = paraIso(campos?.["data_situacao_cadastral"] ?? campos?.["data_situacao"]);
  if (abertura && iso === abertura) return null;
  if (situacao && iso === situacao) return null;
  const idade = diasDesde(iso, hojeISOBRT(ref));
  if (idade > EMISSAO_CONSULTA_RECEITA_MAX_DIAS) return null;
  if (idade < -1) return null;
  return iso;
}
