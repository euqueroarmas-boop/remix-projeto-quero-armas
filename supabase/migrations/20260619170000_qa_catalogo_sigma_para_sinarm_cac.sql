-- O sistema SIGMA do Exército migrou para SINARM CAC.
-- Lojas e clubes de tiro ainda usam o SIGMA legado, mas esse perfil
-- não é atendido pela Quero Armas por ora.
-- Renomeia a categoria no catálogo e ajusta o comentário da coluna.

UPDATE public.qa_servicos_catalogo
SET categoria = 'SINARM CAC'
WHERE categoria = 'Exército / SIGMA';
