// ============================================================================
// vigenciaDossie — nenhum documento vencido entra no dossiê
// ----------------------------------------------------------------------------
// Regra da equipe (16/08/2026): não existe juntada com documento vencido. Se um
// documento venceu enquanto o processo era montado, ele volta a ser pendência
// no pop-up guiado, na ordem dos grupos, e o cliente reenvia antes de qualquer
// coisa seguir.
//
// POR QUE ISSO É CRÍTICO: certidão de antecedentes e comprovante de residência
// vivem ~30 dias. Um processo que demora dois meses juntando laudo e exame de
// tiro chega no protocolo com metade da papelada fora do prazo. Entregar assim
// não é economia de tempo — é exigência garantida, mais 10 dias de prazo e todo
// o dossiê refeito. Foi exatamente por certidão faltante/irregular que um dos
// indeferimentos reais derrubou o requisito do art. 10, §1º, II.
//
// A conta usa a data JÁ PERSISTIDA (`data_validade_efetiva`, senão
// `data_validade`), que é o valor que o backend calculou na validação e o que o
// cliente vê no Hub. Recalcular aqui abriria espaço para o dossiê e a tela
// discordarem sobre o que está vencido.
// ============================================================================

/** Data de hoje em America/Sao_Paulo (YYYY-MM-DD) — fuso canônico da casa. */
export function hojeISOBRT(ref: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ref); // en-CA → "YYYY-MM-DD"
}

export interface DocComValidade {
  tipo_documento?: string | null;
  nome_documento?: string | null;
  data_validade?: string | null;
  data_validade_efetiva?: string | null;
}

/** Validade que vale: a efetiva calculada pelo backend, senão a nominal. */
export function validadeVigente(d: DocComValidade): string | null {
  const bruta = d?.data_validade_efetiva ?? d?.data_validade ?? null;
  if (!bruta) return null;
  const s = String(bruta).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
}

/**
 * O documento está vencido HOJE?
 *
 * Sem data de validade = não vence (contrato social, CCMEI, requerimento de
 * empresário e afins). Nunca tratamos ausência de data como vencimento: isso
 * reabriria em massa documentos que não vencem por natureza.
 */
export function estaVencido(d: DocComValidade, hoje = hojeISOBRT()): boolean {
  const validade = validadeVigente(d);
  if (!validade) return false;
  return validade < hoje;
}

/** Dias até vencer; negativo = vencido. `null` quando não há validade. */
export function diasAteVencer(d: DocComValidade, hoje = hojeISOBRT()): number | null {
  const validade = validadeVigente(d);
  if (!validade) return null;
  const a = Date.parse(`${hoje}T00:00:00Z`);
  const b = Date.parse(`${validade}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}
