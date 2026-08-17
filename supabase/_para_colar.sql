-- ############################################################################
-- PARA COLAR NO SQL EDITOR DO SUPABASE — Bloco 9 (17/08/2026)
-- ----------------------------------------------------------------------------
-- INCREMENTAL sobre o Bloco 8 (v2), que ja foi aplicado com sucesso.
-- Guarda o processo ESCOLHIDO na lista, e nao so o nome digitado.
-- Reexecutavel.
-- ############################################################################

ALTER TABLE public.qa_emu_sessoes
  ADD COLUMN IF NOT EXISTS processo_id uuid;

CREATE INDEX IF NOT EXISTS qa_emu_sessoes_processo_idx
  ON public.qa_emu_sessoes (processo_id)
  WHERE processo_id IS NOT NULL;

-- ############################################################################
-- CONFERENCIA — deve devolver 1 linha: processo_id | uuid | YES
-- ############################################################################
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'qa_emu_sessoes' AND column_name = 'processo_id';
