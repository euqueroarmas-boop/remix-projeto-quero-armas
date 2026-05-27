-- Estende qa_clubes com origem, status_verificacao e rastreabilidade
ALTER TABLE public.qa_clubes
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS status_verificacao text NOT NULL DEFAULT 'verificado',
  ADD COLUMN IF NOT EXISTS processo_id_origem uuid NULL,
  ADD COLUMN IF NOT EXISTS cliente_id_origem integer NULL,
  ADD COLUMN IF NOT EXISTS documento_id_origem uuid NULL,
  ADD COLUMN IF NOT EXISTS atualizado_em timestamptz NOT NULL DEFAULT now();

-- Constraints
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qa_clubes_status_verificacao_check') THEN
    ALTER TABLE public.qa_clubes
      ADD CONSTRAINT qa_clubes_status_verificacao_check
      CHECK (status_verificacao IN ('verificado','pendente_revisao'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'qa_clubes_origem_check') THEN
    ALTER TABLE public.qa_clubes
      ADD CONSTRAINT qa_clubes_origem_check
      CHECK (origem IN ('manual','declaracao_filiacao_cliente','lead_publico','importacao_legado'));
  END IF;
END $$;

-- Índices auxiliares
CREATE INDEX IF NOT EXISTS qa_clubes_cnpj_idx ON public.qa_clubes (cnpj) WHERE cnpj IS NOT NULL;
CREATE INDEX IF NOT EXISTS qa_clubes_numero_cr_idx ON public.qa_clubes (numero_cr) WHERE numero_cr IS NOT NULL;
CREATE INDEX IF NOT EXISTS qa_clubes_status_idx ON public.qa_clubes (status_verificacao);

-- Trigger de atualizado_em
CREATE OR REPLACE FUNCTION public.qa_clubes_set_atualizado_em()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qa_clubes_atualizado_em_trg ON public.qa_clubes;
CREATE TRIGGER qa_clubes_atualizado_em_trg
  BEFORE UPDATE ON public.qa_clubes
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_clubes_set_atualizado_em();

-- RLS: mantém escrita restrita a staff. NÃO criar policy de insert para auth/anon.
-- (policies existentes: qa_clubes_auth_select, qa_clubes_staff_insert, qa_clubes_staff_update, qa_clubes_admin_delete)
-- Cliente sugere clube via edge function service_role (qa-clube-sugerir).

-- Adiciona colunas de filiação em qa_clientes (nullable)
ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS numero_filiacao text NULL,
  ADD COLUMN IF NOT EXISTS validade_filiacao date NULL,
  ADD COLUMN IF NOT EXISTS clube_atual_id integer NULL REFERENCES public.qa_clubes(id) ON DELETE SET NULL;