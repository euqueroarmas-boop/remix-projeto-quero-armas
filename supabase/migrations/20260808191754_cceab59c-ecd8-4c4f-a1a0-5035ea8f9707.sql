ALTER TABLE public.qa_efetiva_necessidade
  ADD COLUMN IF NOT EXISTS narrativa_editada_pelo_cliente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS narrativa_final text,
  ADD COLUMN IF NOT EXISTS aprovacao_ip text,
  ADD COLUMN IF NOT EXISTS aprovacao_user_agent text,
  ADD COLUMN IF NOT EXISTS aprovacao_accept_language text,
  ADD COLUMN IF NOT EXISTS aprovacao_hash text,
  ADD COLUMN IF NOT EXISTS dossie_storage_path text,
  ADD COLUMN IF NOT EXISTS dossie_gerado_em timestamptz,
  ADD COLUMN IF NOT EXISTS exames_liberados_em timestamptz;