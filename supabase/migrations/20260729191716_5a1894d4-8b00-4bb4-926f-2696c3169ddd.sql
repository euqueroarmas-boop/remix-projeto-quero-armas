-- 20260729161000_qa_identidade_funcional_cnh_reaproveitamento
-- Equivalência funcional de identidade civil: CIN, RG com CPF ou CNH.

INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo) VALUES
  ('cin', 'cnh'),
  ('cin', 'rg_com_cpf'),
  ('rg_com_cpf', 'cnh'),
  ('rg_com_cpf', 'rg_com_cpf'),
  ('cin', 'cin')
ON CONFLICT DO NOTHING;

-- Backfill: reaproveita CNH/CIN/RG aprovados no Hub em processos abertos
-- que ainda tenham slot de identidade pendente.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT pd.processo_id
      FROM public.qa_processo_documentos pd
      JOIN public.qa_processos p ON p.id = pd.processo_id
     WHERE pd.tipo_documento IN ('cin','rg_com_cpf')
       AND pd.status IN ('pendente','rejeitado','enviado','em_analise','revisao_humana')
       AND pd.arquivo_storage_key IS NULL
       AND COALESCE(p.status,'') NOT IN ('concluido','cancelado','arquivado')
       AND EXISTS (
         SELECT 1 FROM public.qa_documentos_cliente dc
          WHERE dc.qa_cliente_id = p.cliente_id
            AND dc.tipo_documento IN ('cnh','cin','rg_com_cpf')
            AND (dc.validado_admin = true OR dc.status = 'aprovado')
            AND dc.arquivo_storage_path IS NOT NULL
            AND (dc.data_validade IS NULL OR dc.data_validade >= CURRENT_DATE)
       )
  LOOP
    PERFORM public.qa_reaproveitar_documentos_hub_processo(r.processo_id, 'backfill_identidade_funcional');
  END LOOP;
END $$;