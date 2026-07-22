-- Torna pesquisável publicamente (leitura, sem escrita) o diretório de
-- psicólogos/instrutores PF credenciados e o catálogo de clubes de tiro,
-- para alimentar uma busca na home do site. Escrita continua restrita à
-- equipe (staff/admin) — apenas SELECT é liberado para anon.
--
-- qa_iat_credenciados já é público desde a criação; qa_psico_credenciados
-- (psicólogos + instrutores PF, renomeada de qa_pf_credenciados) e
-- qa_clubes só permitiam leitura autenticada.

GRANT SELECT ON public.qa_psico_credenciados TO anon;
CREATE POLICY qa_psico_credenciados_public_select
  ON public.qa_psico_credenciados FOR SELECT TO anon USING (ativo = true);

GRANT SELECT ON public.qa_clubes TO anon;
CREATE POLICY qa_clubes_public_select
  ON public.qa_clubes FOR SELECT TO anon USING (true);
