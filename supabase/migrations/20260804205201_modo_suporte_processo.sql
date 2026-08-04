-- Modo suporte por processo: permite que a equipe ative uma visão livre
-- do checklist para o cliente sem exigir envio de documentos.
-- Quando ativo, todas as etapas ficam desbloqueadas e um banner é exibido.

ALTER TABLE public.qa_processos
  ADD COLUMN IF NOT EXISTS suporte_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suporte_ativado_em timestamptz,
  ADD COLUMN IF NOT EXISTS suporte_ativado_por text;

COMMENT ON COLUMN public.qa_processos.suporte_ativo IS
  'Modo suporte ativo: cliente navega o checklist sem bloqueio de etapas. Banner exibido na tela.';
