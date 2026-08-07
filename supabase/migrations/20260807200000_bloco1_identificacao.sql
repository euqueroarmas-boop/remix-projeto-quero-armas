-- =============================================================================
-- BLOCO 1 de 7 — IDENTIFICAÇÃO
--
-- Decisões do usuário (07/08/2026):
--   • O vocabulário de identificação passa a ter TRÊS nomes, e só três:
--         cin          CIN — Carteira de Identidade Nacional
--         rg_com_cpf   RG (com CPF)
--         cnh          CNH — Carteira Nacional de Habilitação
--     Grafia mantida como está hoje — `rg_com_cpf`, não `rg` — porque é o nome
--     com 39 migrations atrás dele e carrega a exigência da PF (o RG precisa
--     mostrar o CPF). Renomear daria mais chance de errar do que de acertar.
--   • Um dispensa o outro: qualquer um dos três satisfaz a exigência de
--     identificação.
--   • `cpf` deixa de ser tipo de documento. O número do CPF consta do próprio
--     RG/CIN/CNH; não existe exigência de "documento CPF" avulso. O usuário
--     confirmou que não há nenhum documento desse tipo gravado no banco — e o
--     bloco abaixo confere isso antes de mexer na constraint, em vez de
--     confiar na confirmação.
--
-- O que este bloco NÃO faz, de propósito:
--   Não enxuga `identidadeUnica.ts` nem `checklistVisibility.ts`. Os dois são
--   RECONHECEDORES, não vocabulário: classificam por heurística tolerante
--   (`includes("identidade")`, regex `\b(cnh|rg|cin)\b`) justamente para
--   capturar variantes e dados legados. Estreitá-los não normaliza nada e
--   arrisca deixar documento antigo sem classificação.
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── 1) Triângulo de dispensa: CIN ↔ RG ↔ CNH ────────────────────────────
-- Semântica da tabela: (processo_tipo, hub_tipo) = "documento do Hub com tipo
-- `hub_tipo` satisfaz a exigência de tipo `processo_tipo`".
--
-- `cin` e `rg_com_cpf` já eram satisfeitos pelos três. O slot `cnh` não era
-- satisfeito por nenhum — quem entregasse CIN ou RG continuava vendo a CNH
-- pendente. Fecha o triângulo.
INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo) VALUES
  ('cnh', 'cin'),
  ('cnh', 'rg_com_cpf')
ON CONFLICT DO NOTHING;

-- ─── 2) Grafias legadas continuam fechando ───────────────────────────────
-- Estas variantes não são produzidas por catálogo nenhum (zero migrations) —
-- vivem só no frontend. Mas exigência antiga já gravada pode carregar o nome,
-- e sem apelido ela nunca fecharia. Como os três canônicos se dispensam entre
-- si, cada variante aceita qualquer um dos três.
INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo)
SELECT v.processo_tipo, c.hub_tipo
  FROM (VALUES
    ('documento_identidade_nacional'),
    ('carteira_identidade_nacional'),
    ('cedula_identidade_rg_com_cpf'),
    ('documento_identidade'),
    ('identidade'),
    ('rg')
  ) AS v(processo_tipo)
 CROSS JOIN (VALUES ('cin'), ('rg_com_cpf'), ('cnh')) AS c(hub_tipo)
ON CONFLICT DO NOTHING;

-- ─── 3) `cpf` sai do vocabulário ─────────────────────────────────────────
UPDATE public.qa_documentos_biblioteca
   SET ativo = false, updated_at = now()
 WHERE codigo = 'cpf';

UPDATE public.qa_servicos_documentos
   SET ativo = false, updated_at = now()
 WHERE tipo_documento = 'cpf';

-- Encerra as exigências de CPF ainda em aberto nos processos em andamento.
-- MARCA como nao_aplicavel em vez de apagar: a linha é histórico de um
-- processo real e `nao_aplicavel` já conta como cumprida em checklistMetrics,
-- então some da contagem de pendências sem destruir o registro.
-- Processo já encerrado fica como está — histórico não se reescreve.
UPDATE public.qa_processo_documentos pd
   SET status = 'nao_aplicavel',
       observacoes = COALESCE(pd.observacoes, '') ||
         CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] CPF deixou de ser documento exigido: o número consta do próprio RG/CIN/CNH.',
       updated_at = now()
  FROM public.qa_processos p
 WHERE p.id = pd.processo_id
   AND pd.tipo_documento = 'cpf'
   AND pd.status NOT IN ('aprovado','nao_aplicavel')
   AND COALESCE(p.status, '') NOT IN ('finalizado','deferido','indeferido','cancelado');

-- Só então tira do CHECK, e apenas se de fato não houver documento gravado.
DO $$
DECLARE
  v_def text;
  v_qtd bigint;
BEGIN
  SELECT count(*) INTO v_qtd
    FROM public.qa_documentos_cliente WHERE tipo_documento = 'cpf';

  IF v_qtd > 0 THEN
    RAISE EXCEPTION
      'Abortado: % documento(s) com tipo_documento = ''cpf'' no Hub. '
      'Reclassifique antes de remover o tipo da constraint.', v_qtd;
  END IF;

  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint WHERE conname = 'qa_doc_cliente_tipo_check';

  IF v_def IS NULL THEN
    RAISE NOTICE 'Constraint não encontrada — nada a alterar.';
  ELSIF v_def NOT LIKE '%''cpf''::text%' THEN
    RAISE NOTICE '`cpf` já não consta do CHECK.';
  ELSE
    -- Duas formas possíveis conforme a posição na lista: com vírgula à direita
    -- (caso comum) ou à esquerda (quando é o último elemento). Tratar só a
    -- primeira deixaria a constraint intacta sem avisar.
    v_def := replace(v_def, '''cpf''::text, ', '');
    v_def := replace(v_def, ', ''cpf''::text', '');

    IF v_def LIKE '%''cpf''::text%' THEN
      RAISE EXCEPTION 'Não consegui remover ''cpf'' do CHECK — formato inesperado: %', v_def;
    END IF;

    EXECUTE 'ALTER TABLE public.qa_documentos_cliente DROP CONSTRAINT qa_doc_cliente_tipo_check';
    EXECUTE 'ALTER TABLE public.qa_documentos_cliente ADD CONSTRAINT qa_doc_cliente_tipo_check ' || v_def;
  END IF;
END $$;

-- Apelidos que apontavam para o tipo extinto deixam de fazer sentido.
DELETE FROM public.qa_tipo_documento_aliases
 WHERE hub_tipo = 'cpf' OR processo_tipo = 'cpf';

-- ─── 4) Reavalia as exigências de identificação em aberto ────────────────
SELECT public.qa_reaproveitar_documentos_hub_processo(p.id, 'bloco1_identificacao')
  FROM public.qa_processos p
 WHERE COALESCE(p.status, 'ativo') NOT IN ('finalizado','deferido','indeferido','cancelado','arquivado')
   AND EXISTS (
     SELECT 1 FROM public.qa_processo_documentos pd
      WHERE pd.processo_id = p.id
        AND pd.status IN ('pendente','rejeitado','enviado','em_analise','revisao_humana')
        AND pd.tipo_documento IN ('cin','rg_com_cpf','cnh',
              'documento_identidade_nacional','carteira_identidade_nacional',
              'cedula_identidade_rg_com_cpf','documento_identidade','identidade','rg')
   );

COMMIT;
