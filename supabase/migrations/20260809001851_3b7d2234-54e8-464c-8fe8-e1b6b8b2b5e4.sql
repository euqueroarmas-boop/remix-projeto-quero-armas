CREATE POLICY efetiva_nec_equipe_select ON public.qa_efetiva_necessidade FOR SELECT TO authenticated USING (public.qa_has_qa_perfil(auth.uid(), ARRAY['administrador','operador','advogado']));
CREATE POLICY efetiva_nec_provas_equipe_select ON public.qa_efetiva_necessidade_provas FOR SELECT TO authenticated USING (public.qa_has_qa_perfil(auth.uid(), ARRAY['administrador','operador','advogado']));
GRANT SELECT ON public.qa_efetiva_necessidade TO authenticated;
GRANT SELECT ON public.qa_efetiva_necessidade_provas TO authenticated;