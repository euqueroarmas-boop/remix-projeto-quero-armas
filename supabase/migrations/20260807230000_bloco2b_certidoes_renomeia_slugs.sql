-- =============================================================================
-- BLOCO 2B de 7 — CERTIDÕES: o slug do processo passa a SER o tipo do Hub
--
-- Caminho escolhido pelo usuário (07/08/2026): renomear os slugs, para tratar
-- o problema de vez, em vez de manter duas grafias ligadas por apelido.
--
-- A partir daqui, para as certidões, exigência e documento têm O MESMO NOME.
-- O casamento passa a ser por identidade (`pd.tipo_documento = dc.tipo_documento`)
-- e não depende mais de ponte nenhuma.
--
-- ─── O que NÃO entra, e por quê ──────────────────────────────────────────
--   certidao_estadual_segundo_grau_acoes_criminais
--   certidao_estadual_segundo_grau_execucoes_criminais
--
-- O projeto se contradiz sobre eles:
--   20260730010000 (banco):    "TJSP é o segundo grau, por isso os slots
--                               segundo_grau_* apontam para ele."
--                               → mesmo documento.
--   hubTipoMap.ts (frontend):  "2º grau ainda não tem slot próprio no Hub —
--                               mapeia para o equivalente de 1º grau."
--                               → documentos diferentes dividindo um slot.
--
-- Fundir estando o frontend certo faz o cliente deixar de ser cobrado por uma
-- certidão que a PF confere. Separar estando o banco certo o faz pagar duas
-- vezes pelo mesmo papel. Ficam como estão até a dúvida ser resolvida.
--
-- ─── Apelidos antigos permanecem ─────────────────────────────────────────
-- Só processos EM ANDAMENTO são renomeados. Processo encerrado mantém o slug
-- da época — histórico não se reescreve —, e é por isso que os apelidos
-- antigos NÃO são apagados: sem eles, exigência de processo arquivado ficaria
-- órfã. Eles deixam de ser infraestrutura ativa e passam a ser
-- compatibilidade retroativa.
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── Mapa único: slug antigo → tipo do Hub (que vira o novo slug) ────────
CREATE TEMP TABLE _mapa_certidoes (slug_antigo text PRIMARY KEY, slug_novo text NOT NULL) ON COMMIT DROP;

INSERT INTO _mapa_certidoes (slug_antigo, slug_novo) VALUES
  ('certidao_tjsp_distribuicao_criminal',            'antecedentes_estadual_distribuicao'),
  ('certidao_estadual_distribuicao_acoes_criminais', 'antecedentes_estadual_distribuicao'),
  ('certidao_tjsp_execucoes_criminais',              'antecedentes_estadual_execucoes'),
  ('certidao_estadual_execucoes_criminais',          'antecedentes_estadual_execucoes'),
  ('certidao_estadual_policia_civil',                'antecedentes_criminais'),
  ('certidao_antecedentes_policia_civil_sp',         'antecedentes_criminais'),
  ('certidao_crimes_eleitorais_tse',                 'antecedentes_eleitoral'),
  ('certidao_antecedentes_criminais_eleitoral',      'antecedentes_eleitoral'),
  ('certidao_crimes_militares_stm',                  'antecedentes_militar'),
  ('certidao_criminal_tjmsp',                        'antecedentes_militar_estadual'),
  ('certidao_antecedentes_criminais_militar',        'antecedentes_militar_estadual'),
  ('certidao_estadual_justica_militar',              'antecedentes_militar_estadual'),
  ('certidao_federal_trf3_regional',                 'antecedentes_federal_trf3_regional'),
  ('certidao_federal_trf3_sjsp_jef',                 'antecedentes_federal_sjsp_jef');

-- Guarda: todo destino precisa existir no CHECK do Hub. Se algum não existir,
-- a renomeação criaria exigência que nenhum documento pode satisfazer.
DO $$
DECLARE v_faltando text;
BEGIN
  SELECT string_agg(DISTINCT m.slug_novo, ', ') INTO v_faltando
    FROM _mapa_certidoes m
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_constraint
      WHERE conname = 'qa_doc_cliente_tipo_check'
        AND pg_get_constraintdef(oid) LIKE '%''' || m.slug_novo || '''::text%'
   );
  IF v_faltando IS NOT NULL THEN
    RAISE EXCEPTION 'Abortado: destino(s) ausente(s) do CHECK do Hub: %', v_faltando;
  END IF;
END $$;

-- ─── 1) Exigências dos processos EM ANDAMENTO ────────────────────────────
-- Caso A: o processo ainda não tem o slug novo — renomeia.
UPDATE public.qa_processo_documentos pd
   SET tipo_documento = m.slug_novo,
       observacoes = COALESCE(pd.observacoes, '') ||
         CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Slug normalizado: ' || m.slug_antigo || ' → ' || m.slug_novo || '.',
       updated_at = now()
  FROM _mapa_certidoes m, public.qa_processos p
 WHERE pd.tipo_documento = m.slug_antigo
   AND p.id = pd.processo_id
   AND COALESCE(p.status, '') NOT IN ('finalizado','deferido','indeferido','cancelado')
   AND NOT EXISTS (
     SELECT 1 FROM public.qa_processo_documentos x
      WHERE x.processo_id = pd.processo_id
        AND x.tipo_documento = m.slug_novo
   );

-- Caso B: o processo já tem o slug novo — a linha antiga é duplicata.
-- Marcada, não apagada: pode ter arquivo anexado e é histórico do processo.
UPDATE public.qa_processo_documentos pd
   SET status = 'nao_aplicavel',
       observacoes = COALESCE(pd.observacoes, '') ||
         CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Duplicata: ' || m.slug_novo || ' já existe neste processo.',
       updated_at = now()
  FROM _mapa_certidoes m, public.qa_processos p
 WHERE pd.tipo_documento = m.slug_antigo
   AND p.id = pd.processo_id
   AND COALESCE(p.status, '') NOT IN ('finalizado','deferido','indeferido','cancelado')
   AND pd.status NOT IN ('aprovado','nao_aplicavel');

-- ─── 2) Catálogo — senão o próximo processo nasce com o slug velho ───────
-- Caso A: ainda não existe linha com o slug novo para aquele serviço/condição.
UPDATE public.qa_servicos_documentos sd
   SET tipo_documento = m.slug_novo, updated_at = now()
  FROM _mapa_certidoes m
 WHERE sd.tipo_documento = m.slug_antigo
   AND NOT EXISTS (
     SELECT 1 FROM public.qa_servicos_documentos x
      WHERE x.servico_id = sd.servico_id
        AND x.tipo_documento = m.slug_novo
        AND COALESCE(x.condicao_profissional,'') = COALESCE(sd.condicao_profissional,'')
   );

-- Caso B: já existe — a linha antiga é redundante e sai do catálogo.
UPDATE public.qa_servicos_documentos sd
   SET ativo = false, updated_at = now()
  FROM _mapa_certidoes m
 WHERE sd.tipo_documento = m.slug_antigo;

-- ─── 3) Biblioteca — o código precisa bater com o que o cliente vê ───────
-- Caso A: não há item com o código novo — renomeia, preservando o id (e com
-- ele todos os biblioteca_id que apontam para cá).
UPDATE public.qa_documentos_biblioteca b
   SET codigo = m.slug_novo, updated_at = now()
  FROM _mapa_certidoes m
 WHERE b.codigo = m.slug_antigo
   AND NOT EXISTS (SELECT 1 FROM public.qa_documentos_biblioteca y WHERE y.codigo = m.slug_novo);

-- Caso B: já existe item com o código novo — o catálogo é repontado para ele
-- e o item antigo é desativado.
UPDATE public.qa_servicos_documentos sd
   SET biblioteca_id = novo.id, updated_at = now()
  FROM _mapa_certidoes m
  JOIN public.qa_documentos_biblioteca antigo ON antigo.codigo = m.slug_antigo
  JOIN public.qa_documentos_biblioteca novo   ON novo.codigo   = m.slug_novo
 WHERE sd.biblioteca_id = antigo.id;

UPDATE public.qa_documentos_biblioteca b
   SET ativo = false, updated_at = now()
  FROM _mapa_certidoes m
 WHERE b.codigo = m.slug_antigo;

-- ─── 4) Casamento por identidade ─────────────────────────────────────────
-- Os apelidos antigos continuam onde estão, de propósito: processo encerrado
-- ainda carrega o slug da época e sem eles ficaria órfão. Deixam de ser
-- infraestrutura ativa — o casamento agora é por identidade de nome.
SELECT public.qa_reaproveitar_documentos_hub_processo(p.id, 'bloco2b_certidoes_slugs')
  FROM public.qa_processos p
 WHERE COALESCE(p.status, 'ativo') NOT IN ('finalizado','deferido','indeferido','cancelado','arquivado')
   AND EXISTS (
     SELECT 1 FROM public.qa_processo_documentos pd
      WHERE pd.processo_id = p.id
        AND pd.status IN ('pendente','rejeitado','enviado','em_analise','revisao_humana')
        AND (pd.tipo_documento LIKE 'certidao_%' OR pd.tipo_documento LIKE 'antecedentes_%')
   );

COMMIT;
