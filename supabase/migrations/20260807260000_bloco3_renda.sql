-- =============================================================================
-- BLOCO 3 de 7 — RENDA E OCUPAÇÃO LÍCITA
--
-- Levantado a partir do CHECK REAL do banco e do uso real das três tabelas,
-- não dos arquivos de migration. A lição do Bloco 2D: o repositório e o banco
-- divergem nos dois sentidos, e auditar por arquivo produz bloco que não roda.
--
-- O levantamento derrubou metade do escopo que eu tinha previsto: `ccmei`,
-- `certificado_mei`, `contrato_social`, `cartao_cnpj` e `requerimento_empresario`
-- NÃO EXISTEM no banco — nem no catálogo, nem em processo, nem no Hub. Eram
-- fantasmas do repositório. Sobraram três slugs de verdade.
--
-- ─── 1) contra_cheque_digital → renda_contra_cheque_mes_atual ────────────
-- Decisão do usuário: contra-cheque é do SERVIDOR PÚBLICO e holerite é do
-- CLT — documentos distintos, e o contra-cheque ganha tipo próprio.
-- 15 linhas de catálogo e 1 exigência em processo ativo dependem disso.
--
-- OBSERVAÇÃO PARA O USUÁRIO: `renda_holerite_funcionario_publico` já existe
-- no CHECK, com o nome "Holerite recente (servidor público)" — que pela regra
-- acima é uma contradição, porque servidor não recebe holerite. Ele tem ZERO
-- uso (não aparece em nenhuma linha de catálogo). Fica marcado como obsoleto
-- na biblioteca, mas NÃO sai do CHECK: enquanto estiver lá, um documento
-- eventualmente gravado com esse tipo continua válido, e a remoção pode ser
-- feita depois com segurança.
--
-- ─── 2) identidade_funcional_digital → renda_carteira_funcional ──────────
-- Mesmo documento: a credencial que prova vínculo de servidor dentro da
-- ocupação lícita. O tipo de destino já existe e já tem documento gravado.
-- Não é identidade civil — `identidadeUnica.ts` exclui a funcional
-- explicitamente, e isso continua valendo.
--
-- ─── 3) renda_nf_empresa → renda_nf_recente ──────────────────────────────
-- Apelido que já existia desde 18/06; o rename apenas o torna desnecessário.
--
-- ─── O que NÃO entra ─────────────────────────────────────────────────────
-- `renda_definir_condicao` (8 no catálogo, 7 em processos ativos) não é
-- documento: é a escolha de qual comprovante de renda o cliente vai usar.
-- Mesma natureza do `exames_instituicao_definir`. Precisa da decisão sobre
-- onde vivem os itens de fluxo antes de ser tocado — mexer nele agora
-- quebraria a escolha de condição de sete processos.
--
-- Apelidos antigos permanecem: processo encerrado mantém o slug da época.
--
-- Idempotente.
-- =============================================================================

BEGIN;

-- ─── Tipo novo no CHECK ──────────────────────────────────────────────────
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint WHERE conname = 'qa_doc_cliente_tipo_check';

  IF v_def IS NULL THEN
    RAISE EXCEPTION 'Constraint qa_doc_cliente_tipo_check não encontrada.';
  ELSIF v_def LIKE '%renda_contra_cheque_mes_atual%' THEN
    RAISE NOTICE 'renda_contra_cheque_mes_atual já consta do CHECK.';
  ELSE
    EXECUTE 'ALTER TABLE public.qa_documentos_cliente DROP CONSTRAINT qa_doc_cliente_tipo_check';
    EXECUTE replace(
      'ALTER TABLE public.qa_documentos_cliente ADD CONSTRAINT qa_doc_cliente_tipo_check ' || v_def,
      '''outro''::text',
      '''outro''::text, ''renda_contra_cheque_mes_atual''::text'
    );
  END IF;
END $$;

INSERT INTO public.qa_documentos_biblioteca
  (codigo, nome, categoria, descricao_o_que_e, descricao_como_enviar,
   observacao_cliente, validade_dias, formato_aceito, base_legal, emissor_padrao, ativo)
VALUES (
  'renda_contra_cheque_mes_atual',
  'Contra-cheque do mês atual (servidor público)',
  'ocupacao_licita',
  'Demonstrativo de pagamento do servidor público, referente ao mês mais recente.',
  'Baixe o contra-cheque no portal do seu órgão e envie o PDF original.',
  'É o documento do servidor público. Quem trabalha em regime CLT envia holerite, que é outro documento.',
  NULL, ARRAY['pdf','jpg','jpeg','png'],
  'Lei 10.826/2003; Decreto 11.615/2023; IN DG/PF 201',
  'cliente', true
)
ON CONFLICT (codigo) DO UPDATE
  SET nome = EXCLUDED.nome, categoria = EXCLUDED.categoria,
      descricao_o_que_e = EXCLUDED.descricao_o_que_e,
      descricao_como_enviar = EXCLUDED.descricao_como_enviar,
      observacao_cliente = EXCLUDED.observacao_cliente,
      ativo = true, updated_at = now();

-- Tipo mal nomeado e sem uso: sinalizado, não removido.
UPDATE public.qa_documentos_biblioteca
   SET ativo = false,
       observacao_cliente = 'Obsoleto desde 07/08/2026: servidor público recebe contra-cheque, '
                         || 'não holerite. Use renda_contra_cheque_mes_atual.',
       updated_at = now()
 WHERE codigo = 'renda_holerite_funcionario_publico';

-- ─── Mapa dos renames ────────────────────────────────────────────────────
CREATE TEMP TABLE _mapa_renda (slug_antigo text PRIMARY KEY, slug_novo text NOT NULL, nome_novo text) ON COMMIT DROP;

INSERT INTO _mapa_renda (slug_antigo, slug_novo, nome_novo) VALUES
  ('contra_cheque_digital',        'renda_contra_cheque_mes_atual', 'Contra-cheque do mês atual (servidor público)'),
  ('identidade_funcional_digital', 'renda_carteira_funcional',      NULL),
  ('renda_nf_empresa',             'renda_nf_recente',              NULL);

DO $$
DECLARE v_faltando text;
BEGIN
  SELECT string_agg(DISTINCT m.slug_novo, ', ') INTO v_faltando
    FROM _mapa_renda m
   WHERE NOT EXISTS (
     SELECT 1 FROM pg_constraint
      WHERE conname = 'qa_doc_cliente_tipo_check'
        AND pg_get_constraintdef(oid) LIKE '%''' || m.slug_novo || '''::text%'
   );
  IF v_faltando IS NOT NULL THEN
    RAISE EXCEPTION 'Abortado: destino(s) ausente(s) do CHECK do Hub: %', v_faltando;
  END IF;
END $$;

-- ─── Exigências dos processos em andamento ───────────────────────────────
UPDATE public.qa_processo_documentos pd
   SET tipo_documento = m.slug_novo,
       nome_documento = COALESCE(m.nome_novo, pd.nome_documento),
       observacoes = COALESCE(pd.observacoes, '') ||
         CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Slug normalizado: ' || m.slug_antigo || ' → ' || m.slug_novo || '.',
       updated_at = now()
  FROM _mapa_renda m, public.qa_processos p
 WHERE pd.tipo_documento = m.slug_antigo
   AND p.id = pd.processo_id
   AND COALESCE(p.status, '') NOT IN ('finalizado','deferido','indeferido','cancelado')
   AND NOT EXISTS (
     SELECT 1 FROM public.qa_processo_documentos x
      WHERE x.processo_id = pd.processo_id AND x.tipo_documento = m.slug_novo
   );

UPDATE public.qa_processo_documentos pd
   SET status = 'nao_aplicavel',
       observacoes = COALESCE(pd.observacoes, '') ||
         CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
         '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
         '] Duplicata: ' || m.slug_novo || ' já existe neste processo.',
       updated_at = now()
  FROM _mapa_renda m, public.qa_processos p
 WHERE pd.tipo_documento = m.slug_antigo
   AND p.id = pd.processo_id
   AND COALESCE(p.status, '') NOT IN ('finalizado','deferido','indeferido','cancelado')
   AND pd.status NOT IN ('aprovado','nao_aplicavel');

-- ─── Catálogo ────────────────────────────────────────────────────────────
UPDATE public.qa_servicos_documentos sd
   SET tipo_documento = m.slug_novo,
       nome_documento = COALESCE(m.nome_novo, sd.nome_documento),
       biblioteca_id  = COALESCE(
         (SELECT b.id FROM public.qa_documentos_biblioteca b WHERE b.codigo = m.slug_novo),
         sd.biblioteca_id),
       updated_at = now()
  FROM _mapa_renda m
 WHERE sd.tipo_documento = m.slug_antigo
   AND NOT EXISTS (
     SELECT 1 FROM public.qa_servicos_documentos x
      WHERE x.servico_id = sd.servico_id
        AND x.tipo_documento = m.slug_novo
        AND COALESCE(x.condicao_profissional,'') = COALESCE(sd.condicao_profissional,'')
   );

UPDATE public.qa_servicos_documentos sd
   SET ativo = false, updated_at = now()
  FROM _mapa_renda m
 WHERE sd.tipo_documento = m.slug_antigo;

-- ─── Biblioteca ──────────────────────────────────────────────────────────
UPDATE public.qa_documentos_biblioteca b
   SET codigo = m.slug_novo, updated_at = now()
  FROM _mapa_renda m
 WHERE b.codigo = m.slug_antigo
   AND NOT EXISTS (SELECT 1 FROM public.qa_documentos_biblioteca y WHERE y.codigo = m.slug_novo);

UPDATE public.qa_documentos_biblioteca b
   SET ativo = false, updated_at = now()
  FROM _mapa_renda m
 WHERE b.codigo = m.slug_antigo;

-- ─── Reavalia ────────────────────────────────────────────────────────────
SELECT public.qa_reaproveitar_documentos_hub_processo(p.id, 'bloco3_renda')
  FROM public.qa_processos p
 WHERE COALESCE(p.status, 'ativo') NOT IN ('finalizado','deferido','indeferido','cancelado','arquivado')
   AND EXISTS (
     SELECT 1 FROM public.qa_processo_documentos pd
      WHERE pd.processo_id = p.id
        AND pd.status IN ('pendente','rejeitado','enviado','em_analise','revisao_humana')
        AND (pd.tipo_documento LIKE 'renda_%' OR pd.tipo_documento = 'ctps')
   );

COMMIT;
