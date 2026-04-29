import { createClient } from "@supabase/supabase-js";
const URL = process.env.VITE_SUPABASE_URL;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SR);

// 1) Cria arma TESTE F7 needs_review=true para o Will (id=46)
const { data: arma, error } = await admin.from("qa_cliente_armas_manual").insert({
  qa_cliente_id: 46,
  user_id: null,           // sistema/admin teste
  origem: "manual",
  sistema: "SINARM",
  marca: "TESTE F7",
  modelo: "QA REVISAO FASE7",
  calibre: "9MM",
  needs_review: true,
}).select().single();
if (error) { console.error("ERR", error); process.exit(1); }
console.log("Criada arma teste id=", arma.id, "needs_review=", arma.needs_review);

// 2) View deve agora retornar 25 armas para o Will
const { data: view } = await admin.from("qa_cliente_armas").select("arma_uid,fonte,needs_review,marca,modelo")
  .eq("qa_cliente_id", 46);
console.log("Total view Will:", view.length, "needs_review:", view.filter(r=>r.needs_review).length);
console.log("Arma teste no topo?", view.find(r=>r.marca==="TESTE F7"));

// salvar id pra cleanup
console.log("ARMA_TESTE_F7_ID=", arma.id);
