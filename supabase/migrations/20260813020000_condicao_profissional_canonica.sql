-- =============================================================================
-- CAUSA RAIZ da duplicacao no catalogo: `condicao_profissional` como parte da
-- chave, sem forma canonica e sem exclusividade entre linhas ativas.
--
-- O indice unico ja existia e ja tratava NULL:
--   UNIQUE (servico_id, tipo_documento, COALESCE(condicao_profissional,''))
-- mas era sobre a STRING CRUA. Entao 'empresario' e 'autonomo,empresario' sao
-- chaves diferentes e as duas linhas coexistem — foi assim que nasceram as 22
-- duplicatas removidas na migration anterior. E 'autonomo,empresario' x
-- 'empresario,autonomo' tambem passariam, por diferenca de ordem.
--
-- Efeito colateral do indice ser sobre EXPRESSAO: o upsert de "aplicar modelo"
-- no admin usa onConflict por NOMES DE COLUNA
-- (servico_id,tipo_documento,condicao_profissional), que o Postgres nao casa
-- com indice de expressao — devia estar falhando com 42P10.
--
-- Estado verificado antes de aplicar (PG 17.6):
--   - nenhuma duplicata pela chave canonica;
--   - nenhuma sobreposicao de condicao entre linhas ATIVAS.
-- =============================================================================

BEGIN;

-- ── 1) Forma canonica da condicao ───────────────────────────────────────────
-- minusculas, sem espaco, sem repeticao, em ordem alfabetica. Vazio -> NULL,
-- porque NULL e o valor que as funcoes leem como "vale para toda condicao".
CREATE OR REPLACE FUNCTION public.qa_canonizar_condicao_profissional(v text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(
    (SELECT string_agg(t, ',' ORDER BY t)
       FROM (SELECT DISTINCT btrim(lower(x)) AS t
               FROM unnest(string_to_array(COALESCE(v,''), ',')) AS x
              WHERE btrim(x) <> '') s),
    '');
$$;

CREATE OR REPLACE FUNCTION public.qa_trg_sd_canonizar_condicao()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.condicao_profissional :=
    public.qa_canonizar_condicao_profissional(NEW.condicao_profissional);
  RETURN NEW;
END $$;

-- O nome comeca com `_a_` de proposito: o Postgres dispara triggers BEFORE em
-- ordem alfabetica, e a canonizacao precisa rodar ANTES da checagem de
-- sobreposicao — senao 'Empresario ' escaparia da comparacao.
DROP TRIGGER IF EXISTS trg_qa_sd_a_canonizar_condicao ON public.qa_servicos_documentos;
CREATE TRIGGER trg_qa_sd_a_canonizar_condicao
BEFORE INSERT OR UPDATE ON public.qa_servicos_documentos
FOR EACH ROW EXECUTE FUNCTION public.qa_trg_sd_canonizar_condicao();

UPDATE public.qa_servicos_documentos
   SET condicao_profissional = public.qa_canonizar_condicao_profissional(condicao_profissional)
 WHERE condicao_profissional IS DISTINCT FROM
       public.qa_canonizar_condicao_profissional(condicao_profissional);

-- ── 2) Indice unico em COLUNAS, com NULLS NOT DISTINCT ──────────────────────
-- Mesma semantica do indice de expressao que substitui (nulos colidem), mas em
-- colunas simples — o que faz o onConflict do admin voltar a casar. So possivel
-- em PG 15+.
DROP INDEX IF EXISTS public.qa_servicos_documentos_unq;

CREATE UNIQUE INDEX qa_servicos_documentos_unq
  ON public.qa_servicos_documentos (servico_id, tipo_documento, condicao_profissional)
  NULLS NOT DISTINCT;

-- ── 3) Invariante que nenhum indice expressa: sem SOBREPOSICAO ──────────────
-- Para o mesmo servico e tipo, duas linhas ATIVAS nao podem reivindicar a mesma
-- condicao. Permite o caso legitimo (extrato INSS 'aposentado' x 'clt', que sao
-- documentos diferentes para publicos disjuntos) e proibe o que gerou o lixo
-- ('empresario' convivendo com 'autonomo,empresario').
--
-- Linha sem condicao significa "todas", entao sobrepoe qualquer outra.
CREATE OR REPLACE FUNCTION public.qa_trg_sd_sem_sobreposicao()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_novo     text[];
  v_conflito record;
BEGIN
  IF NOT COALESCE(NEW.ativo, false) THEN RETURN NEW; END IF;

  v_novo := CASE WHEN NEW.condicao_profissional IS NULL THEN NULL
                 ELSE string_to_array(NEW.condicao_profissional, ',') END;

  SELECT o.id, o.condicao_profissional INTO v_conflito
    FROM public.qa_servicos_documentos o
   WHERE o.servico_id     = NEW.servico_id
     AND o.tipo_documento = NEW.tipo_documento
     AND o.id <> NEW.id
     AND o.ativo = true
     AND (o.condicao_profissional IS NULL
          OR v_novo IS NULL
          OR string_to_array(o.condicao_profissional, ',') && v_novo)
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'CONDICAO_SOBREPOSTA: ja existe exigencia ATIVA de % no servico % cobrindo condicao em comum (linha %, condicao %). Ajuste ou desative a outra antes.',
      NEW.tipo_documento, NEW.servico_id, v_conflito.id,
      COALESCE(v_conflito.condicao_profissional, '(todas)')
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_qa_sd_b_sem_sobreposicao ON public.qa_servicos_documentos;
CREATE TRIGGER trg_qa_sd_b_sem_sobreposicao
BEFORE INSERT OR UPDATE OF condicao_profissional, ativo, tipo_documento, servico_id
ON public.qa_servicos_documentos
FOR EACH ROW EXECUTE FUNCTION public.qa_trg_sd_sem_sobreposicao();

COMMIT;

-- =============================================================================
-- ATENCAO — efeito conhecido da camada 3:
-- a trava vale tambem para linha SEM condicao, que significa "todas". Se um
-- servico ja tem exigencia ativa condicional de um tipo, inserir a mesma sem
-- condicao passa a ser recusado — inclusive pelo "aplicar modelo" do admin,
-- que insere sempre sem condicao. Isso e correto em principio (uma linha "para
-- todos" convivendo com uma "so para autonomo" e ambigua, e hoje o sistema
-- resolve essa ambiguidade em silencio), mas pode fazer o modelo recusar
-- servicos que ja tenham exigencias condicionais. Testar no admin.
-- =============================================================================
