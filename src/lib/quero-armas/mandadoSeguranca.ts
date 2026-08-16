// ============================================================================
// mandadoSeguranca — o caminho do juiz, depois que a via administrativa acaba
// ----------------------------------------------------------------------------
// QUANDO APARECE: só depois que o RECURSO é negado. Antes disso a via
// administrativa não se esgotou (Lei 9.784/99) e oferecer o juiz seria vender
// para o cliente um caminho que ele ainda não precisa — e que o juiz tende a
// devolver justamente por isso.
//
// É OPCIONAL, e a palavra importa. O cliente acabou de ser negado duas vezes;
// a última coisa que ele precisa é de uma tela que pareça exigir mais uma
// contratação. O convite aparece, explica o prazo, e fica quieto.
//
// PRAZO: 120 dias corridos do indeferimento do recurso (art. 23 da Lei
// 12.016/09). É DECADENCIAL — não para, não se suspende, e vencido não volta.
// A contagem já é feita pela engine de prazos (`prazosProcessuais`), que trata
// `data_indeferimento_recurso` com prioridade sobre qualquer prazo de 10 dias.
//
// POR QUE WHATSAPP E NÃO CHECKOUT: o serviço não está no catálogo de vendas e
// não tem cobrança montada. Mandar o cliente para um botão de pagar que não
// existe seria pior do que mandar para a conversa. Quando o serviço entrar no
// catálogo, troca-se o destino do botão e o resto desta tela continua igual.
// ============================================================================

/** Número da equipe, em formato internacional para o link do WhatsApp. */
export const WHATSAPP_EQUIPE = "5511978481919";

/**
 * As três frases que o cliente pode mandar. São EXATAMENTE as que a equipe
 * pediu: quem atende reconhece a intenção pela frase, sem precisar ler a
 * conversa inteira para descobrir o que a pessoa quer.
 */
export const FRASES_MS = [
  "Quero levar meu processo ao juiz",
  "Quero o mandado de segurança",
  "Quero falar com a equipe",
] as const;

export type FraseMS = (typeof FRASES_MS)[number];

/**
 * Link do WhatsApp com a frase já escrita.
 *
 * O contexto (protocolo/serviço) entra depois da frase, em linha separada, para
 * que a primeira linha continue sendo a frase limpa que a equipe reconhece.
 */
export function linkWhatsAppMS(
  frase: FraseMS | string,
  contexto?: { protocolo?: string | null; servico?: string | null; nome?: string | null },
): string {
  const linhas: string[] = [String(frase)];
  const detalhes: string[] = [];
  if (contexto?.nome) detalhes.push(contexto.nome);
  if (contexto?.servico) detalhes.push(contexto.servico);
  if (contexto?.protocolo) detalhes.push(`protocolo ${contexto.protocolo}`);
  if (detalhes.length) linhas.push(detalhes.join(" · "));
  return `https://wa.me/${WHATSAPP_EQUIPE}?text=${encodeURIComponent(linhas.join("\n"))}`;
}

/** Prazo decadencial do MS, em dias corridos (art. 23 da Lei 12.016/09). */
export const PRAZO_MS_DIAS = 120;

export interface JanelaMS {
  /** Data do indeferimento do recurso (ISO). */
  dataEvento: string;
  /** Último dia para impetrar (ISO). */
  dataLimite: string;
  /** Negativo quando já passou. */
  diasRestantes: number;
  /** `false` quando o prazo já venceu — o convite deixa de fazer sentido. */
  aberta: boolean;
}

/**
 * Calcula a janela do MS. Devolve `null` quando o recurso ainda não foi
 * negado — que é o mesmo que dizer "ainda não é hora de falar em juiz".
 */
export function janelaMandadoSeguranca(
  dataIndeferimentoRecurso: string | null | undefined,
  hojeISO: string,
): JanelaMS | null {
  const evento = normalizarISO(dataIndeferimentoRecurso);
  if (!evento) return null;
  const dataLimite = somarDias(evento, PRAZO_MS_DIAS);
  const diasRestantes = diffDias(hojeISO, dataLimite);
  return { dataEvento: evento, dataLimite, diasRestantes, aberta: diasRestantes >= 0 };
}

function normalizarISO(v: string | null | undefined): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

function somarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

function diffDias(de: string, ate: string): number {
  const [ay, am, ad] = de.split("-").map(Number);
  const [by, bm, bd] = ate.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}
