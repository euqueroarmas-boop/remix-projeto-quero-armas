import { createClient } from "@supabase/supabase-js";
const URL = process.env.VITE_SUPABASE_URL;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL, SR);

// Apagar armas teste (cascata na auditoria? não — auditoria é imutável; vamos limpar via SQL admin)
// Apagar via service_role bypass RLS mas auditoria tem trigger BLOCK delete — então 
// vamos primeiro apagar auditoria via psql (não daqui), depois armas.
// Aqui só remove auth users.

const uids = [
  "990ccc3a-f261-495e-bbf7-ff4d067c1041",
  "d4bc6d5e-519c-46cd-8ce0-2bdeabc683e1",
  "b77e6d16-78e7-4caf-b214-749c8affc760",
];
for (const u of uids) {
  const r = await admin.auth.admin.deleteUser(u);
  console.log("delete user", u, r.error?.message || "ok");
}
