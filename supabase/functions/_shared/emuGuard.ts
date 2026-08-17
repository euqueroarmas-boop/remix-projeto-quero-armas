// MODO ESPELHO — guarda de compra para edge functions.
//
// As funções de checkout rodam com service_role (e são chamáveis por anon, no
// fluxo público), então o trigger `qa_emu_block_compra` não as alcança: para o
// banco elas não têm auth.uid(). Aqui fechamos esse flanco olhando o JWT que
// veio na chamada — se for de um operador com janela de espelho aberta, recusa.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const EMU_MENSAGEM_BLOQUEIO =
  "Modo espelho: contratação, pagamento e assinatura de contrato só podem ser feitos pelo próprio cliente.";

/**
 * `true` quando quem chamou está com uma sessão de espelho ativa.
 * Chamada sem Authorization (checkout público de visitante) devolve `false`.
 * Falha de rede/banco também devolve `false`: a guarda nunca derruba o
 * checkout legítimo de um cliente real.
 */
export async function chamadorEmEspelho(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return false;

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const resp = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anon },
    });
    if (!resp.ok) return false;
    const user = await resp.json();
    const userId = String(user?.id || "");
    if (!userId) return false;

    const admin = createClient(url, service);
    const { data } = await admin
      .from("qa_emu_sessoes")
      .select("id")
      .eq("operador_user_id", userId)
      .is("encerrado_em", null)
      .gt("expira_em", new Date().toISOString())
      .limit(1)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}

/** Resposta pronta (403) para quando `chamadorEmEspelho` for verdadeiro. */
export function respostaEmEspelho(corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: "modo_espelho_bloqueado", message: EMU_MENSAGEM_BLOQUEIO }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
