-- ============================================================================
-- SEGUNDO ENDEREÇO — só para Concessão de CR e Autorização de Compra CAC
-- ----------------------------------------------------------------------------
-- O titular de CR pode declarar DOIS endereços (residência + segundo endereço
-- de guarda do acervo). O banco já guardava o segundo endereço em qa_clientes
-- (endereco2, numero2, complemento2, bairro2, cep2, cidade2, estado2, pais2,
-- geolocalizacao2, end2_tipo, end2_observacao), mas faltavam duas coisas:
--
--   1. uma resposta explícita de "tem ou não tem" segundo endereço. Hoje só
--      existe endereço2 preenchido ou vazio — e vazio tanto significa "não
--      tem" quanto "ninguém perguntou". O checklist do CR (serviço 44) já
--      pergunta isso por processo e cobra a declaração positiva OU a negativa
--      (migration 20260819080000), mas a resposta nunca voltava para o
--      cadastro do cliente;
--
--   2. um PORTÃO dizendo QUEM pode ter dois endereços. Sem ele, liberar o
--      segundo endereço nas telas liberaria para todo mundo — inclusive
--      defesa pessoal (IN DG/PF 201), que não tem essa previsão.
--
-- O QUE ESTE BLOCO FAZ
--   1. cria qa_servicos_catalogo.admite_segundo_endereco — o portão, no mesmo
--      lugar onde já moram exige_cr, exige_acervo e modalidade_cac. Nasce
--      FALSE para todos e é ligado só na Concessão de CR e na Autorização de
--      Compra com fundamento CAC (atirador / caçador / colecionador);
--   2. trava explícita: nenhum item de modalidade `defesa_pessoal` fica com o
--      portão aberto, aconteça o que acontecer nas regras acima;
--   3. cria qa_cliente_admite_segundo_endereco(cliente) — a única fonte da
--      verdade que o servidor consulta antes de aceitar campos do 2º endereço;
--   4. cria qa_clientes.tem_segundo_endereco (a resposta explícita) e faz o
--      backfill de quem JÁ tem o 2º endereço preenchido E passa no portão.
--
-- NADA MUDA para quem não tem processo de CR ou de Autorização de Compra CAC:
-- o portão nasce fechado e a coluna nova nasce NULL.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

-- ── 1) O portão, no catálogo de serviços ────────────────────────────────────
ALTER TABLE public.qa_servicos_catalogo
  ADD COLUMN IF NOT EXISTS admite_segundo_endereco boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.qa_servicos_catalogo.admite_segundo_endereco IS
  'TRUE = processos deste serviço podem declarar 2º endereço (Concessão de CR '
  'e Autorização de Compra com fundamento CAC — IN DG/PF 311). FALSE = o 2º '
  'endereço não é coletado nem aceito (defesa pessoal — IN DG/PF 201, e todo '
  'o resto). Lido por qa_cliente_admite_segundo_endereco.';

-- 1a. Concessão de CR — o CR é, por definição, do acervo CAC.
UPDATE public.qa_servicos_catalogo
   SET admite_segundo_endereco = true,
       updated_at              = now()
 WHERE admite_segundo_endereco IS DISTINCT FROM true
   AND (servico_id = 44 OR slug ILIKE '%concessao%cr%');

-- 1b. Autorização de Compra quando o fundamento é CAC.
--     ATENÇÃO — só existem os serviços de ATIRADOR (50) e CAÇADOR (51). O
--     colecionador não tem serviço de Autorização de Compra no catálogo. Ao
--     criá-lo, é preciso ligar admite_segundo_endereco nele à mão; ver
--     docs/PENDENCIAS-ABERTAS.md, seção "Colecionador não tem Autorização de
--     Compra no catálogo".
UPDATE public.qa_servicos_catalogo
   SET admite_segundo_endereco = true,
       updated_at              = now()
 WHERE admite_segundo_endereco IS DISTINCT FROM true
   AND (
        servico_id IN (50, 51)                       -- Aut. Compra Atirador / Caçador
     OR (modalidade_cac IN ('atirador', 'cacador', 'colecionador')
         AND (slug ILIKE '%autoriza%compra%' OR slug ILIKE '%aquisicao%'))
   );

-- 1c. TRAVA — defesa pessoal nunca abre o portão, aconteça o que acontecer
--     nas regras acima. Este UPDATE roda por último de propósito.
UPDATE public.qa_servicos_catalogo
   SET admite_segundo_endereco = false,
       updated_at              = now()
 WHERE admite_segundo_endereco IS DISTINCT FROM false
   AND modalidade_cac = 'defesa_pessoal';

-- ── 2) A fonte da verdade consultada pelo servidor ──────────────────────────
CREATE OR REPLACE FUNCTION public.qa_cliente_admite_segundo_endereco(p_cliente_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.qa_processos p
      JOIN public.qa_servicos_catalogo c ON c.servico_id = p.servico_id
     WHERE p.cliente_id = p_cliente_id
       AND c.admite_segundo_endereco
  );
$$;

COMMENT ON FUNCTION public.qa_cliente_admite_segundo_endereco(integer) IS
  'TRUE se o cliente tem ao menos um processo de serviço com '
  'admite_segundo_endereco = true (Concessão de CR ou Autorização de Compra '
  'CAC). Chamada pela edge qa-cliente-atualizar-cadastro antes de aceitar '
  'qualquer campo do 2º endereço. Cliente só de defesa pessoal devolve FALSE.';

-- Não é para o cliente logado consultar: só o servidor decide o portão.
REVOKE ALL ON FUNCTION public.qa_cliente_admite_segundo_endereco(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qa_cliente_admite_segundo_endereco(integer) TO service_role;

-- ── 3) A resposta explícita no cadastro do cliente ──────────────────────────
ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS tem_segundo_endereco boolean;

COMMENT ON COLUMN public.qa_clientes.tem_segundo_endereco IS
  'Resposta explícita do titular sobre guardar acervo em 2º endereço. '
  'TRUE = tem (endereco2… preenchidos); FALSE = declarou que NÃO tem '
  '(gera declaracao_nao_possuir_segundo_endereco); NULL = ninguém perguntou. '
  'Só é coletada em processos cujo serviço tem '
  'qa_servicos_catalogo.admite_segundo_endereco = true.';

-- Backfill: quem JÁ tem o segundo endereço preenchido evidentemente tem um —
-- mas só marcamos quem passa no portão. Cliente de defesa pessoal com um
-- endereco2 herdado de cadastro antigo fica com a coluna NULL: a pergunta não
-- se aplica a ele, e responder por ele seria inventar dado.
--
-- Não inferimos FALSE para ninguém: vazio continua significando "não
-- perguntado" até o titular responder.
UPDATE public.qa_clientes cl
   SET tem_segundo_endereco = true,
       updated_at           = now()
 WHERE cl.tem_segundo_endereco IS NULL
   AND (
        NULLIF(btrim(COALESCE(cl.endereco2, '')), '') IS NOT NULL
     OR NULLIF(btrim(COALESCE(cl.cep2,      '')), '') IS NOT NULL
     OR NULLIF(btrim(COALESCE(cl.cidade2,   '')), '') IS NOT NULL
     OR NULLIF(btrim(COALESCE(cl.end2_tipo, '')), '') IS NOT NULL
   )
   AND EXISTS (
     SELECT 1
       FROM public.qa_processos p
       JOIN public.qa_servicos_catalogo c ON c.servico_id = p.servico_id
      WHERE p.cliente_id = cl.id
        AND c.admite_segundo_endereco
   );

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- 1) Quais serviços ficaram com o portão aberto (esperado: só CR e Aut.
--    Compra CAC — nenhuma linha de defesa pessoal):
--
-- SELECT servico_id, slug, nome, modalidade_cac, admite_segundo_endereco
--   FROM public.qa_servicos_catalogo
--  WHERE admite_segundo_endereco
--  ORDER BY servico_id, slug;
--
-- 2) Conferência inversa — nenhum item de defesa pessoal pode aparecer aqui
--    (esperado: 0 linhas):
--
-- SELECT servico_id, slug, nome
--   FROM public.qa_servicos_catalogo
--  WHERE admite_segundo_endereco AND modalidade_cac = 'defesa_pessoal';
--
-- 3) Quantos clientes já tinham 2º endereço e foram marcados no backfill:
--
-- SELECT count(*) FILTER (WHERE tem_segundo_endereco IS TRUE)  AS tem,
--        count(*) FILTER (WHERE tem_segundo_endereco IS FALSE) AS nao_tem,
--        count(*) FILTER (WHERE tem_segundo_endereco IS NULL)  AS nao_perguntado,
--        count(*)                                              AS total
--   FROM public.qa_clientes
--  WHERE COALESCE(excluido, false) = false;
--
-- 4) O portão respondendo por cliente — troque o id:
--
-- SELECT public.qa_cliente_admite_segundo_endereco(123);
