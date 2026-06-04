// Sincroniza o checklist de processos ativos com o catálogo atual de
// exigências de um serviço. Equipe-only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireQAStaff, qaAuthCors } from "../_shared/qaAuth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: qaAuthCors });

  const guard = await requireQAStaff(req);
  if (!guard.ok) return guard.response;

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const servicoId = Number(body?.servico_id);
  if (!Number.isFinite(servicoId) || servicoId <= 0) {
    return new Response(JSON.stringify({ error: "servico_id obrigatório" }), {
      status: 400, headers: { ...qaAuthCors, "Content-Type": "application/json" },
    });
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service);

  const { data, error } = await admin.rpc(
    "qa_sincronizar_checklist_processos_servico",
    { p_servico_id: servicoId },
  );
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...qaAuthCors, "Content-Type": "application/json" },
    });
  }
  const row = Array.isArray(data) ? data[0] : data;
  return new Response(JSON.stringify({ ok: true, resumo: row }), {
    headers: { ...qaAuthCors, "Content-Type": "application/json" },
  });
});