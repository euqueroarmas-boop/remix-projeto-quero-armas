UPDATE public.qa_admin_notificacoes
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{motivo_rejeicao}',
  to_jsonb('Documento diferente do exigido no envio aberto.'::text),
  true
)
WHERE metadata->>'motivo_rejeicao' = 'tipo';