/**
 * Helpers do fluxo de aprovação da tabela central qa_documentos_cliente.
 *
 * Regras:
 *  - Documentos enviados pelo CLIENTE (portal) entram como `pendente_aprovacao` + origem `cliente`.
 *  - Documentos lançados pela EQUIPE QUERO ARMAS em /clientes entram como `aprovado` + origem `admin`.
 *  - Apenas membros da Equipe Quero Armas podem mudar status para `aprovado` ou `reprovado` (RLS + trigger garantem isso).
 */

import { supabase } from "@/integrations/supabase/client";
import { registrarStatusEvento } from "@/lib/quero-armas/registrarStatusEvento";

export type DocStatus =
  | "pendente_aprovacao"
  | "aprovado"
  | "reprovado"
  | "substituido"
  | "excluido";

export type DocOrigem = "admin" | "cliente" | "sistema" | "scanner" | "importacao";

/** Snapshot leve do documento usado para registrar o status anterior na auditoria. */
async function snapshotDoc(docId: string): Promise<{
  status: string | null;
  cliente_id: number | null;
  tipo_documento: string | null;
} | null> {
  try {
    const { data, error } = await supabase
      .from("qa_documentos_cliente" as any)
      .select("status, cliente_id, tipo_documento")
      .eq("id", docId)
      .maybeSingle();
    if (error || !data) return null;
    const d = data as any;
    return {
      status: d.status ?? null,
      cliente_id: d.cliente_id ?? null,
      tipo_documento: d.tipo_documento ?? null,
    };
  } catch {
    return null;
  }
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Registra mudança de status do documento na tabela de auditoria.
 * Não bloqueia o fluxo se falhar.
 */
async function auditarStatusDoc(opts: {
  docId: string;
  prev: Awaited<ReturnType<typeof snapshotDoc>>;
  novo: string;
  origem: "equipe" | "ia" | "sistema";
  motivo?: string | null;
  contexto?: string;
}) {
  if (!opts.prev) return;
  const usuario_id = await currentUserId();
  await registrarStatusEvento({
    cliente_id: opts.prev.cliente_id,
    documento_id: opts.docId,
    origem: opts.origem,
    entidade: "documento",
    entidade_id: opts.docId,
    campo_status: "status",
    status_anterior: opts.prev.status,
    status_novo: opts.novo,
    usuario_id,
    motivo: opts.motivo ?? null,
    detalhes: {
      tipo_documento: opts.prev.tipo_documento,
      contexto: opts.contexto ?? "docsAprovacao",
    },
  });
}

/** Verifica se o usuário logado é membro da Equipe Quero Armas — usado para definir status/origem default. */
export async function isCurrentUserStaff(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase
    .from("qa_usuarios_perfis")
    .select("id")
    .eq("user_id", user.id)
    .eq("ativo", true)
    .limit(1);
  if (error) return false;
  return ((data as any[]) || []).length > 0;
}

/** Aprova um documento. Apenas Equipe Quero Armas. */
export async function aprovarDocumento(docId: string) {
  const prev = await snapshotDoc(docId);
  const { error } = await supabase
    .from("qa_documentos_cliente" as any)
    .update({
      status: "aprovado",
      aprovado_em: new Date().toISOString(),
      motivo_reprovacao: null,
      reprovado_por: null,
      reprovado_em: null,
    })
    .eq("id", docId);
  if (error) throw error;
  void auditarStatusDoc({ docId, prev, novo: "aprovado", origem: "equipe", contexto: "aprovarDocumento" });
}

/** Reprova com motivo obrigatório. Apenas Equipe Quero Armas. */
export async function reprovarDocumento(docId: string, motivo: string) {
  const m = (motivo || "").trim();
  if (m.length < 3) throw new Error("Informe o motivo da reprovação.");
  const prev = await snapshotDoc(docId);
  const { error } = await supabase
    .from("qa_documentos_cliente" as any)
    .update({
      status: "reprovado",
      motivo_reprovacao: m,
      reprovado_em: new Date().toISOString(),
      aprovado_por: null,
      aprovado_em: null,
    })
    .eq("id", docId);
  if (error) throw error;
  void auditarStatusDoc({ docId, prev, novo: "reprovado", origem: "equipe", motivo: m, contexto: "reprovarDocumento" });
}

/** Marca como excluído (soft delete) para sumir do portal mas preservar auditoria. */
export async function excluirDocumentoLogico(docId: string) {
  const prev = await snapshotDoc(docId);
  const { error } = await supabase
    .from("qa_documentos_cliente" as any)
    .update({ status: "excluido" })
    .eq("id", docId);
  if (error) throw error;
  void auditarStatusDoc({ docId, prev, novo: "excluido", origem: "equipe", contexto: "excluirDocumentoLogico" });
}

/** Label PT-BR + classes Tailwind para badges de status. */
export function statusBadge(status: DocStatus | string | null | undefined) {
  switch (status) {
    case "aprovado":
      return { label: "APROVADO", cls: "bg-emerald-100 text-emerald-700 border-emerald-300" };
    case "reprovado":
      return { label: "REPROVADO", cls: "bg-red-100 text-red-700 border-red-300" };
    case "pendente_aprovacao":
      return { label: "AGUARDANDO ANÁLISE", cls: "bg-amber-100 text-amber-700 border-amber-300" };
    case "substituido":
      return { label: "SUBSTITUÍDO", cls: "bg-slate-100 text-slate-600 border-slate-300" };
    case "excluido":
      return { label: "EXCLUÍDO", cls: "bg-slate-200 text-slate-500 border-slate-300" };
    default:
      return { label: "—", cls: "bg-slate-100 text-slate-600 border-slate-300" };
  }
}