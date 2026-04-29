import { createClient } from "@supabase/supabase-js";
const URL = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const c = createClient(URL, ANON);
const { data } = await c.auth.signInWithPassword({ email: "fase61.equipe@queroarmas.test", password: "Teste@F61E!xx" });
const eqp = createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${data.session.access_token}` } } });

// UPDATE forçando retornar linhas
const r1 = await eqp.from("qa_cliente_armas_auditoria").update({ acao: "editada" }).eq("id", 6).select();
console.log("UPDATE id=6 (era 'criada'):", r1);

// DELETE forçando retornar linhas
const r2 = await eqp.from("qa_cliente_armas_auditoria").delete().eq("id", 11).select();
console.log("DELETE id=11:", r2);
