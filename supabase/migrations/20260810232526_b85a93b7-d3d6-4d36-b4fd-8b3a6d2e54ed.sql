INSERT INTO public.qa_tipo_documento_aliases (hub_tipo, processo_tipo) VALUES
  ('laudo_psicologico','atestado_aptidao_psicologica_instituicao'),
  ('laudo_capacidade_tecnica','atestado_capacidade_tecnica_instituicao'),
  ('atestado_aptidao_psicologica_instituicao','laudo_psicologico'),
  ('atestado_capacidade_tecnica_instituicao','laudo_capacidade_tecnica')
ON CONFLICT DO NOTHING;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.id FROM public.qa_processos p WHERE p.status NOT IN ('cancelado','arquivado') LOOP
    PERFORM public.qa_reaproveitar_documentos_hub_processo(p_processo_id := r.id, p_origem := 'equivalencia_exames_instituicao');
  END LOOP;
END $$;