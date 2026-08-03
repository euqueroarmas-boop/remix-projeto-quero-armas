// Notificação interna para a equipe (Central de Notificação do admin).
//
// IMPORTANTE: não envia mais e-mail. O contrato assinado e a procuração já
// chegam íntegros no Arsenal, então o aviso agora é apenas um registro em
// public.qa_admin_notificacoes, que o painel do administrador consome em
// tempo real (pop-ups discretos empilhados).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AdminUploadTipo = "contrato" | "procuracao" | "documento_processo";

export interface NotifyAdminUploadArgs {
  tipo: AdminUploadTipo;
  cliente_nome?: string | null;
  cliente_email?: string | null;
  cliente_cpf?: string | null;
  documento_nome: string;
  exigencia?: string | null;
  servico?: string | null;
  processo_id?: string | number | null;
  contract_id?: string | number | null;
  procuracao_id?: string | number | null;
  extras?: Record<string, string | number | null | undefined>;
  trace_id?: string;
}

const TITULOS: Record<AdminUploadTipo, string> = {
  contrato: "Contrato assinado recebido",
  procuracao: "Procuração assinada recebida",
  documento_processo: "Documento enviado pelo cliente",
};

export async function notifyAdminUpload(args: NotifyAdminUploadArgs) {
  try {
    // Documentos de checklist já geram notificação automática por gatilho no
    // banco (qa_processo_documentos) — evita duplicar o mesmo aviso.
    if (args.tipo === "documento_processo") return { ok: true, skipped: "trigger" };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let clienteId: number | null = null;
    const cpf = (args.cliente_cpf || "").replace(/\D/g, "");
    if (cpf.length === 11) {
      const { data } = await supabase
        .from("qa_clientes")
        .select("id")
        .eq("cpf", cpf)
        .limit(1)
        .maybeSingle();
      clienteId = (data as { id?: number } | null)?.id ?? null;
    }

    const nome = args.cliente_nome || "Cliente";
    const { error } = await supabase.from("qa_admin_notificacoes").insert({
      tipo: args.tipo,
      status: "em_analise",
      titulo: TITULOS[args.tipo],
      mensagem: `${nome} — ${args.documento_nome}`,
      cliente_id: clienteId,
      cliente_nome: args.cliente_nome ?? null,
      documento_nome: args.documento_nome,
      referencia_tabela: args.tipo === "contrato" ? "qa_contracts" : "qa_procuracoes",
      referencia_id: String(args.contract_id ?? args.procuracao_id ?? ""),
      link: clienteId ? `/clientes/${clienteId}` : null,
      metadata: {
        exigencia: args.exigencia ?? null,
        servico: args.servico ?? null,
        cliente_email: args.cliente_email ?? null,
        cliente_cpf: args.cliente_cpf ?? null,
        ...(args.extras ?? {}),
      },
    });
    if (error) {
      console.error("[notifyAdminUpload] insert falhou", error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    console.error("[notifyAdminUpload] error:", (e as Error).message);
    return { ok: false, error: (e as Error).message };
  }
}
