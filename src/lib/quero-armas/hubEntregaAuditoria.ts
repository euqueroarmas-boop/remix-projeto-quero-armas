/**
 * Linha do tempo de entrega do Hub Documental.
 *
 * Ordena os documentos pela ORDEM EM QUE FORAM ENTREGUES (não por família) e
 * anota, item a item, o que destoou do checklist: exigência inexistente,
 * entrega fora da ordem configurada, segundo documento de identidade e
 * possível troca de certidão (o cliente manda um antecedente no lugar de outro).
 */
import { ehDocumentoIdentidade } from "./identidadeUnica";

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

  const exigenciasPorTipo = new Map<string, ExigenciaLike>();
  exigencias.forEach((e) => {
    const t = norm(e.tipo_documento);
    if (t && !exigenciasPorTipo.has(t)) exigenciasPorTipo.set(t, e);
  });

  // Exigências obrigatórias com ordem definida, para detectar "atropelo".
  const comOrdem = exigencias
    .filter((e) => typeof e.ordem === "number" && e.obrigatorio !== false)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

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
      anotacoes.push({
        codigo: "sem_exigencia",
        severidade: "atencao",
        titulo: "SEM EXIGÊNCIA CORRESPONDENTE",
        detalhe: "Este documento não consta como exigência do checklist deste cliente — foi entregue por fora ou o checklist está incompleto.",
      });
      if (ehCertidao(tipo) && certidoesPendentes.length > 0) {
        anotacoes.push({
          codigo: "possivel_troca_certidao",
          severidade: "critico",
          titulo: "POSSÍVEL TROCA DE CERTIDÃO",
          detalhe: `Certidão entregue sem exigência, enquanto seguem pendentes: ${certidoesPendentes.slice(0, 4).join(" · ")}. Confira se o cliente enviou um antecedente no lugar de outro.`,
        });
      }
    }

    if (exigencia && typeof exigencia.ordem === "number") {
      const anteriores = comOrdem.filter(
        (e) => (e.ordem ?? 0) < (exigencia.ordem ?? 0) && !CUMPRIDOS.has(norm(e.status)),
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