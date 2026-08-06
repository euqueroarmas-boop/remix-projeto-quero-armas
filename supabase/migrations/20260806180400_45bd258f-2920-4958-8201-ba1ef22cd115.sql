DELETE FROM public.qa_tipo_documento_aliases
 WHERE processo_tipo IN ('identidade_funcional','identidade_funcional_digital','carteira_funcional','carteira_identidade_funcional','cedula_identidade_funcional');

INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo) VALUES
  ('identidade_funcional','renda_carteira_funcional'),
  ('identidade_funcional_digital','renda_carteira_funcional'),
  ('carteira_funcional','renda_carteira_funcional'),
  ('carteira_identidade_funcional','renda_carteira_funcional'),
  ('cedula_identidade_funcional','renda_carteira_funcional');