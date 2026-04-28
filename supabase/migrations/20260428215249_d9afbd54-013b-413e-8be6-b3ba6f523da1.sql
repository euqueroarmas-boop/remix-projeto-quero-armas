-- Corrige bloqueio de exclusão do CR causado pelo trigger imutável de auditoria.
-- Em vez de cascatear DELETE (que aciona o trigger e falha), preservamos os
-- registros de auditoria desvinculando o CR removido.

ALTER TABLE public.qa_senha_gov_acessos
  DROP CONSTRAINT IF EXISTS qa_senha_gov_acessos_cadastro_cr_id_fkey;

ALTER TABLE public.qa_senha_gov_acessos
  ADD CONSTRAINT qa_senha_gov_acessos_cadastro_cr_id_fkey
  FOREIGN KEY (cadastro_cr_id)
  REFERENCES public.qa_cadastro_cr(id)
  ON DELETE SET NULL;