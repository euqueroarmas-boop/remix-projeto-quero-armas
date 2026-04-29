import { createClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CLI_A = 99, CLI_B = 100;
const EM_A = "fase61.cliente.a@queroarmas.test";
const EM_B = "fase61.cliente.b@queroarmas.test";
const EM_E = "fase61.equipe@queroarmas.test";
const PW_A = "Teste@F61A!xx", PW_B = "Teste@F61B!xx", PW_E = "Teste@F61E!xx";

async function login(email, pass) {
  const c = createClient(URL, ANON);
  const { data, error } = await c.auth.signInWithPassword({ email, password: pass });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${data.session.access_token}` } } });
}

const admin = createClient(URL, SR);
const cliA = await login(EM_A, PW_A);
const cliB = await login(EM_B, PW_B);
const eqp = await login(EM_E, PW_E);

console.log("=== T1: cliente A insere arma (portal) ===");
let { data: arma_a, error: e1 } = await cliA.from("qa_cliente_armas_manual").insert({
  qa_cliente_id: CLI_A, user_id: (await cliA.auth.getUser()).data.user.id,
  origem: "manual", sistema: "SINARM", marca: "TESTE F61", modelo: "MOD-A-001", calibre: ".380 ACP"
}).select().single();
console.log({ ok: !e1, id: arma_a?.id, err: e1?.message });

console.log("=== T2: cliente A edita própria ===");
let { error: e2 } = await cliA.from("qa_cliente_armas_manual").update({ calibre: ".40 S&W" }).eq("id", arma_a.id);
console.log({ ok: !e2, err: e2?.message });

console.log("=== T3a: equipe edita marca ===");
let { error: e3a } = await eqp.from("qa_cliente_armas_manual").update({ marca: "TESTE F61 EQUIPE" }).eq("id", arma_a.id);
console.log({ ok: !e3a, err: e3a?.message });

console.log("=== T3b: equipe marca needs_review=true ===");
let { error: e3b } = await eqp.from("qa_cliente_armas_manual").update({ needs_review: true }).eq("id", arma_a.id);
console.log({ ok: !e3b, err: e3b?.message });

console.log("=== T3c: equipe marca needs_review=false (revisada) ===");
let { error: e3c } = await eqp.from("qa_cliente_armas_manual").update({ needs_review: false }).eq("id", arma_a.id);
console.log({ ok: !e3c, err: e3c?.message });

console.log("=== T4: cliente B insere arma própria ===");
let { data: arma_b, error: e4 } = await cliB.from("qa_cliente_armas_manual").insert({
  qa_cliente_id: CLI_B, user_id: (await cliB.auth.getUser()).data.user.id,
  origem: "manual", sistema: "SINARM", marca: "TESTE F61 B", modelo: "MOD-B-001", calibre: "9MM"
}).select().single();
console.log({ ok: !e4, id: arma_b?.id, err: e4?.message });

console.log("\n=== RLS T5a: cliente B vê auditoria ===");
let { data: visB } = await cliB.from("qa_cliente_armas_auditoria").select("id,qa_cliente_id,acao,ator_tipo,origem");
console.log("visíveis para B:", visB?.length, "vazamento de A:", visB?.filter(r=>r.qa_cliente_id===CLI_A).length);

console.log("=== RLS T5b: cliente A vê auditoria ===");
let { data: visA } = await cliA.from("qa_cliente_armas_auditoria").select("id,qa_cliente_id,acao,ator_tipo,origem");
console.log("visíveis para A:", visA?.length, "vazamento de B:", visA?.filter(r=>r.qa_cliente_id===CLI_B).length);

console.log("=== RLS T5c: equipe vê tudo ===");
let { data: visE } = await eqp.from("qa_cliente_armas_auditoria").select("id,qa_cliente_id,acao,ator_tipo,origem")
  .in("qa_cliente_id", [CLI_A, CLI_B]);
console.log("visíveis para equipe:", visE?.length);

console.log("\n=== IMUTABILIDADE T6a: equipe tenta UPDATE auditoria ===");
let { error: e6a, count: c6a } = await eqp.from("qa_cliente_armas_auditoria").update({ acao: "editada" }).eq("qa_cliente_id", CLI_A).select("*", { count: "exact", head: true });
console.log({ blocked: !!e6a || c6a === 0, err: e6a?.message, affected: c6a });

console.log("=== IMUTABILIDADE T6b: equipe tenta DELETE ===");
let { error: e6b, count: c6b } = await eqp.from("qa_cliente_armas_auditoria").delete().eq("qa_cliente_id", CLI_A).select("*", { count: "exact", head: true });
console.log({ blocked: !!e6b || c6b === 0, err: e6b?.message, affected: c6b });

console.log("=== IMUTABILIDADE T6c: equipe tenta INSERT manual ===");
let { error: e6c } = await eqp.from("qa_cliente_armas_auditoria").insert({
  arma_manual_id: arma_a.id, qa_cliente_id: CLI_A, ator_tipo: "equipe", acao: "editada", origem: "modulo_clientes"
});
console.log({ blocked: !!e6c, err: e6c?.message });

console.log("\n=== IDS PARA LIMPEZA ===");
console.log({ arma_a: arma_a.id, arma_b: arma_b.id });
