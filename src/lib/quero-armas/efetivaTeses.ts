// ============================================================================
// efetivaTeses
// ----------------------------------------------------------------------------
// Teses de defesa da efetiva necessidade — a separação dos núcleos de risco.
//
// Regra do usuário (17/08/2026): um cliente pode viver mais de uma situação de
// risco ao mesmo tempo, e elas NÃO se misturam. O caso do Mizael é o exemplo:
// ameaça dentro da família de um lado, risco da atividade profissional do
// outro. Quando o sistema tratava tudo como um relato só, o texto que ia para a
// delegacia eletrônica não cabia no campo, não fazia sentido como ocorrência
// única, e o cliente registrava o mesmo boletim duas vezes.
//
// Aqui ficam as funções PURAS: casar o boletim anexado com a tese certa e dizer
// se o passo do boletim está travado esperando outro documento. Nada de banco,
// nada de tela — é o que os testes cobrem e o que a tela e a edge function
// consomem.
// ============================================================================

export interface EfetivaTeseLike {
  id?: string;
  ordem?: number | null;
  titulo?: string | null;
  resumo?: string | null;
  texto_bo?: string | null;
  confirmada_em?: string | null;
  prova_id?: string | null;
  vinculo_confirmado_em?: string | null;
  registro_confirmado_em?: string | null;
}

export interface ProvaParaCasar {
  id?: string;
  tipo?: string | null;
  numero?: string | null;
  naturezas?: string[] | null;
  relato?: string | null;
  local_fato?: string | null;
  vitima_nome?: string | null;
}

/** Limite do campo de relato da delegacia eletrônica. Regra do usuário. */
export const LIMITE_TEXTO_BO = 500;

/**
 * Palavras que aparecem em qualquer boletim e em qualquer tese. Se entrassem na
 * conta, todo documento "casaria" com todas as teses igualmente.
 */
const VAZIAS = new Set([
  "para", "pela", "pelo", "pelos", "pelas", "como", "onde", "quando", "porque",
  "minha", "meus", "minhas", "meu", "dele", "dela", "deles", "delas", "esta",
  "este", "isso", "essa", "esse", "aquele", "aquela", "sobre", "entre", "muito",
  "mais", "menos", "ainda", "depois", "antes", "sempre", "nunca", "tambem",
  "esta", "estao", "estou", "fiquei", "ficar", "sendo", "havia", "tinha",
  "fato", "fatos", "boletim", "ocorrencia", "ocorrencias", "policia", "civil",
  "delegacia", "registro", "registrei", "registrado", "comunico", "codigo",
  "penal", "artigo", "art", "natureza", "vitima", "declarante", "providencias",
  "cabiveis", "autoridade", "policial", "nome", "cpf", "rua", "numero",
]);

/** Sem acento, sem pontuação, minúsculo — para comparar texto de gente. */
export function normalizarTexto(valor: string | null | undefined): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Conjunto de palavras que realmente distinguem um texto do outro. */
export function palavrasRelevantes(valor: string | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const p of normalizarTexto(valor).split(" ")) {
    if (p.length >= 4 && !VAZIAS.has(p)) out.add(p);
  }
  return out;
}

/**
 * Quanto o menor dos dois textos está contido no outro (coeficiente de
 * sobreposição). Jaccard puro penalizaria demais o texto do BO — 500 caracteres
 * — contra o relato longo da tese.
 */
export function sobreposicao(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let comuns = 0;
  for (const p of a) if (b.has(p)) comuns += 1;
  return comuns / Math.min(a.size, b.size);
}

/** A partir daqui o encaixe é bom o bastante para já vir sugerido na tela. */
export const LIMIAR_CASAMENTO = 0.18;

export interface CasamentoTese {
  tese: EfetivaTeseLike;
  score: number;
  /** O encaixe veio do conteúdo lido do documento (e não só da ordem da fila). */
  porConteudo: boolean;
}

/** Teses que ainda esperam um boletim. */
export function tesesPendentes(teses: EfetivaTeseLike[] = []): EfetivaTeseLike[] {
  return (teses ?? [])
    .filter((t) => !t?.prova_id)
    .sort((a, b) => Number(a?.ordem ?? 0) - Number(b?.ordem ?? 0));
}

/** Teses que o cliente já confirmou (título lido e aceito por ele). */
export function tesesConfirmadas(teses: EfetivaTeseLike[] = []): EfetivaTeseLike[] {
  return (teses ?? []).filter((t) => !!String(t?.confirmada_em ?? "").trim());
}

/**
 * Qual tese este boletim cobre?
 *
 * Regra do usuário (17/08/2026): o sistema casa sozinho pelo número e pela
 * natureza lida do documento, MOSTRA o encaixe ao cliente e pede que ele leia e
 * confirme. Sem confirmação nada é gravado — quem assina o boletim é ele.
 */
export function casarProvaComTese(
  prova: ProvaParaCasar | null | undefined,
  teses: EfetivaTeseLike[] = [],
): CasamentoTese | null {
  const candidatas = tesesPendentes(teses);
  if (candidatas.length === 0) return null;

  const doDocumento = palavrasRelevantes(
    [
      (prova?.naturezas ?? []).join(" "),
      prova?.relato ?? "",
      prova?.local_fato ?? "",
      prova?.vitima_nome ?? "",
    ].join(" "),
  );

  let melhor: CasamentoTese | null = null;
  for (const tese of candidatas) {
    const daTese = palavrasRelevantes(
      [tese?.titulo ?? "", tese?.resumo ?? "", tese?.texto_bo ?? ""].join(" "),
    );
    const score = sobreposicao(doDocumento, daTese);
    if (!melhor || score > melhor.score) {
      melhor = { tese, score, porConteudo: score >= LIMIAR_CASAMENTO };
    }
  }

  // Nenhuma palavra em comum (documento ilegível, PDF escaneado, layout
  // desconhecido): sugerimos a primeira tese em aberto e dizemos na tela que o
  // encaixe é uma sugestão pela ordem — o cliente lê e decide.
  if (melhor && !melhor.porConteudo) {
    return { tese: candidatas[0], score: melhor.score, porConteudo: false };
  }
  return melhor;
}

export interface RegistroLacoBo {
  bo_quer_outro?: boolean | null;
  bo_aguardando_desde?: string | null;
  bo_destravado_em?: string | null;
}

/**
 * O passo do boletim está travado esperando outro documento?
 *
 * Regra do usuário (17/08/2026): disse que vai abrir outro boletim, trava aqui
 * até o documento chegar. Para seguir sem ele, o cliente abre chamado e a
 * equipe destrava — e a destrava só vale para a espera atual (carimbo posterior
 * ao início dela).
 */
export function aguardandoOutroBo(
  registro: RegistroLacoBo | null | undefined,
): boolean {
  if (registro?.bo_quer_outro !== true) return false;
  const desde = Date.parse(String(registro?.bo_aguardando_desde ?? ""));
  const destravado = Date.parse(String(registro?.bo_destravado_em ?? ""));
  if (!Number.isFinite(destravado)) return true;
  if (!Number.isFinite(desde)) return false;
  return destravado < desde;
}

/** Texto do encaixe, em linguagem de cliente, para a tela de confirmação. */
export function descreverCasamento(
  prova: ProvaParaCasar | null | undefined,
  casamento: CasamentoTese | null | undefined,
): string {
  if (!casamento) return "";
  const numero = String(prova?.numero ?? "").trim();
  const naturezas = (prova?.naturezas ?? []).filter(Boolean).join(", ");
  const identificacao = [
    numero ? `nº ${numero}` : "",
    naturezas ? `natureza ${naturezas}` : "",
  ].filter(Boolean).join(" — ");
  const doc = identificacao ? `O boletim ${identificacao}` : "O boletim que você enviou";
  return casamento.porConteudo
    ? `${doc} trata do que você contou em “${casamento.tese.titulo}”.`
    : `${doc} não pôde ser lido por inteiro. Pelo andamento, ele deve ser o de “${casamento.tese.titulo}”.`;
}
