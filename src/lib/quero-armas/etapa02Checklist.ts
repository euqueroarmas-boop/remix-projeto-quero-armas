/**
 * etapa02Checklist — Loader dinâmico do checklist documental da Etapa 02
 * do /cadastro-v2, consumindo qa_servicos_documentos (Wave 4A).
 *
 * Zero Regression:
 * - Mantém as 2 chaves canônicas usadas pelo fluxo legado:
 *   `doc_identidade` (qualquer um de CNH ou RG_COM_CPF) e
 *   `doc_endereco`  (comprovante_residencia). Essas chaves continuam
 *   alimentando a extração IA e o gating do botão "Continuar".
 * - Demais tipos viram cards opcionais com key `doc_<tipo_documento>`.
 * - Em qualquer falha (rede, RLS, slug não encontrado) cai no fallback
 *   hardcoded universal (identidade + comprovante + CPF), nunca quebra
 *   o wizard.
 */
import { supabase } from "@/integrations/supabase/client";

export interface ChecklistDocItem {
  key: string;
  label: string;
  obrigatorio_etapa02: boolean;
  shortName?: string;
  /** Para tooltip/helper text quando vier do banco. */
  instrucoes?: string | null;
  /** Marca itens cuja origem é o catálogo (e não o fallback). */
  origem: "banco" | "fallback";
}

/** Tipos identidade → mapeados para a chave única `doc_identidade`. */
const IDENTIDADE_TIPOS = new Set(["cnh", "rg_com_cpf"]);
/** Tipo endereço → mapeado para chave única `doc_endereco`. */
const ENDERECO_TIPOS = new Set(["comprovante_residencia"]);

/** Fallback universal — comportamento legado do Etapa02Documentos. */
const FALLBACK_UNIVERSAL: ChecklistDocItem[] = [
  { key: "doc_identidade", label: "Documento de identidade — CIN, RG ou CNH (frente e verso)", obrigatorio_etapa02: true, shortName: "identidade", origem: "fallback" },
  { key: "doc_endereco", label: "Comprovante de residência (últimos 90 dias)", obrigatorio_etapa02: true, shortName: "comprovante de residência", origem: "fallback" },
  { key: "doc_cpf", label: "CPF (se não constar no documento de identidade)", obrigatorio_etapa02: false, origem: "fallback" },
];

function fallbackParaSlug(slug: string | null | undefined): ChecklistDocItem[] {
  const extras: ChecklistDocItem[] = [];
  if (slug && /cr|cac|acervo/.test(slug)) {
    extras.push(
      { key: "doc_cr", label: "Certificado de Registro (CR) — se já tiver", obrigatorio_etapa02: false, origem: "fallback" },
      { key: "doc_clube", label: "Comprovante de filiação ao clube de tiro", obrigatorio_etapa02: false, origem: "fallback" },
    );
  }
  if (slug && /porte|posse/.test(slug)) {
    extras.push(
      { key: "doc_psicologico", label: "Laudo psicológico (DPF)", obrigatorio_etapa02: false, origem: "fallback" },
      { key: "doc_capacitacao", label: "Certificado de capacitação técnica", obrigatorio_etapa02: false, origem: "fallback" },
    );
  }
  return [...FALLBACK_UNIVERSAL, ...extras];
}

interface RawRow {
  tipo_documento: string;
  nome_documento: string | null;
  obrigatorio_etapa02: boolean | null;
  ordem: number | null;
  instrucoes: string | null;
  ativo: boolean | null;
}

/** Converte rows do banco em itens da UI, deduplicando identidade. */
function mapRows(rows: RawRow[]): ChecklistDocItem[] {
  const out: ChecklistDocItem[] = [];
  let identidadeJaAdicionada = false;
  let enderecoJaAdicionado = false;

  for (const r of rows) {
    const tipo = String(r.tipo_documento || "").toLowerCase();
    if (!tipo) continue;

    if (IDENTIDADE_TIPOS.has(tipo)) {
      if (identidadeJaAdicionada) continue;
      identidadeJaAdicionada = true;
      out.push({
        key: "doc_identidade",
        label: "Documento de identidade — CIN, RG ou CNH (frente e verso)",
        obrigatorio_etapa02: true,
        shortName: "identidade",
        instrucoes: r.instrucoes,
        origem: "banco",
      });
      continue;
    }

    if (ENDERECO_TIPOS.has(tipo)) {
      if (enderecoJaAdicionado) continue;
      enderecoJaAdicionado = true;
      out.push({
        key: "doc_endereco",
        label: r.nome_documento || "Comprovante de residência (últimos 90 dias)",
        obrigatorio_etapa02: true,
        shortName: "comprovante de residência",
        instrucoes: r.instrucoes,
        origem: "banco",
      });
      continue;
    }

    out.push({
      key: `doc_${tipo}`,
      label: r.nome_documento || tipo,
      obrigatorio_etapa02: Boolean(r.obrigatorio_etapa02),
      instrucoes: r.instrucoes,
      origem: "banco",
    });
  }

  // Garante que os 2 obrigatórios universais existam mesmo se o catálogo
  // do serviço estiver incompleto.
  if (!identidadeJaAdicionada) out.unshift(FALLBACK_UNIVERSAL[0]);
  if (!enderecoJaAdicionado) {
    const idx = out.findIndex((d) => d.key === "doc_identidade");
    out.splice(idx + 1, 0, FALLBACK_UNIVERSAL[1]);
  }

  return out;
}

export async function fetchChecklistEtapa02(
  servicoSlug: string | null | undefined,
): Promise<ChecklistDocItem[]> {
  if (!servicoSlug) return fallbackParaSlug(servicoSlug);

  try {
    const { data: servico, error: errServ } = await supabase
      .from("qa_servicos_catalogo")
      .select("servico_id")
      .eq("slug", servicoSlug)
      .eq("ativo", true)
      .maybeSingle();
    if (errServ || !servico?.servico_id) return fallbackParaSlug(servicoSlug);

    const { data: rows, error: errDocs } = await supabase
      .from("qa_servicos_documentos")
      .select("tipo_documento, nome_documento, obrigatorio_etapa02, ordem, instrucoes, ativo")
      .eq("servico_id", servico.servico_id)
      .eq("ativo", true)
      .order("ordem", { ascending: true, nullsFirst: false });
    if (errDocs) return fallbackParaSlug(servicoSlug);

    const items = mapRows((rows || []) as RawRow[]);
    if (items.length === 0) return fallbackParaSlug(servicoSlug);
    return items;
  } catch {
    return fallbackParaSlug(servicoSlug);
  }
}