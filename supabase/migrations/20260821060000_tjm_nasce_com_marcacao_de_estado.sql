-- =============================================================================
-- A certidão do TJM nasce marcada SP/MG/RS, sempre
-- -----------------------------------------------------------------------------
-- Sobra da leva 16, apontada pela revisão e confirmada pelo titular em 21/08.
--
-- A migration `20260821040000` carimbou `condicao_uf = {SP,MG,RS}` em toda
-- linha de `antecedentes_militar_estadual` que existia NAQUELE momento. Mas o
-- carimbo foi um UPDATE de uma vez só: uma linha de TJM criada DEPOIS — num
-- serviço novo, ou numa migration futura que copie o checklist de outro
-- serviço, como a `20260820230000` fez com o serviço 50 — nasce com
-- `condicao_uf` vazio. E vazio significa "todas as UFs": o Tribunal de Justiça
-- Militar volta a ser exigido de quem mora onde ele não existe, e ninguém fica
-- sabendo até um cliente reclamar.
--
-- Estava escrito no comentário da migration anterior. Escrito não é travado.
--
-- ─── O QUE ESTE GATILHO FAZ ──────────────────────────────────────────────────
--
-- Antes de gravar uma linha de catálogo do tipo `antecedentes_militar_estadual`
-- com `condicao_uf` vazio, preenche com SP, MG e RS. Só isso.
--
-- NÃO sobrescreve marcação explícita: se um dia o titular decidir que aquele
-- serviço pede o TJM só de São Paulo, basta gravar `{SP}` e o gatilho respeita.
-- NÃO toca em nenhum outro tipo de documento.
--
-- Tribunal de Justiça Militar estadual existe em três estados — São Paulo,
-- Minas Gerais e Rio Grande do Sul. Nos outros 24 não há a quem pedir.
--
-- Idempotente.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.qa_tjm_marca_uf_padrao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tipo_documento = 'antecedentes_militar_estadual'
     AND NEW.condicao_uf IS NULL THEN
    NEW.condicao_uf := ARRAY['SP','MG','RS'];
  END IF;
  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.qa_tjm_marca_uf_padrao() IS
  'A certidão do Tribunal de Justiça Militar estadual só pode ser exigida em '
  'SP, MG e RS — nos outros 24 estados o tribunal não existe. Este gatilho '
  'garante que linha nova de catálogo desse tipo nasça com a marcação, para '
  'que a exigência impossível não volte por descuido. Marcação explícita '
  'diferente é respeitada.';

DROP TRIGGER IF EXISTS qa_trg_tjm_marca_uf_padrao ON public.qa_servicos_documentos;
CREATE TRIGGER qa_trg_tjm_marca_uf_padrao
  BEFORE INSERT OR UPDATE OF tipo_documento, condicao_uf
  ON public.qa_servicos_documentos
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_tjm_marca_uf_padrao();

-- Rede de segurança: se alguma linha de TJM tiver escapado entre a leva 16 e
-- este gatilho, é carimbada agora. Inclui linha INATIVA de propósito — se ela
-- for reativada um dia, já vem certa.
UPDATE public.qa_servicos_documentos
   SET condicao_uf = ARRAY['SP','MG','RS'],
       updated_at  = now()
 WHERE tipo_documento = 'antecedentes_militar_estadual'
   AND condicao_uf IS NULL;

COMMIT;

-- =============================================================================
-- CONFERÊNCIA (rodar depois, UMA DE CADA VEZ)
--
-- A) O gatilho existe. Esperado: 1 linha.
--
-- SELECT tgname FROM pg_trigger WHERE tgname = 'qa_trg_tjm_marca_uf_padrao';
--
-- B) NENHUMA linha de TJM sem marcação, ativa ou inativa. Esperado: 0 linhas.
--    (Sem filtro de `ativo` de propósito: a conferência da leva 16 filtrava por
--    ativo e por isso não mostrava tudo que o carimbo tinha alcançado.)
--
-- SELECT servico_id, tipo_documento, condicao_uf, ativo
--   FROM public.qa_servicos_documentos
--  WHERE tipo_documento = 'antecedentes_militar_estadual'
--    AND condicao_uf IS NULL;
--
-- C) Teste do gatilho SEM sujar o catálogo — insere, confere e desfaz.
--    Esperado: a coluna `condicao_uf` volta preenchida com {SP,MG,RS}.
--
-- BEGIN;
--   INSERT INTO public.qa_servicos_documentos
--     (servico_id, tipo_documento, nome_documento, etapa, ordem, ativo)
--   VALUES (999999, 'antecedentes_militar_estadual', 'TESTE DO GATILHO', 'base', 1, false);
--   SELECT servico_id, tipo_documento, condicao_uf
--     FROM public.qa_servicos_documentos WHERE servico_id = 999999;
-- ROLLBACK;
-- =============================================================================
