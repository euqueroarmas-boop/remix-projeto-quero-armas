-- ############################################################################
-- BLOCO 3 de 7 — RENDA E OCUPAÇÃO LÍCITA
-- Colar inteiro no SQL Editor do Supabase e rodar de uma vez.
-- Seguro para rodar mais de uma vez. Tudo em UMA transação.
-- Rodar depois do Bloco 1 e de todo o Bloco 2.
-- ############################################################################

BEGIN;

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
-- `renda_holerite_funcionario_publico` SAI DO BANCO. O nome era uma
-- contradição — "holerite do servidor público", quando servidor recebe
-- contra-cheque — e tinha zero uso em catálogo, processo e Hub. Decisão do
-- usuário: "Não vamos contaminar o banco." Sai do CHECK e da biblioteca, não
-- apenas desativado. O bloco confere que não há documento gravado antes de
-- mexer na constraint e aborta se houver.
--
-- ─── 2) identidade_funcional_digital → renda_carteira_funcional ──────────
-- Mesmo documento: a credencial que prova vínculo de servidor dentro da
-- ocupação lícita. O tipo de destino já existe e já tem documento gravado.
-- Não é identidade civil — `identidadeUnica.ts` exclui a funcional
-- explicitamente, e isso continua valendo.
--
-- ─── FORA DO BLOCO: o par renda_nf_* ─────────────────────────────────────
-- O rename `renda_nf_empresa → renda_nf_recente` foi retirado. O usuário
-- informou que `renda_nf_recente` também não existe como documento real, e
-- renomear para um destino inválido é pior do que não renomear. Os dois têm
-- uso (8 e 7 linhas de catálogo, 1 exigência ativa cada) e a decisão sobre
-- qual nome fica — ou se os dois saem — precisa vir antes.
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

-- ─── renda_holerite_funcionario_publico sai do banco ─────────────────────
DELETE FROM public.qa_documentos_biblioteca
 WHERE codigo = 'renda_holerite_funcionario_publico';

DO $$
DECLARE
  v_def text;
  v_qtd bigint;
BEGIN
  SELECT count(*) INTO v_qtd
    FROM public.qa_documentos_cliente
   WHERE tipo_documento = 'renda_holerite_funcionario_publico';

  IF v_qtd > 0 THEN
    RAISE EXCEPTION
      'Abortado: % documento(s) com tipo renda_holerite_funcionario_publico no Hub. '
      'Reclassifique para renda_contra_cheque_mes_atual antes de remover o tipo.', v_qtd;
  END IF;

  SELECT pg_get_constraintdef(oid) INTO v_def
    FROM pg_constraint WHERE conname = 'qa_doc_cliente_tipo_check';

  IF v_def NOT LIKE '%renda_holerite_funcionario_publico%' THEN
    RAISE NOTICE 'renda_holerite_funcionario_publico já não consta do CHECK.';
  ELSE
    v_def := replace(v_def, '''renda_holerite_funcionario_publico''::text, ', '');
    v_def := replace(v_def, ', ''renda_holerite_funcionario_publico''::text', '');
    IF v_def LIKE '%renda_holerite_funcionario_publico%' THEN
      RAISE EXCEPTION 'Não consegui remover o tipo do CHECK — formato inesperado.';
    END IF;
    EXECUTE 'ALTER TABLE public.qa_documentos_cliente DROP CONSTRAINT qa_doc_cliente_tipo_check';
    EXECUTE 'ALTER TABLE public.qa_documentos_cliente ADD CONSTRAINT qa_doc_cliente_tipo_check ' || v_def;
  END IF;
END $$;

-- ─── Mapa dos renames ────────────────────────────────────────────────────
CREATE TEMP TABLE _mapa_renda (slug_antigo text PRIMARY KEY, slug_novo text NOT NULL, nome_novo text) ON COMMIT DROP;

INSERT INTO _mapa_renda (slug_antigo, slug_novo, nome_novo) VALUES
  ('contra_cheque_digital',        'renda_contra_cheque_mes_atual', 'Contra-cheque do mês atual (servidor público)'),
  ('identidade_funcional_digital', 'renda_carteira_funcional',      NULL);

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
