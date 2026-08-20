-- ============================================================================
-- A resposta do 2º endereço volta do PROCESSO para o CADASTRO
-- ----------------------------------------------------------------------------
-- O checklist da Concessão de CR pergunta "você vai guardar parte do acervo em
-- um segundo endereço?" (`pergunta_segundo_endereco_acervo`, chave
-- `segundo_endereco_acervo`) e, conforme a resposta, cobra a declaração do 2º
-- endereço ou a declaração de NÃO possuir (migration 20260819080000).
--
-- Essa resposta morria dentro de qa_processos.respostas_questionario_json. O
-- cadastro do cliente continuava sem saber — e era assim que dava para o
-- titular responder "sim" no processo e o dossiê sair com uma declaração de 2º
-- endereço em branco, porque no cadastro não havia endereço nenhum.
--
-- Este gatilho copia a resposta para qa_clientes.tem_segundo_endereco assim que
-- ela é registrada, seja pela equipe, seja pelo cliente, seja por qualquer edge
-- function — nenhum caminho precisa lembrar de fazer isso.
--
-- ONDE ELE NÃO ENCOSTA (a trava):
--   só age quando o processo é de serviço com
--   `qa_servicos_catalogo.admite_segundo_endereco = true` — Concessão de CR e
--   Autorização de Compra CAC. Processo de defesa pessoal que por qualquer
--   motivo tenha essa chave no questionário é IGNORADO: nada é gravado no
--   cadastro dele.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.qa_trg_resposta_segundo_endereco_no_cadastro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_resposta_nova text;
  v_resposta_velha text;
  v_admite boolean;
BEGIN
  v_resposta_nova := lower(btrim(COALESCE(
    NEW.respostas_questionario_json ->> 'segundo_endereco_acervo', '')));
  v_resposta_velha := lower(btrim(COALESCE(
    OLD.respostas_questionario_json ->> 'segundo_endereco_acervo', '')));

  -- Nada mudou nesta chave: o gatilho não tem o que fazer.
  IF v_resposta_nova = v_resposta_velha THEN
    RETURN NEW;
  END IF;

  -- Resposta apagada ou fora do vocabulário: não se inventa nada no cadastro.
  IF v_resposta_nova NOT IN ('sim', 'nao') THEN
    RETURN NEW;
  END IF;

  -- ── A TRAVA ───────────────────────────────────────────────────────────────
  -- Só serviço que admite 2º endereço escreve no cadastro. Defesa pessoal sai
  -- por aqui sem tocar em nada.
  SELECT EXISTS (
    SELECT 1 FROM public.qa_servicos_catalogo c
     WHERE c.servico_id = NEW.servico_id
       AND c.admite_segundo_endereco
  ) INTO v_admite;

  IF NOT COALESCE(v_admite, false) THEN
    RETURN NEW;
  END IF;

  IF v_resposta_nova = 'sim' THEN
    UPDATE public.qa_clientes
       SET tem_segundo_endereco = true,
           updated_at           = now()
     WHERE id = NEW.cliente_id
       AND tem_segundo_endereco IS DISTINCT FROM true;
  ELSE
    -- "Não possuo 2º endereço" é declaração assinada: o cadastro não pode
    -- continuar guardando um endereço que o titular acabou de negar, senão a
    -- declaração do dossiê sai contradizendo o cadastro.
    UPDATE public.qa_clientes
       SET tem_segundo_endereco = false,
           endereco2       = NULL,
           numero2         = NULL,
           complemento2    = NULL,
           bairro2         = NULL,
           cep2            = NULL,
           cidade2         = NULL,
           estado2         = NULL,
           pais2           = NULL,
           geolocalizacao2 = NULL,
           end2_tipo       = NULL,
           end2_observacao = NULL,
           updated_at      = now()
     WHERE id = NEW.cliente_id;
  END IF;

  RETURN NEW;
END $$;

COMMENT ON FUNCTION public.qa_trg_resposta_segundo_endereco_no_cadastro() IS
  'Copia a resposta de segundo_endereco_acervo do processo para '
  'qa_clientes.tem_segundo_endereco. Só age em serviço com '
  'admite_segundo_endereco = true (CR e Autorização de Compra CAC); processo '
  'de defesa pessoal é ignorado sem gravar nada.';

DROP TRIGGER IF EXISTS trg_qa_resposta_segundo_endereco_no_cadastro ON public.qa_processos;
CREATE TRIGGER trg_qa_resposta_segundo_endereco_no_cadastro
AFTER UPDATE OF respostas_questionario_json ON public.qa_processos
FOR EACH ROW EXECUTE FUNCTION public.qa_trg_resposta_segundo_endereco_no_cadastro();

-- ── Backfill: respostas que já estavam registradas ──────────────────────────
-- Quem já respondeu no processo passa a constar no cadastro. Só processos de
-- serviço que admite — os demais nem são lidos.
UPDATE public.qa_clientes cl
   SET tem_segundo_endereco = (r.resposta = 'sim'),
       updated_at           = now()
  FROM (
    SELECT DISTINCT ON (p.cliente_id)
           p.cliente_id,
           lower(btrim(p.respostas_questionario_json ->> 'segundo_endereco_acervo')) AS resposta
      FROM public.qa_processos p
      JOIN public.qa_servicos_catalogo c ON c.servico_id = p.servico_id
     WHERE c.admite_segundo_endereco
       AND lower(btrim(COALESCE(p.respostas_questionario_json ->> 'segundo_endereco_acervo', '')))
           IN ('sim', 'nao')
     ORDER BY p.cliente_id, p.updated_at DESC
  ) r
 WHERE cl.id = r.cliente_id
   AND cl.tem_segundo_endereco IS DISTINCT FROM (r.resposta = 'sim');

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- 1) Resposta do processo x cadastro — as duas colunas têm de bater:
--
-- SELECT p.id AS processo, p.cliente_id, cl.nome_completo,
--        p.respostas_questionario_json ->> 'segundo_endereco_acervo' AS respondeu,
--        cl.tem_segundo_endereco AS no_cadastro,
--        NULLIF(btrim(COALESCE(cl.endereco2, '')), '') AS endereco2
--   FROM public.qa_processos p
--   JOIN public.qa_clientes cl ON cl.id = p.cliente_id
--   JOIN public.qa_servicos_catalogo c ON c.servico_id = p.servico_id
--  WHERE c.admite_segundo_endereco
--    AND p.respostas_questionario_json ? 'segundo_endereco_acervo'
--  ORDER BY p.cliente_id;
--
-- 2) A trava — nenhum cliente SÓ de defesa pessoal pode ter a resposta
--    gravada no cadastro (esperado: 0 linhas):
--
-- SELECT cl.id, cl.nome_completo, cl.tem_segundo_endereco
--   FROM public.qa_clientes cl
--  WHERE cl.tem_segundo_endereco IS NOT NULL
--    AND NOT public.qa_cliente_admite_segundo_endereco(cl.id);
--
-- 3) O gatilho está instalado:
--
-- SELECT tgname, tgenabled
--   FROM pg_trigger
--  WHERE tgname = 'trg_qa_resposta_segundo_endereco_no_cadastro';
