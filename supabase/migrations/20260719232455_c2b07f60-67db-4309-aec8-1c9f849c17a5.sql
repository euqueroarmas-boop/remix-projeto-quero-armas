
-- 1. Preenche cidade a partir do bairro para todos os credenciados PF.
UPDATE public.qa_psico_credenciados
   SET cidade = bairro
 WHERE cidade IS NULL
   AND bairro IS NOT NULL
   AND bairro <> '';

-- 2. Zera coordenadas que foram geocodadas sem cidade real
--    (rua homônima em cidade errada). Só zeramos onde o cache antigo
--    guardou centroide de rua sem casar cidade — atalho: reset em todos
--    que tiveram cidade ausente até agora. Fica pendente para o backfill.
UPDATE public.qa_psico_credenciados
   SET latitude = NULL,
       longitude = NULL,
       geocode_tentativas = 0,
       geocode_falhou = FALSE
 WHERE tipo = 'psicologo'
   AND ativo = TRUE
   AND endereco IS NOT NULL
   AND latitude IS NOT NULL;

-- 3. Limpa o cache de geocode antigo que foi resolvido sem cidade,
--    forçando o próximo backfill a recalcular com a cidade correta.
DELETE FROM public.qa_endereco_geocache
 WHERE endereco_normalizado NOT LIKE '%|%|%';
