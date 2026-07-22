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
