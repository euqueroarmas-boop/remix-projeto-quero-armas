/**
 * Linha do tempo de entrega do Hub Documental.
 *
 * Ordena os documentos pela ORDEM EM QUE FORAM ENTREGUES (não por família) e
 * anota, item a item, o que destoou do checklist: exigência inexistente,
 * entrega fora da ordem configurada, segundo documento de identidade e
 * possível troca de certidão (o cliente manda um antecedente no lugar de outro).
 */
import { ehDocumentoIdentidade } from "./identidadeUnica";
import { toHubTipoCompartilhado } from "./hubTipoMap";

export interface EntregaDocLike {
  id: string;
  tipo_documento?: string | null;
  nome_documento?: string | null;
  status?: string | null;
  origem?: string | null;
  created_at?: string | null;
}

export interface ExigenciaLike {
  tipo_documento?: string | null;
  nome_documento?: string | null;
  status?: string | null;
  etapa?: string | null;
  ordem?: number | null;
  obrigatorio?: boolean | null;
}

export type AnotacaoCodigo =
  | "sem_exigencia"
  | "fora_de_ordem"
  | "identidade_duplicada"
  | "possivel_troca_certidao"
  | "enviado_pela_equipe";

export interface AnotacaoEntrega {
  codigo: AnotacaoCodigo;
  severidade: "critico" | "atencao" | "info";
  titulo: string;
  detalhe: string;
}

export interface EntregaItem {
  doc: EntregaDocLike;
  sequencia: number;
  quando: Date | null;
  origemLabel: string;
  anotacoes: AnotacaoEntrega[];
}

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();
const ehCertidao = (t: string) => t.includes("certidao") || t.includes("antecedente");
const ehPergunta = (t: string) => t.startsWith("pergunta_");
/** Documentos que pertencem ao contrato, não ao checklist do processo. */
const DOCS_CONTRATUAIS = new Set([
  "procuracao_assinada",
  "procuracao",
  "contrato_assinado",
  "contrato",
  "comprovante_pagamento",
]);
const CUMPRIDOS = new Set([
  "aprovado", "recebido", "arquivado", "concluido",
  "dispensado", "dispensado_grupo", "dispensado_por_reaproveitamento",
]);

const rotuloExigencia = (e: ExigenciaLike) =>
  String(e.nome_documento || e.tipo_documento || "").replace(/_/g, " ").toUpperCase();

/**
 * Monta a linha do tempo. `exigencias` são as linhas de qa_processo_documentos
 * do cliente (todos os processos abertos).
 */
export function montarLinhaEntrega(
  docs: EntregaDocLike[],
  exigencias: ExigenciaLike[],
): EntregaItem[] {
  const ordenados = [...docs].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return ta - tb;
  });

  // Mapa indexado pelo tipo do Hub — qa_documentos_cliente usa tipos do Hub (ex: "antecedentes_eleitoral"),
  // enquanto qa_processo_documentos usa tipos do catálogo (ex: "certidao_crimes_eleitorais_tse").
  // Inserimos as duas chaves para cobrir documentos armazenados com qualquer namespace.
  const exigenciasPorTipo = new Map<string, ExigenciaLike>();
  exigencias.forEach((e) => {
    const tRaw = norm(e.tipo_documento);
    const tHub = toHubTipoCompartilhado(tRaw);
    if (tHub && !exigenciasPorTipo.has(tHub)) exigenciasPorTipo.set(tHub, e);
    if (tRaw && tRaw !== tHub && !exigenciasPorTipo.has(tRaw)) exigenciasPorTipo.set(tRaw, e);
  });

  // Exigências obrigatórias com ordem definida, para detectar "atropelo".
  const comOrdem = exigencias
    .filter(
      (e) =>
        typeof e.ordem === "number" &&
        e.obrigatorio !== false &&
        !ehPergunta(norm(e.tipo_documento)),
    )
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  // Data da PRIMEIRA entrega de cada tipo (nos dois namespaces), para auditar
  // a ordem contra o momento da entrega e não contra o estado de hoje.
  const primeiraEntregaPorTipo = new Map<string, number>();
  ordenados.forEach((d) => {
    const ts = d.created_at ? Date.parse(d.created_at) : NaN;
    if (!Number.isFinite(ts)) return;
    const tRaw = norm(d.tipo_documento);
    if (!tRaw) return;
    const tHub = toHubTipoCompartilhado(tRaw) || tRaw;
    [tRaw, tHub].forEach((k) => {
      const atual = primeiraEntregaPorTipo.get(k);
      if (atual === undefined || ts < atual) primeiraEntregaPorTipo.set(k, ts);
    });
  });

  const entregueAntesDe = (e: ExigenciaLike, corte: number): boolean => {
    const tRaw = norm(e.tipo_documento);
    const tHub = toHubTipoCompartilhado(tRaw) || tRaw;
    const ts = primeiraEntregaPorTipo.get(tRaw) ?? primeiraEntregaPorTipo.get(tHub);
    return ts !== undefined && ts <= corte;
  };

  const certidoesPendentes = exigencias
    .filter((e) => ehCertidao(norm(e.tipo_documento)) && !CUMPRIDOS.has(norm(e.status)))
    .map(rotuloExigencia);

  let identidadesVistas = 0;

  return ordenados.map((doc, idx) => {
    const tipo = norm(doc.tipo_documento);
    const anotacoes: AnotacaoEntrega[] = [];
    const exigencia = exigenciasPorTipo.get(tipo);

    if (norm(doc.origem) !== "cliente") {
      anotacoes.push({
        codigo: "enviado_pela_equipe",
        severidade: "info",
        titulo: "LANÇADO PELA EQUIPE",
        detalhe: "Não passou pelo assistente do portal — as travas do checklist (ordem, identidade única) não se aplicam a lançamentos internos.",
      });
    }

    if (!exigencia && tipo) {
      const contratual = DOCS_CONTRATUAIS.has(tipo) || DOCS_CONTRATUAIS.has(toHubTipoCompartilhado(tipo) || tipo);
      anotacoes.push(
        contratual
          ? {
              codigo: "sem_exigencia",
              severidade: "info",
              titulo: "DOCUMENTO CONTRATUAL",
              detalhe: "Pertence ao contrato, não ao checklist do processo — por isso não há exigência correspondente.",
            }
          : {
              codigo: "sem_exigencia",
              severidade: "atencao",
              titulo: "SEM EXIGÊNCIA CORRESPONDENTE",
              detalhe: "Este documento não consta como exigência do checklist deste cliente — foi entregue por fora ou o checklist está incompleto.",
            },
      );
      if (!contratual && ehCertidao(tipo) && certidoesPendentes.length > 0) {
        anotacoes.push({
          codigo: "possivel_troca_certidao",
          severidade: "critico",
          titulo: "POSSÍVEL TROCA DE CERTIDÃO",
          detalhe: `Certidão entregue sem exigência, enquanto seguem pendentes: ${certidoesPendentes.slice(0, 4).join(" · ")}. Confira se o cliente enviou um antecedente no lugar de outro.`,
        });
      }
    }

    if (exigencia && typeof exigencia.ordem === "number") {
      const corte = doc.created_at ? Date.parse(doc.created_at) : Number.MAX_SAFE_INTEGER;
      const anteriores = comOrdem.filter(
        (e) =>
          (e.ordem ?? 0) < (exigencia.ordem ?? 0) &&
          !CUMPRIDOS.has(norm(e.status)) &&
          !entregueAntesDe(e, corte),
      );
      if (anteriores.length > 0) {
        anotacoes.push({
          codigo: "fora_de_ordem",
          severidade: "atencao",
          titulo: "ENTREGUE FORA DA ORDEM",
          detalhe: `O checklist previa antes: ${anteriores.slice(0, 3).map(rotuloExigencia).join(" · ")}.`,
        });
      }
    }

    if (ehDocumentoIdentidade(doc.tipo_documento, doc.nome_documento)) {
      identidadesVistas += 1;
      if (identidadesVistas > 1) {
        anotacoes.push({
          codigo: "identidade_duplicada",
          severidade: "critico",
          titulo: `${identidadesVistas}º DOCUMENTO DE IDENTIDADE`,
          detalhe: "A regra é UM documento oficial de identidade por cliente. Há mais de um no acervo — confira qual deve valer e remova/arquive o excedente.",
        });
      }
    }

    return {
      doc,
      sequencia: idx + 1,
      quando: doc.created_at ? new Date(doc.created_at) : null,
      origemLabel: norm(doc.origem) === "cliente" ? "VIA PORTAL" : "EQUIPE",
      anotacoes,
    };
  });
}

export function contarAnotacoes(itens: EntregaItem[]) {
  return itens.reduce((acc, i) => acc + i.anotacoes.filter((a) => a.severidade !== "info").length, 0);
}