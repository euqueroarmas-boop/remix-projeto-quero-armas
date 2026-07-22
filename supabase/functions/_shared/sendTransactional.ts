// Helper para enfileirar e-mails transacionais via send-transactional-email.
// Substitui chamadas antigas a send-smtp-email pelos templates Lovable Emails.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface SendTransactionalArgs {
  templateName: string;
  recipientEmail: string;
  idempotencyKey: string;
  templateData?: Record<string, unknown>;
}

export interface SendTransactionalResult {
  ok: boolean;
  queued?: boolean;
  error?: string;
}

export async function sendTransactional(args: SendTransactionalArgs): Promise<SendTransactionalResult> {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await supabase.functions.invoke("send-transactional-email", {
      body: {
        templateName: args.templateName,
        recipientEmail: args.recipientEmail,
        idempotencyKey: args.idempotencyKey,
        templateData: args.templateData ?? {},
      },
    });
    if (error) return { ok: false, error: error.message };
    const ok = Boolean(data?.success || data?.queued);
    return {
      ok,
      queued: Boolean(data?.queued),
      error: ok ? undefined : String(data?.error || data?.reason || "E-mail não enfileirado"),
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
