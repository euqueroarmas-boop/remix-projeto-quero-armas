/**
 * Helpers do fluxo de aprovação da tabela central qa_documentos_cliente.
 *
 * Regras:
 *  - Documentos enviados pelo CLIENTE (portal) entram como `pendente_aprovacao` + origem `cliente`.
 *  - Documentos lançados pelo ADMIN/STAFF em /clientes entram como `aprovado` + origem `admin`.
 *  - Apenas staff pode mudar status para `aprovado` ou `reprovado` (RLS + trigger garantem isso).
 */

import { supabase } from "@/integrations/supabase/client";

export type DocStatus =
  | "pendente_aprovacao"
  | "aprovado"
  | "reprovado"
  | "substituido"
  | "excluido";

export type DocOrigem = "admin" | "cliente" | "sistema" | "scanner" | "importacao";

/** Verifica se o usuário logado é staff (admin) — usado para definir status/origem default. */
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

/** Aprova um documento. Apenas staff. */
export async function aprovarDocumento(docId: string) {
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
}

/** Reprova com motivo obrigatório. Apenas staff. */
export async function reprovarDocumento(docId: string, motivo: string) {
  const m = (motivo || "").trim();
  if (m.length < 3) throw new Error("Informe o motivo da reprovação.");
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
}

/** Marca como excluído (soft delete) para sumir do portal mas preservar auditoria. */
export async function excluirDocumentoLogico(docId: string) {
  const { error } = await supabase
    .from("qa_documentos_cliente" as any)
    .update({ status: "excluido" })
    .eq("id", docId);
  if (error) throw error;
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