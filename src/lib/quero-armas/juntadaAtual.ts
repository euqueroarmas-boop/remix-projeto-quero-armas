// ============================================================================
// juntadaAtual — o dossiê protocolado tem que ser o dossiê de agora
// ----------------------------------------------------------------------------
// Furo 3 da terceira auditoria (18/08/2026).
//
// A trava do protocolo exigia que EXISTISSE uma juntada. Não exigia que fosse a
// mais recente. Então este caminho passava inteiro, sem um aviso:
//
//   1. a equipe monta o dossiê;
//   2. o cliente reenvia a certidão que estava vencida — e ela é aprovada;
//   3. ou a petição volta aprovada pelo cliente, depois de corrigida;
//   4. alguém clica em "marcar como protocolado".
//
// O PDF que foi para a delegacia é o do passo 1. Não tem a certidão nova, não
// tem a petição corrigida. E ninguém percebe, porque a tela mostra "JUNTADA
// V1 · 42 páginas" com ar de coisa pronta.
//
// O preço de errar aqui é alto e assimétrico: dossiê incompleto vira exigência,
// mais 10 dias de prazo e o dossiê refeito — ou, pior, uma decisão tomada sobre
// papel velho. Remontar custa um clique.
//
// ── POR QUE COMPARAR DATA, E NÃO A LISTA DE ITENS ───────────────────────────
// A lista (`itens_json`) diz quais TIPOS entraram, não qual VERSÃO. Um
// documento reenviado e reaprovado mantém o mesmo tipo e a mesma linha: a lista
// continua idêntica enquanto o arquivo mudou. Só a data denuncia.
// ============================================================================

/** Status que valem como documento pronto para ir à delegacia. */
const STATUS_NO_DOSSIE = new Set([
  "aprovado",
  "entregue_pelo_hub",
  "dispensado_por_reaproveitamento",
]);

export interface DocumentoParaDossie {
  tipo_documento?: string | null;
  nome_documento?: string | null;
  status?: string | null;
  /** Quando a equipe/IA aprovou. É o carimbo que importa. */
  data_validacao?: string | null;
  updated_at?: string | null;
}

export interface PecaParaDossie {
  titulo_geracao?: string | null;
  status_cliente?: string | null;
  aprovada_cliente_em?: string | null;
}

export interface MudancaAposJuntada {
  /** Rótulo humano do que mudou, para a tela dizer o que falta. */
  rotulo: string;
  /** Quando mudou (ISO). */
  em: string;
}

export interface EstadoJuntada {
  /** A juntada montada representa o estado atual do processo? */
  atual: boolean;
  /** O que entrou ou mudou depois que ela foi montada. */
  mudancas: MudancaAposJuntada[];
}

/** Data de referência de um documento: a validação, senão a última alteração. */
function carimboDoc(d: DocumentoParaDossie): string | null {
  return d.data_validacao ?? d.updated_at ?? null;
}

/**
 * Compara o que existe hoje com o que a juntada congelou.
 *
 * Sem juntada, devolve `atual: false` com a lista vazia — quem chama já trata
 * "não existe dossiê" antes, e misturar os dois casos aqui esconderia um do
 * outro na tela.
 */
export function estadoDaJuntada(args: {
  montadaEm: string | null | undefined;
  documentos: DocumentoParaDossie[];
  pecas?: PecaParaDossie[];
}): EstadoJuntada {
  if (!args.montadaEm) return { atual: false, mudancas: [] };

  const corte = new Date(args.montadaEm).getTime();
  if (!Number.isFinite(corte)) return { atual: false, mudancas: [] };

  const mudancas: MudancaAposJuntada[] = [];

  for (const d of args.documentos ?? []) {
    if (!STATUS_NO_DOSSIE.has(String(d.status ?? "").toLowerCase())) continue;
    const carimbo = carimboDoc(d);
    if (!carimbo) continue;
    const t = new Date(carimbo).getTime();
    if (!Number.isFinite(t) || t <= corte) continue;
    mudancas.push({
      rotulo: d.nome_documento || d.tipo_documento || "documento",
      em: carimbo,
    });
  }

  for (const p of args.pecas ?? []) {
    if (String(p.status_cliente ?? "") !== "aprovada") continue;
    const carimbo = p.aprovada_cliente_em;
    if (!carimbo) continue;
    const t = new Date(carimbo).getTime();
    if (!Number.isFinite(t) || t <= corte) continue;
    mudancas.push({
      rotulo: `Petição aprovada pelo cliente${p.titulo_geracao ? ` — ${p.titulo_geracao}` : ""}`,
      em: carimbo,
    });
  }

  // Mais recente primeiro: é o que a equipe quer ver de relance.
  mudancas.sort((a, b) => (a.em < b.em ? 1 : -1));

  return { atual: mudancas.length === 0, mudancas };
}
