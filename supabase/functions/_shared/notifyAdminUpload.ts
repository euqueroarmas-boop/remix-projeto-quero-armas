// Helper para avisar o admin (eu@queroarmas.com.br) sempre que um cliente
// entrega um documento no portal (contrato assinado, procuração assinada
// ou qualquer item do checklist de processo). Usa send-smtp-email, que já
// está configurado no projeto.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ADMIN_EMAIL = "eu@queroarmas.com.br";
const BRAND = "ARSENAL INTELIGENTE";

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

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const TITULOS: Record<AdminUploadTipo, string> = {
  contrato: "Contrato assinado recebido",
  procuracao: "Procuração assinada recebida",
  documento_processo: "Documento enviado pelo cliente",
};

export async function notifyAdminUpload(args: NotifyAdminUploadArgs) {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const titulo = TITULOS[args.tipo];
    const rows: Array<[string, string]> = [
      ["Cliente", args.cliente_nome || "—"],
      ["E-mail", args.cliente_email || "—"],
      ["CPF", args.cliente_cpf || "—"],
      ["Documento enviado", args.documento_nome || "—"],
    ];
    if (args.exigencia) rows.push(["Exigência cumprida", args.exigencia]);
    if (args.servico) rows.push(["Serviço", args.servico]);
    if (args.processo_id) rows.push(["Processo", String(args.processo_id)]);
    if (args.contract_id) rows.push(["Contrato", String(args.contract_id)]);
    if (args.procuracao_id) rows.push(["Procuração", String(args.procuracao_id)]);
    if (args.extras) {
      for (const [k, v] of Object.entries(args.extras)) {
        if (v != null && v !== "") rows.push([k, String(v)]);
      }
    }
    rows.push([
      "Data",
      new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    ]);

    const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f6f7f9;margin:0;padding:24px;color:#0f172a;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(15,23,42,0.06);">
<tr><td style="background:#0f172a;padding:22px 28px;color:#fff;">
<div style="font-size:11px;letter-spacing:0.18em;color:#fbbf24;font-weight:700;">${BRAND} · ADMIN</div>
<div style="font-size:20px;font-weight:700;margin-top:6px;">${esc(titulo)}</div>
</td></tr>
<tr><td style="padding:24px 28px;">
<p style="margin:0 0 12px;font-size:14px;">O cliente enviou um novo documento pelo portal.</p>
<table cellpadding="6" cellspacing="0" style="width:100%;font-size:13px;border-collapse:collapse;margin-top:8px;">
${rows.map(([k, v]) => `<tr><td style="color:#64748b;width:180px;">${esc(k)}</td><td><strong>${esc(v)}</strong></td></tr>`).join("")}
</table>
</td></tr>
<tr><td style="background:#f8fafc;padding:14px 28px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">© ${new Date().getFullYear()} ${BRAND} — notificação automática.</td></tr>
</table></td></tr></table></body></html>`;

    const text = `${titulo}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n— ${BRAND}`;

    const traceId = args.trace_id || `admin-upload-${crypto.randomUUID()}`;
    const internalToken = Deno.env.get("INTERNAL_FUNCTION_TOKEN") ?? "";
    const subject = `${titulo} — ${args.cliente_nome || "Cliente"} — ${BRAND}`;

    const res = await supabase.functions.invoke("send-smtp-email", {
      headers: { "x-internal-token": internalToken },
      body: { to: ADMIN_EMAIL, subject, html, text, trace_id: traceId },
    });
    const ok = !res.error && (res.data as { success?: boolean } | null)?.success !== false;
    if (!ok) {
      console.error("[notifyAdminUpload] send-smtp-email falhou", res.error || res.data);
    }
    return { ok, traceId };
  } catch (e) {
    console.error("[notifyAdminUpload] error:", (e as Error).message);
    return { ok: false, error: (e as Error).message };
  }
}