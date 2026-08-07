-- =============================================================================
-- BLOCO 4B — Autorização de Compra/Posse de Arma de Fogo para Defesa Pessoal:
-- remove exigências de documentos que não pertencem a este serviço
--
-- Decisão do usuário (07/08/2026): os tipos abaixo são de outros fluxos —
-- acervo de coleção e CAC (colecionador/atirador/caçador) — e não deveriam
-- ser exigidos no serviço de compra/posse de arma de fogo para defesa pessoal:
--   declaracao_guarda_acervo_1endereco       (acervo de coleção)
--   declaracao_guarda_acervo_2enderecos      (acervo de coleção)
--   declaracao_nao_possuir_segundo_endereco  (acervo de coleção)
--   gte                                      (guia de trânsito especial — CAC)
--   habilitacao_cacador_ibama                (CAC caçador)
--   comprovante_competicao                   (CAC atirador)
--   outro                                    (genérico, sem função neste serviço)
--
-- Os sete tipos continuam válidos no CHECK do Hub — outros serviços/processos
-- (CAC, acervo) seguem usando-os. Este bloco só os tira do CATÁLOGO e das
-- EXIGÊNCIAS do serviço "Autorização de Compra/Posse de Arma de Fogo para
-- Defesa Pessoal" especificamente.
--
-- Idempotente.
-- =============================================================================

BEGIN;

CREATE TEMP TABLE _tipos_indevidos_defesa_pessoal (slug text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO _tipos_indevidos_defesa_pessoal (slug) VALUES
  ('declaracao_guarda_acervo_1endereco'),
  ('declaracao_guarda_acervo_2enderecos'),
  ('declaracao_nao_possuir_segundo_endereco'),
  ('gte'),
  ('habilitacao_cacador_ibama'),
  ('comprovante_competicao'),
  ('outro');

-- Catálogo do serviço deixa de exigir estes tipos
UPDATE public.qa_servicos_documentos sd
   SET ativo = false, updated_at = now()
  FROM _tipos_indevidos_defesa_pessoal t, public.qa_servicos s
 WHERE sd.tipo_documento = t.slug
   AND sd.servico_id = s.id
   AND s.nome_servico = 'Autorização de Compra/Posse de Arma de Fogo para Defesa Pessoal';

-- Exigências abertas em processos ativos deste serviço encerram
UPDATE public.qa_processo_documentos pd
   SET status = 'nao_aplicavel',
       observacoes = COALESCE(pd.observacoes, '') ||
         CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Exigência removida: este documento não pertence ao serviço de defesa pessoal.',
       updated_at = now()
  FROM _tipos_indevidos_defesa_pessoal t, public.qa_processos p, public.qa_servicos s
 WHERE pd.tipo_documento = t.slug
   AND p.id = pd.processo_id
   AND p.servico_id = s.id
   AND s.nome_servico = 'Autorização de Compra/Posse de Arma de Fogo para Defesa Pessoal'
   AND pd.status NOT IN ('aprovado','nao_aplicavel')
   AND COALESCE(p.status, '') NOT IN ('finalizado','deferido','indeferido','cancelado');

COMMIT;
