-- 1) Nova coluna de bloqueio na Etapa 02
ALTER TABLE public.qa_servicos_documentos
  ADD COLUMN IF NOT EXISTS obrigatorio_etapa02 BOOLEAN NOT NULL DEFAULT false;

-- 2) Marcar como obrigatórios os tipos canônicos de identidade + residência
UPDATE public.qa_servicos_documentos
SET obrigatorio_etapa02 = true
WHERE tipo_documento IN ('cnh', 'rg_com_cpf', 'comprovante_residencia');

-- 3) Permitir leitura pública (anon) restrita a registros ativos.
--    Visitantes anônimos precisam carregar o checklist na Etapa 02 (/cadastro-v2).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.qa_servicos_documentos'::regclass
      AND polname = 'qa_servicos_documentos_public_read'
  ) THEN
    CREATE POLICY qa_servicos_documentos_public_read
      ON public.qa_servicos_documentos
      FOR SELECT
      TO anon, authenticated
      USING (ativo = true);
  END IF;
END $$;