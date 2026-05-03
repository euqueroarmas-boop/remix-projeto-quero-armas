// Teste de regressão: garante que imagens IA estão permanentemente bloqueadas
// na Base de Conhecimento Quero Armas (DB + Edge Functions + filtros de leitura).
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

Deno.test("DB: insert image_type='imagem_ia' deve falhar", async () => {
  const { error } = await admin.from("qa_kb_artigo_imagens").insert({
    article_id: "00000000-0000-0000-0000-000000000000",
    image_type: "imagem_ia",
    status: "draft",
    step_number: 0,
  } as any);
  assert(error, "INSERT com imagem_ia deveria ter falhado");
  assert(
    /BLOQUEADO|imagem_ia|check constraint|invalid input/i.test(error!.message),
    `Mensagem inesperada: ${error!.message}`,
  );
});

Deno.test("DB: aprovar registro com origem IA deve falhar", async () => {
  const { data: row } = await admin
    .from("qa_kb_artigo_imagens")
    .select("id,status")
    .eq("is_ai_generated_blocked", true)
    .limit(1)
    .maybeSingle();
  if (!row) return; // sem registros legados, nada a testar
  const { error } = await admin
    .from("qa_kb_artigo_imagens")
    .update({ status: "approved" })
    .eq("id", (row as any).id);
  assert(error, "Aprovar registro IA deveria ter falhado");
});

Deno.test("Edge: qa-kb-generate-article-images retorna 410", async () => {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/qa-kb-generate-article-images`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    body: "{}",
  });
  const body = await r.json();
  assertEquals(r.status, 410);
  assertEquals(body.code, "AI_IMAGE_GENERATION_DISABLED");
});

Deno.test("Edge: qa-kb-backfill-images (backfill) retorna 410", async () => {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/qa-kb-backfill-images`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    body: JSON.stringify({ action: "backfill" }),
  });
  const body = await r.json();
  assertEquals(r.status, 410);
  assertEquals(body.code, "AI_IMAGE_GENERATION_DISABLED");
});

Deno.test("Leitura: nenhuma imagem ativa pode ter origem IA", async () => {
  const { data, error } = await admin
    .from("qa_kb_artigo_imagens")
    .select("id")
    .eq("status", "approved")
    .or("is_ai_generated_blocked.eq.true,original_image_type.eq.imagem_ia");
  assert(!error, error?.message);
  assertEquals((data ?? []).length, 0, "Existem imagens APROVADAS com origem IA");
});