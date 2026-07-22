-- Corrige 2 findings do scanner de segurança do Lovable:
--
-- 1) Tabela "quotes" (schema de outro negócio, não reconhecido pelo dono do
--    projeto, provável resquício de template) tinha policies USING(true)
--    para anon E authenticated, expondo todos os orçamentos publicamente.
--    A tabela já tem uma policy de service_role com acesso total — toda
--    function server-side usa a service role (que ignora RLS), então
--    remover o acesso público/authenticated não afeta nenhum fluxo real.
DROP POLICY IF EXISTS "Anyone can read quotes" ON public.quotes;
DROP POLICY IF EXISTS "Anyone can insert quote" ON public.quotes;
DROP POLICY IF EXISTS "Authenticated can read quotes" ON public.quotes;
DROP POLICY IF EXISTS "Authenticated can insert quotes" ON public.quotes;

-- 2) View "qa_status_divergencias" (monitoramento interno de divergências
--    financeiras) não tinha security_invoker declarado, então roda com os
--    privilégios de quem a criou em vez do papel de quem consulta,
--    contornando o RLS das tabelas de origem (qa_solicitacoes_servico,
--    qa_vendas). Fix padrão recomendado pela documentação do Supabase.
ALTER VIEW public.qa_status_divergencias SET (security_invoker = on);

-- 3) Tabela "qa_terceiros" (nome completo, CPF, data de nascimento,
--    endereço completo e geolocalização de terceiros vinculados a
--    clientes) ainda tinha as policies originais de 14/04
--    "Anon full access" / "Auth full access" FOR ALL — nunca foi migrada
--    para o padrão staff/owner aplicado em qa_clientes e demais tabelas
--    sensíveis em 26/04. Não há uso desta tabela em nenhum componente do
--    frontend nem em edge function — a restrição não quebra nenhum fluxo.
DROP POLICY IF EXISTS "Anon full access qa_terceiros" ON public.qa_terceiros;
DROP POLICY IF EXISTS "Auth full access qa_terceiros" ON public.qa_terceiros;

CREATE POLICY qa_terceiros_staff_select ON public.qa_terceiros
  FOR SELECT TO authenticated USING (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_terceiros_owner_select ON public.qa_terceiros
  FOR SELECT TO authenticated USING (cliente_id = public.qa_current_cliente_id(auth.uid()));
CREATE POLICY qa_terceiros_staff_insert ON public.qa_terceiros
  FOR INSERT TO authenticated WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_terceiros_staff_update ON public.qa_terceiros
  FOR UPDATE TO authenticated USING (public.qa_is_active_staff(auth.uid())) WITH CHECK (public.qa_is_active_staff(auth.uid()));
CREATE POLICY qa_terceiros_admin_delete ON public.qa_terceiros
  FOR DELETE TO authenticated USING (public.qa_has_qa_perfil(auth.uid(), ARRAY['administrador']));
