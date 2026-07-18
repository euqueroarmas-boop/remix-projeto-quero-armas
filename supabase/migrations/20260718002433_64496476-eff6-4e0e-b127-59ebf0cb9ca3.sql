CREATE POLICY "qa_piloto_eventos_staff_update"
  ON public.qa_piloto_eventos
  FOR UPDATE
  TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));
