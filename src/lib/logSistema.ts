import { supabase } from "@/integrations/supabase/client";

export type LogTipo = "checkout" | "webhook" | "email" | "contrato" | "erro" | "admin" | "pagamento";
export type LogStatus = "success" | "error" | "warning" | "info";

interface LogParams {
  tipo: LogTipo;
  status: LogStatus;
  mensagem: string;
  payload?: Record<string, unknown>;
  user_id?: string;
}

export async function logSistema({ tipo, status, mensagem, payload, user_id }: LogParams) {
  try {
    const { error } = await supabase.from("logs_sistema" as any).insert({
      tipo,
      status,
      mensagem,
      payload: payload || {},
      user_id: user_id || null,
    });
    if (error) console.error("[logSistema] insert error:", error.message);
  } catch (e) {
    console.error("[logSistema] failed:", e);
  }
}
