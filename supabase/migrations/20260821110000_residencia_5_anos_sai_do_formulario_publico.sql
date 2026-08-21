-- =============================================================================
-- A RESIDÊNCIA DOS 5 ANOS SAI DO FORMULÁRIO PÚBLICO
-- -----------------------------------------------------------------------------
-- Decisão do titular (21/08/2026):
--
--   "Sobre o formulário público, não é pra ter nada lá disso. E tudo no
--    formulário interno. Não tem sentido isso estar no formulário público
--    quando o cliente está no checkout, porque é o único formulário que temos.
--    Essa pergunta é pra vir depois que o cliente manda seu comprovante de
--    endereço, para clientes CACs."
--
-- O formulário público é o do CHECKOUT — a única porta de entrada que existe, e
-- por isso já carrega tudo. Perguntar ali onde a pessoa morou nos últimos cinco
-- anos, antes mesmo de ela ser cliente e antes de qualquer comprovante, é fora
-- de hora. A pergunta pertence ao checklist do processo, depois do comprovante
-- de endereço, e a lista de estados ao cadastro interno.
--
-- Esta migration DESFAZ a 20260821090000, que era só o encanamento do
-- formulário público:
--   - os dois gatilhos que copiavam a declaração da ficha para o cliente;
--   - a função de cópia;
--   - as duas colunas de qa_cadastro_publico.
--
-- O QUE NÃO É TOCADO, e continua valendo:
--   - qa_cliente_enderecos_anteriores (a tabela dos estados anteriores);
--   - qa_clientes.residiu_mesmo_endereco_5_anos (a resposta, agora preenchida
--     pelo checklist e pelo cadastro interno);
--   - qa_seed_certidoes_estados_anteriores e todos os gatilhos de 20260821080000;
--   - a pergunta pergunta_residencia_5_anos no catálogo e nos processos.
--
-- As colunas saem porque estão VAZIAS: ninguém chegou a responder pelo
-- formulário público — ele foi publicado às 19:52 e a decisão veio em seguida.
-- A migration confere isso e ABORTA se encontrar qualquer resposta gravada.
--
-- Reexecutável.
-- =============================================================================

BEGIN;

-- Trava de segurança: se alguém respondeu, não se apaga nada em silêncio.
DO $guarda$
DECLARE v_qtd integer;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'qa_cadastro_publico'
       AND column_name  = 'residiu_mesmo_endereco_5_anos'
  ) THEN
    EXECUTE 'SELECT count(*) FROM public.qa_cadastro_publico
              WHERE residiu_mesmo_endereco_5_anos IS NOT NULL
                 OR enderecos_anteriores_json IS NOT NULL'
      INTO v_qtd;
    IF COALESCE(v_qtd, 0) > 0 THEN
      RAISE EXCEPTION 'ABORTADO: % ficha(s) do formulario publico ja tem resposta de residencia dos 5 anos. Migre o dado para qa_cliente_enderecos_anteriores antes de remover as colunas.', v_qtd;
    END IF;
  END IF;
END
$guarda$;

DROP TRIGGER IF EXISTS qa_trg_cadastro_publico_empurra_residencia_5_anos
  ON public.qa_cadastro_publico;
DROP FUNCTION IF EXISTS public.qa_trg_cadastro_publico_empurra_residencia_5_anos();

DROP TRIGGER IF EXISTS qa_trg_cliente_puxa_residencia_5_anos ON public.qa_clientes;
DROP FUNCTION IF EXISTS public.qa_trg_cliente_puxa_residencia_5_anos();

DROP FUNCTION IF EXISTS public.qa_copia_residencia_5_anos_do_cadastro(integer, uuid);

ALTER TABLE public.qa_cadastro_publico
  DROP COLUMN IF EXISTS residiu_mesmo_endereco_5_anos,
  DROP COLUMN IF EXISTS enderecos_anteriores_json;

COMMIT;

-- =============================================================================
-- CONFERÊNCIA (rodar depois, UMA DE CADA VEZ)
--
-- A) As colunas saíram do formulário público. Esperado: 0 linhas.
--
-- SELECT column_name
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name   = 'qa_cadastro_publico'
--    AND column_name IN ('residiu_mesmo_endereco_5_anos','enderecos_anteriores_json');
--
-- B) Os gatilhos do formulário público saíram. Esperado: 0 linhas.
--
-- SELECT tgname FROM pg_trigger
--  WHERE tgname IN ('qa_trg_cliente_puxa_residencia_5_anos',
--                   'qa_trg_cadastro_publico_empurra_residencia_5_anos');
--
-- C) O que fica de pé: a tabela, a resposta no cadastro e os 5 gatilhos da
--    regra dos 5 anos. Esperado: 5 linhas.
--
-- SELECT tgname FROM pg_trigger
--  WHERE tgname IN ('qa_trg_espelha_certidao_no_cofre',
--                   'qa_trg_carimba_uf_da_certidao',
--                   'qa_trg_endereco_anterior_resseia',
--                   'qa_trg_resposta_residencia_5_anos',
--                   'qa_trg_mudanca_de_estado_vira_residencia_anterior')
--  ORDER BY tgname;
-- =============================================================================
