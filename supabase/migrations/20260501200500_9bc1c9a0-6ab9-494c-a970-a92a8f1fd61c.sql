-- Toca o nome para forçar o trigger BEFORE UPDATE OF nome a rodar.
UPDATE public.qa_servicos_catalogo
   SET nome = nome
 WHERE ativo = true;