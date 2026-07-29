-- Reconciliacao funcional de identidade civil no checklist.
--
-- Base operacional/juridica Quero Armas:
-- Lei 10.826/2003, Decreto 11.615/2023, Decreto 12.345/2024,
-- IN DG/PF 201 e IN DG/PF 311.
--
-- O requisito do processo e "Documento oficial de identidade", aceitando
-- CIN, RG com CPF ou CNH. O catalogo legado usa `rg_com_cpf` como slot
-- generico de identidade; portanto uma CNH aprovada no Hub deve satisfazer
-- esse slot, assim como a CIN ja fazia.

INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo)
VALUES
  ('rg_com_cpf', 'cin'),
  ('rg_com_cpf', 'cnh')
ON CONFLICT (processo_tipo, hub_tipo) DO NOTHING;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT p.id
      FROM public.qa_processos p
      JOIN public.qa_processo_documentos pd
        ON pd.processo_id = p.id
      JOIN public.qa_documentos_cliente dc
        ON dc.qa_cliente_id = p.cliente_id
     WHERE p.status NOT IN ('cancelado', 'concluido')
       AND pd.tipo_documento = 'rg_com_cpf'
       AND pd.status IN ('pendente', 'rejeitado', 'enviado', 'em_analise', 'revisao_humana')
       AND pd.arquivo_storage_key IS NULL
       AND dc.tipo_documento IN ('cin', 'cnh')
       AND (dc.validado_admin = true OR dc.status = 'aprovado')
       AND dc.arquivo_storage_path IS NOT NULL
       AND (dc.data_validade IS NULL OR dc.data_validade >= CURRENT_DATE)
  LOOP
    PERFORM public.qa_reaproveitar_documentos_hub_processo(r.id, 'backfill_identidade_funcional_cnh');
  END LOOP;
END $$;
