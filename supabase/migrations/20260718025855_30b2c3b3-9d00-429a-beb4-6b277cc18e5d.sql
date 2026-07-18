DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT p.id
      FROM public.qa_processos p
      JOIN public.qa_processo_documentos pd ON pd.processo_id = p.id
     WHERE p.status NOT IN ('cancelado','concluido')
       AND pd.status IN ('pendente','rejeitado','enviado','em_analise','revisao_humana')
       AND pd.arquivo_storage_key IS NULL
  LOOP
    PERFORM public.qa_reaproveitar_documentos_hub_processo(r.id, 'backfill_pos_seed');
  END LOOP;
END $$;