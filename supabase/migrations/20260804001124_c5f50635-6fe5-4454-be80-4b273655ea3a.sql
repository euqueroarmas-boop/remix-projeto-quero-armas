CREATE POLICY "login_eventos_staff_select"
ON public.qa_cliente_login_eventos
FOR SELECT TO authenticated
USING (public.qa_is_active_staff(auth.uid()));