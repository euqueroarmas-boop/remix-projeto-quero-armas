CREATE OR REPLACE FUNCTION public.qa_marcar_contrato_ack(_contract_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.qa_contracts
     SET customer_ack_completed_at = now()
   WHERE id = _contract_id
     AND customer_ack_completed_at IS NULL
     AND (cliente_id = public.qa_current_cliente_id(auth.uid()) OR public.qa_is_active_staff(auth.uid()));
$$;

GRANT EXECUTE ON FUNCTION public.qa_marcar_contrato_ack(uuid) TO authenticated;