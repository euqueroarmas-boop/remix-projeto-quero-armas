/**
 * ÁRVORE DE EXIGÊNCIAS do Hub Documental (visão da equipe).
 *
 * A linha do tempo de entrega responde "o que chegou e quando". Não responde
 * "o dossiê está de pé?" — para isso a raiz precisa ser a EXIGÊNCIA, não o
 * arquivo: a foto tem que aparecer no grupo 2 mesmo tendo chegado por último,
 * e o reenvio do mesmo antecedente tem que empilhar sob o item que ele cumpre,
 * em vez de virar uma nova linha no fim da lista.
 *
 * Estrutura:
 *
 *   Grupo do protocolo (1..9, ordem canônica do dossiê PF)
 *     └── Exigência (um nó por slot do checklist)
 *           ├── documento principal (versão que vale hoje)
 *           └── histórico recolhido (versões anteriores do mesmo slot)
 *
 * Exigência sem documento aparece como pendente — é o buraco do dossiê.
 * Documento entregue sem exigência correspondente aparece no grupo a que
 * pertence, marcado como fora do checklist (a auditoria de entrega já anota
 * o porquê).
 *
 * Motores reusados de propósito, para não haver duas verdades:
 *   - `montarLinhaEntrega` → anotações e sequência de entrega de cada arquivo;
 *   - `posicaoProtocolo`   → grupo/ordem canônica do dossiê;
 *   - `checklistMetrics`   → tradução de status (cumprido/em análise);
 *   - `hubTipoMap` + `identidadeUnica` → casamento exigência ↔ documento.
 */
import { toHubTipoCompartilhado } from "./hubTipoMap";
import { ehDocumentoIdentidade } from "./identidadeUnica";
import { familiaDocumento } from "./documentosAgrupamento";
import { posicaoProtocolo, GRUPOS_PROTOCOLO } from "./ordemProtocolo";
import { isChecklistCumprido, isChecklistEmAnalise } from "./checklistMetrics";
import type { AnotacaoEntrega, EntregaItem, ExigenciaLike } from "./hubEntregaAuditoria";

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
const ehPergunta = (t: string) => t.startsWith("pergunta_");

/**
 * Chave que casa exigência e documento.
 *
 * Colapsa o que o checklist trata como UM slot:
 *   - CIN / RG / CNH → identidade civil (regra de identidade única);
 *   - comprovante_endereco_ano_YYYY → comprovante_residencia;
 *   - slug do processo → tipo do Hub (certidao_federal_trf3_sjsp_jef →
 *     antecedentes_federal_sjsp_jef).
 */
export function chaveExigencia(tipo?: string | null, nome?: string | null): string {
  const raw = norm(tipo);
  if (ehDocumentoIdentidade(tipo, nome)) return "identidade_civil";
  if (!raw) return norm(nome) || "desconhecido";
  // `toHubTipoCompartilhado` devolve "outro" para tudo que não é tipo válido do
  // Hub. Aceitar esse fallback aqui juntaria exigências distintas num nó só —
  // então, fora do mapa, a chave é o próprio tipo.
  const hub = toHubTipoCompartilhado(raw);
  const base = hub !== "outro" || raw === "outro" ? hub : raw;
  return familiaDocumento(base);
}

export type SituacaoNo =
  /** documento do Hub aprovado pela equipe */
  | "aprovado"
  /** documento entregue, aguardando conferência */
  | "em_analise"
  /** único documento do slot está reprovado — o cliente precisa reenviar */
  | "rejeitado"
  /** exigência fechada no checklist sem arquivo no Hub (enviado direto no processo, dispensado) */
  | "cumprida_no_processo"
  /** exigência aberta, nada entregue */
  | "pendente"
  /** documento entregue que não corresponde a nenhuma exigência */
  | "fora_do_checklist";

export interface VersaoDocumento {
  doc: any;
  /** Item da linha de entrega — traz sequência cronológica e anotações. */
  item: EntregaItem;
}

export interface NoExigencia {
  chave: string;
  rotulo: string;
  /** Prefixo do dossiê (ex.: "03", "1.2"). */
  numero: string;
  grupo: number;
  ordem: number;
  obrigatorio: boolean;
  /** Exigências que este nó representa — mais de uma quando dois processos pedem o mesmo. */
  exigencias: ExigenciaLike[];
  /** Processos que pedem este item. */
  processos: string[];
  principal: VersaoDocumento | null;
  historico: VersaoDocumento[];
  situacao: SituacaoNo;
  /** Anotações da auditoria do documento principal. */
  anotacoes: AnotacaoEntrega[];
}

export interface NoGrupo {
  grupo: number;
  grupoNome: string;
  nos: NoExigencia[];
  entregues: number;
  pendentes: number;
}

const tsDoc = (d: any): number => {
  const t = Date.parse(String(d?.created_at || ""));
  return Number.isFinite(t) ? t : 0;
};

const ehReprovado = (d: any) => ["reprovado", "rejeitado"].includes(norm(d?.status));
const ehAprovado = (d: any) => ["aprovado", "validado"].includes(norm(d?.status));

/**
 * Versão que vale hoje.
 *
 * Regra confirmada com a operação: vence o REENVIO MAIS RECENTE, e documento
 * reprovado só é principal quando não há mais nada no slot. Sem isso, o
 * antecedente rejeitado em 06/08 continuava representando o item enquanto o
 * reenvio de 15/08 aparecia como um documento novo no fim da lista.
 */
function ordenarVersoes(versoes: VersaoDocumento[]): VersaoDocumento[] {
  return [...versoes].sort((a, b) => {
    const ra = ehReprovado(a.doc) ? 1 : 0;
    const rb = ehReprovado(b.doc) ? 1 : 0;
    if (ra !== rb) return ra - rb;
    return tsDoc(b.doc) - tsDoc(a.doc);
  });
}

function situacaoDoNo(
  principal: VersaoDocumento | null,
  exigencias: ExigenciaLike[],
): SituacaoNo {
  if (principal) {
    if (ehAprovado(principal.doc)) return "aprovado";
    if (ehReprovado(principal.doc)) return "rejeitado";
    return "em_analise";
  }
  if (exigencias.length === 0) return "fora_do_checklist";
  if (exigencias.some((e) => isChecklistCumprido(e.status))) return "cumprida_no_processo";
  if (exigencias.some((e) => isChecklistEmAnalise(e.status))) return "em_analise";
  return "pendente";
}

const rotuloDe = (
  exigencias: ExigenciaLike[],
  doc: any,
  tipoRef: string,
): string => {
  const daExigencia = exigencias.find((e) => e.nome_documento)?.nome_documento;
  if (daExigencia) return String(daExigencia).replace(/_/g, " ");
  const doDoc = doc?.nome_documento || doc?.tipo_documento;
  if (doDoc) return String(doDoc).replace(/_/g, " ");
  return tipoRef.replace(/_/g, " ");
};

/**
 * Monta a árvore.
 *
 * @param itens       linha de entrega já auditada (montarLinhaEntrega)
 * @param exigencias  linhas de qa_processo_documentos do escopo aberto
 */
export function montarArvoreExigencias(
  itens: EntregaItem[],
  exigencias: ExigenciaLike[],
): NoGrupo[] {
  // 1) Exigências por slot. Perguntas do checklist não são documento.
  const porChaveExigencia = new Map<string, ExigenciaLike[]>();
  for (const e of exigencias) {
    const tipo = norm(e.tipo_documento);
    if (ehPergunta(tipo)) continue;
    const chave = chaveExigencia(e.tipo_documento, e.nome_documento);
    if (!porChaveExigencia.has(chave)) porChaveExigencia.set(chave, []);
    porChaveExigencia.get(chave)!.push(e);
  }

  // 2) Documentos entregues por slot.
  const porChaveDoc = new Map<string, VersaoDocumento[]>();
  for (const item of itens) {
    const d: any = item.doc;
    const chave = chaveExigencia(d.tipo_documento, d.nome_documento);
    if (!porChaveDoc.has(chave)) porChaveDoc.set(chave, []);
    porChaveDoc.get(chave)!.push({ doc: d, item });
  }

  const chaves = new Set<string>([...porChaveExigencia.keys(), ...porChaveDoc.keys()]);
  const nos: NoExigencia[] = [];

  for (const chave of chaves) {
    const exigenciasDoNo = porChaveExigencia.get(chave) ?? [];
    const versoes = ordenarVersoes(porChaveDoc.get(chave) ?? []);
    const principal = versoes[0] ?? null;
    const historico = versoes.slice(1);

    // O grupo do protocolo vem do documento entregue; sem documento, do tipo
    // da exigência — os dois passam pelo mesmo mapa canônico.
    const refTipo = principal?.doc?.tipo_documento
      ?? exigenciasDoNo.find((e) => e.tipo_documento)?.tipo_documento
      ?? chave;
    const refNome = principal?.doc?.nome_documento
      ?? exigenciasDoNo.find((e) => e.nome_documento)?.nome_documento
      ?? null;
    const pos = posicaoProtocolo(refTipo, refNome);

    nos.push({
      chave,
      rotulo: rotuloDe(exigenciasDoNo, principal?.doc, String(refTipo)),
      numero: pos.numero,
      grupo: pos.grupo,
      ordem: pos.ordem,
      obrigatorio: exigenciasDoNo.some((e) => e.obrigatorio !== false),
      exigencias: exigenciasDoNo,
      processos: [...new Set(
        exigenciasDoNo.map((e) => String((e as any).processo_id ?? "")).filter(Boolean),
      )],
      principal,
      historico,
      situacao: situacaoDoNo(principal, exigenciasDoNo),
      anotacoes: principal?.item.anotacoes ?? [],
    });
  }

  // 3) Distribui nos grupos do protocolo, na ordem canônica.
  const grupos: NoGrupo[] = GRUPOS_PROTOCOLO.map((g) => ({
    grupo: g.indice,
    grupoNome: g.nome,
    nos: [],
    entregues: 0,
    pendentes: 0,
  }));

  for (const no of nos) {
    const alvo = grupos.find((g) => g.grupo === no.grupo) ?? grupos[grupos.length - 1];
    alvo.nos.push(no);
    if (no.principal || no.situacao === "cumprida_no_processo") alvo.entregues += 1;
    else alvo.pendentes += 1;
  }

  for (const g of grupos) {
    g.nos.sort(
      (a, b) =>
        a.ordem - b.ordem ||
        a.numero.localeCompare(b.numero) ||
        a.rotulo.localeCompare(b.rotulo),
    );
  }

  return grupos.filter((g) => g.nos.length > 0);
}

/** Total de documentos representados na árvore (principal + histórico). */
export function contarDocumentosArvore(grupos: NoGrupo[]): number {
  return grupos.reduce(
    (acc, g) =>
      acc + g.nos.reduce((a, n) => a + (n.principal ? 1 : 0) + n.historico.length, 0),
    0,
  );
}
