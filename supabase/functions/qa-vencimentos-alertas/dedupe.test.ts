import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

/**
 * Validações de dedupe para qa_vencimentos_alertas_enviados.
 * Não dispara e-mails reais. Apenas testa a constraint UNIQUE
 * (fonte, ref_id, marco_dias, canal, data_referencia).
 */

Deno.test({
  name: "dedupe: dois candidatos iguais resultam em 1 inserção",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const ref_id = `test:dedupe:${crypto.randomUUID()}`;
  const base = {
    fonte: "CR",
    ref_id,
    marco_dias: 30,
    canal: "email_cliente",
    destinatario: "test@example.com",
    data_referencia: "2030-01-01",
    status: "enviado",
  };

  // 1ª inserção (esperado: ok)
  const r1 = await sb.from("qa_vencimentos_alertas_enviados").insert(base);
  assertEquals(r1.error, null);

  // 2ª inserção idêntica — UNIQUE deve bloquear
  const r2 = await sb.from("qa_vencimentos_alertas_enviados").insert(base);
  assert(r2.error !== null, "esperava erro de UNIQUE");
  assert(
    String(r2.error?.code) === "23505" ||
      String(r2.error?.message).toLowerCase().includes("duplicate"),
    `esperava 23505/duplicate, recebeu: ${r2.error?.code} ${r2.error?.message}`,
  );

  // upsert com ignoreDuplicates não deve gerar 2ª linha
  const upsert = await sb.from("qa_vencimentos_alertas_enviados").upsert([base], {
    onConflict: "fonte,ref_id,marco_dias,canal,data_referencia",
    ignoreDuplicates: true,
  });
  assertEquals(upsert.error, null);

  const { data, error } = await sb
    .from("qa_vencimentos_alertas_enviados")
    .select("id")
    .eq("ref_id", ref_id);
  assertEquals(error, null);
  assertEquals(data?.length, 1);

  // Limpeza
  await sb.from("qa_vencimentos_alertas_enviados").delete().eq("ref_id", ref_id);
  },
});

Deno.test({
  name: "dedupe: nova data_referencia permite reenviar",
  sanitizeOps: false,
  sanitizeResources: false,
  fn: async () => {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const ref_id = `test:reciclo:${crypto.randomUUID()}`;
  const base = {
    fonte: "CRAF",
    ref_id,
    marco_dias: 30,
    canal: "email_cliente",
    destinatario: "test@example.com",
    status: "enviado",
  };

  const r1 = await sb
    .from("qa_vencimentos_alertas_enviados")
    .insert({ ...base, data_referencia: "2030-01-01" });
  assertEquals(r1.error, null);

  // Renovação: nova data_referencia → deve permitir nova inserção
  const r2 = await sb
    .from("qa_vencimentos_alertas_enviados")
    .insert({ ...base, data_referencia: "2031-01-01" });
  assertEquals(r2.error, null);

  const { data } = await sb
    .from("qa_vencimentos_alertas_enviados")
    .select("id")
    .eq("ref_id", ref_id);
  assertEquals(data?.length, 2);

  await sb.from("qa_vencimentos_alertas_enviados").delete().eq("ref_id", ref_id);
  },
});