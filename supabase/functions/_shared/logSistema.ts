import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type LogTipo = "checkout" | "webhook" | "email" | "contrato" | "erro" | "pagamento" | "admin";
export type LogStatus = "success" | "error" | "warning" | "info";

export async function logSistemaBackend(params: {
  tipo: LogTipo;
  status: LogStatus;
  mensagem: string;
  payload?: Record<string, unknown>;
  user_id?: string;
}) {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await supabase.from("logs_sistema").insert({
      tipo: params.tipo,
      status: params.status,
      mensagem: params.mensagem,
      payload: params.payload || {},
      user_id: params.user_id || null,
    });
  } catch (e) {
    console.error("[logSistemaBackend] failed:", e);
  }
}
