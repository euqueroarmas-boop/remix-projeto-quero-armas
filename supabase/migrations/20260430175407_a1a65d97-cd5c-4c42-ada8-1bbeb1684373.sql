-- Realinha a sequence da PK de qa_servicos com o maior id atual.
-- A sequence estava defasada (seq=2, max(id)=29), causando duplicate key
-- ao inserir novos serviços via tela de Configurações.
SELECT setval(
  'public.qa_servicos_id_seq',
  GREATEST((SELECT COALESCE(MAX(id), 1) FROM public.qa_servicos), 1),
  true
);