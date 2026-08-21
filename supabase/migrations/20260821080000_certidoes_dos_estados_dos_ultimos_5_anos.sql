-- =============================================================================
-- CERTIDÕES DE TODOS OS ESTADOS ONDE O CLIENTE MOROU NOS ÚLTIMOS 5 ANOS
-- -----------------------------------------------------------------------------
-- Regra do titular (21/08/2026):
--
--   "Se o cliente mudar de estado nos últimos 5 anos, ele deve apresentar do
--    estado novo que ele se mudou e do estado antigo dos últimos 5 anos. Se no
--    primeiro ano morou em São Paulo, no segundo em Minas, no terceiro no
--    Paraná, no quarto em Rondônia, no quinto no Rio Grande do Sul, ele terá
--    que apresentar as certidões de todos os estados. Isso é no sistema do
--    SINARM CAC, SIGMA. Deve haver uma pergunta no momento do cadastro se nos
--    últimos 5 anos o cliente morou no mesmo endereço que ele está declarando
--    no comprovante. PRIMEIRO deve receber o comprovante e DEPOIS perguntar.
--    Se informar que não se mudou, avança normalmente. Se responder que morou,
--    pergunte o estado e a cidade através de um select. Nas certidões deve
--    haver uma separação clara disso: primeiro as certidões do estado atual,
--    depois as do ou dos estados onde morou.
--    Não destrua nada que já funciona, só acrescente funções."
--
-- Decisões confirmadas pelo titular:
--   1. As certidões FEDERAIS também seguem os estados anteriores.
--   2. Pode declarar quantas cidades e estados quiser; no fim só o ESTADO
--      importa. Várias cidades de São Paulo = só as certidões de São Paulo.
--   3. A cidade é guardada como registro.
--
-- ─── COMO ISSO FUNCIONA, EM UMA FRASE ────────────────────────────────────────
--
-- O cliente entrega o comprovante, responde "morei no mesmo endereço nos
-- últimos 5 anos?" e, se disser que não, declara os estados e cidades onde
-- morou. Cada estado declarado vira um bloco próprio de certidões no checklist,
-- separado do bloco do estado atual.
--
-- ─── POR QUE CÓDIGO NOVO POR ESTADO, E NÃO A MESMA LINHA COM UM CAMPO DE UF ──
--
-- Porque existe um índice único em qa_processo_documentos (processo_id,
-- tipo_documento) desde 07/08. O MESMO código duas vezes no mesmo processo é
-- estruturalmente impossível — "distribuições criminais de SP" e "distribuições
-- criminais de MG" precisam de códigos diferentes. É também o precedente da
-- casa: `comprovante_endereco_ano_2024`, `comprovante_endereco_ano_2025`, do
-- qa_seed_endereco_5_anos, resolvem "mesmo documento, várias instâncias"
-- exatamente assim.
--
-- ─── NADA É DESTRUÍDO ────────────────────────────────────────────────────────
--
-- Quando o cliente muda de estado, o estado antigo é REGISTRADO como residência
-- anterior e a certidão que ele já tinha entregue é MOVIDA para a exigência
-- daquele estado — com arquivo, datas e status. Ela não é apagada, não é
-- descartada e o cliente não precisa emitir de novo. O que fica pendente é
-- apenas a certidão do estado NOVO, que de fato ninguém tem.
--
-- ─── ALCANCE (COMPORTAMENTO COMPARTILHADO — LEIA ANTES DE APLICAR) ───────────
--
-- Três pontos aqui mexem em regra que vale além das certidões:
--
--  (a) O botão "Sincronizar checklist em lote" e o painel de divergência param
--      de dispensar linha SEMEADA (a que nasce fora do catálogo por regra do
--      cliente). Efeito para os demais documentos: os comprovantes de endereço
--      por ano (`comprovante_endereco_ano_2024`, ...) e as declarações de
--      efetiva necessidade semeadas DEIXAM de ser marcadas "não aplicável"
--      quando alguém aperta o botão. Isso corrige um defeito que já existe
--      hoje — é estritamente MENOS dispensa, nunca mais.
--  (b) O CHECK de tipos do cofre ganha 117 códigos novos (as famílias por UF e
--      por TRF). É acréscimo puro: nenhum tipo existente sai.
--  (c) O guard que exige resposta antes de dar uma pergunta por cumprida passa
--      a conhecer a pergunta nova. Também é acréscimo puro.
--
-- Reexecutável. Duas transações: a segunda mexe em dado.
-- =============================================================================

-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ TRANSAÇÃO 1 — estrutura e regra                                           ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
BEGIN;

-- ─── 1) ONDE OS ESTADOS ANTERIORES FICAM GUARDADOS ───────────────────────────
-- Não existia lugar nenhum. qa_clientes tem UM endereço e UM segundo endereço
-- de guarda de acervo — nada de histórico. E a resposta de uma pergunta é uma
-- string solta dentro de respostas_questionario_json, onde não cabe lista.
CREATE TABLE IF NOT EXISTS public.qa_cliente_enderecos_anteriores (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  qa_cliente_id  integer NOT NULL REFERENCES public.qa_clientes(id) ON DELETE CASCADE,
  uf             char(2) NOT NULL,
  cidade         text,
  origem         text NOT NULL DEFAULT 'cliente'
                 CHECK (origem IN ('cliente','equipe','sistema')),
  observacao     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.qa_cliente_enderecos_anteriores IS
  'Estados e cidades onde o cliente morou nos últimos 5 anos, além do endereço '
  'atual. Para as certidões só o ESTADO importa (SINARM CAC / SIGMA exigem uma '
  'certidão por estado de residência no período); a cidade fica como registro.';
COMMENT ON COLUMN public.qa_cliente_enderecos_anteriores.origem IS
  '''cliente'' = declarado no cadastro; ''equipe'' = lançado pelo escritório; '
  '''sistema'' = deduzido de uma mudança de estado no cadastro.';

-- Mesma cidade e mesmo estado não entram duas vezes. Cidade nula conta como
-- "estado sem cidade declarada" e também não duplica.
CREATE UNIQUE INDEX IF NOT EXISTS uq_qa_end_anteriores_cliente_uf_cidade
  ON public.qa_cliente_enderecos_anteriores
     (qa_cliente_id, uf, lower(btrim(coalesce(cidade, ''))));

CREATE INDEX IF NOT EXISTS ix_qa_end_anteriores_cliente
  ON public.qa_cliente_enderecos_anteriores (qa_cliente_id);

ALTER TABLE public.qa_cliente_enderecos_anteriores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS end_anteriores_cliente ON public.qa_cliente_enderecos_anteriores;
CREATE POLICY end_anteriores_cliente ON public.qa_cliente_enderecos_anteriores
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.qa_clientes c
     WHERE c.id = qa_cliente_enderecos_anteriores.qa_cliente_id
       AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.qa_clientes c
     WHERE c.id = qa_cliente_enderecos_anteriores.qa_cliente_id
       AND c.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS end_anteriores_equipe ON public.qa_cliente_enderecos_anteriores;
CREATE POLICY end_anteriores_equipe ON public.qa_cliente_enderecos_anteriores
  FOR ALL TO authenticated
  USING (public.qa_has_qa_perfil(auth.uid(), ARRAY['administrador','operador','advogado']))
  WITH CHECK (public.qa_has_qa_perfil(auth.uid(), ARRAY['administrador','operador','advogado']));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_cliente_enderecos_anteriores TO authenticated;
GRANT ALL ON public.qa_cliente_enderecos_anteriores TO service_role;

-- A resposta da pergunta, no cadastro. NULL = ainda não perguntamos.
ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS residiu_mesmo_endereco_5_anos boolean;

COMMENT ON COLUMN public.qa_clientes.residiu_mesmo_endereco_5_anos IS
  'TRUE = morou nos últimos 5 anos no mesmo endereço do comprovante. FALSE = '
  'mudou, e os estados anteriores estão em qa_cliente_enderecos_anteriores. '
  'NULL = ainda não respondeu.';

-- ─── 2) O COFRE PASSA A ACEITAR AS CERTIDÕES DE RESIDÊNCIA ANTERIOR ──────────
-- Sem isso o espelho checklist→cofre (20260821070000) recusaria em silêncio a
-- certidão de estado anterior, e ela nunca viraria patrimônio do cliente.
-- Acréscimo puro: a lista abaixo é a de 20260816250000 mais 117 códigos.
-- A lista vai INTEIRA e LITERAL de propósito: é o formato que o teste
-- catalogoHubVsConstraint consegue auditar.
ALTER TABLE public.qa_documentos_cliente
  DROP CONSTRAINT IF EXISTS qa_doc_cliente_tipo_check;

ALTER TABLE public.qa_documentos_cliente
  ADD CONSTRAINT qa_doc_cliente_tipo_check
  CHECK (tipo_documento = ANY (ARRAY[
    'antecedentes_criminais'::text,
    'antecedentes_criminais_ac'::text,
    'antecedentes_criminais_al'::text,
    'antecedentes_criminais_am'::text,
    'antecedentes_criminais_ap'::text,
    'antecedentes_criminais_ba'::text,
    'antecedentes_criminais_ce'::text,
    'antecedentes_criminais_df'::text,
    'antecedentes_criminais_es'::text,
    'antecedentes_criminais_go'::text,
    'antecedentes_criminais_ma'::text,
    'antecedentes_criminais_mg'::text,
    'antecedentes_criminais_ms'::text,
    'antecedentes_criminais_mt'::text,
    'antecedentes_criminais_pa'::text,
    'antecedentes_criminais_pb'::text,
    'antecedentes_criminais_pe'::text,
    'antecedentes_criminais_pi'::text,
    'antecedentes_criminais_pr'::text,
    'antecedentes_criminais_rj'::text,
    'antecedentes_criminais_rn'::text,
    'antecedentes_criminais_ro'::text,
    'antecedentes_criminais_rr'::text,
    'antecedentes_criminais_rs'::text,
    'antecedentes_criminais_sc'::text,
    'antecedentes_criminais_se'::text,
    'antecedentes_criminais_sp'::text,
    'antecedentes_criminais_to'::text,
    'antecedentes_eleitoral'::text,
    'antecedentes_estadual'::text,
    'antecedentes_estadual_ac'::text,
    'antecedentes_estadual_al'::text,
    'antecedentes_estadual_am'::text,
    'antecedentes_estadual_ap'::text,
    'antecedentes_estadual_ba'::text,
    'antecedentes_estadual_ce'::text,
    'antecedentes_estadual_df'::text,
    'antecedentes_estadual_distribuicao'::text,
    'antecedentes_estadual_distribuicao_ac'::text,
    'antecedentes_estadual_distribuicao_al'::text,
    'antecedentes_estadual_distribuicao_am'::text,
    'antecedentes_estadual_distribuicao_ap'::text,
    'antecedentes_estadual_distribuicao_ba'::text,
    'antecedentes_estadual_distribuicao_ce'::text,
    'antecedentes_estadual_distribuicao_df'::text,
    'antecedentes_estadual_distribuicao_es'::text,
    'antecedentes_estadual_distribuicao_go'::text,
    'antecedentes_estadual_distribuicao_ma'::text,
    'antecedentes_estadual_distribuicao_mg'::text,
    'antecedentes_estadual_distribuicao_ms'::text,
    'antecedentes_estadual_distribuicao_mt'::text,
    'antecedentes_estadual_distribuicao_pa'::text,
    'antecedentes_estadual_distribuicao_pb'::text,
    'antecedentes_estadual_distribuicao_pe'::text,
    'antecedentes_estadual_distribuicao_pi'::text,
    'antecedentes_estadual_distribuicao_pr'::text,
    'antecedentes_estadual_distribuicao_rj'::text,
    'antecedentes_estadual_distribuicao_rn'::text,
    'antecedentes_estadual_distribuicao_ro'::text,
    'antecedentes_estadual_distribuicao_rr'::text,
    'antecedentes_estadual_distribuicao_rs'::text,
    'antecedentes_estadual_distribuicao_sc'::text,
    'antecedentes_estadual_distribuicao_se'::text,
    'antecedentes_estadual_distribuicao_sp'::text,
    'antecedentes_estadual_distribuicao_to'::text,
    'antecedentes_estadual_es'::text,
    'antecedentes_estadual_execucoes'::text,
    'antecedentes_estadual_execucoes_ac'::text,
    'antecedentes_estadual_execucoes_al'::text,
    'antecedentes_estadual_execucoes_am'::text,
    'antecedentes_estadual_execucoes_ap'::text,
    'antecedentes_estadual_execucoes_ba'::text,
    'antecedentes_estadual_execucoes_ce'::text,
    'antecedentes_estadual_execucoes_df'::text,
    'antecedentes_estadual_execucoes_es'::text,
    'antecedentes_estadual_execucoes_go'::text,
    'antecedentes_estadual_execucoes_ma'::text,
    'antecedentes_estadual_execucoes_mg'::text,
    'antecedentes_estadual_execucoes_ms'::text,
    'antecedentes_estadual_execucoes_mt'::text,
    'antecedentes_estadual_execucoes_pa'::text,
    'antecedentes_estadual_execucoes_pb'::text,
    'antecedentes_estadual_execucoes_pe'::text,
    'antecedentes_estadual_execucoes_pi'::text,
    'antecedentes_estadual_execucoes_pr'::text,
    'antecedentes_estadual_execucoes_rj'::text,
    'antecedentes_estadual_execucoes_rn'::text,
    'antecedentes_estadual_execucoes_ro'::text,
    'antecedentes_estadual_execucoes_rr'::text,
    'antecedentes_estadual_execucoes_rs'::text,
    'antecedentes_estadual_execucoes_sc'::text,
    'antecedentes_estadual_execucoes_se'::text,
    'antecedentes_estadual_execucoes_sp'::text,
    'antecedentes_estadual_execucoes_to'::text,
    'antecedentes_estadual_go'::text,
    'antecedentes_estadual_ma'::text,
    'antecedentes_estadual_mg'::text,
    'antecedentes_estadual_ms'::text,
    'antecedentes_estadual_mt'::text,
    'antecedentes_estadual_pa'::text,
    'antecedentes_estadual_pb'::text,
    'antecedentes_estadual_pe'::text,
    'antecedentes_estadual_pi'::text,
    'antecedentes_estadual_pr'::text,
    'antecedentes_estadual_rj'::text,
    'antecedentes_estadual_rn'::text,
    'antecedentes_estadual_ro'::text,
    'antecedentes_estadual_rr'::text,
    'antecedentes_estadual_rs'::text,
    'antecedentes_estadual_sc'::text,
    'antecedentes_estadual_se'::text,
    'antecedentes_estadual_sp'::text,
    'antecedentes_estadual_to'::text,
    'antecedentes_federal'::text,
    'antecedentes_federal_regional_trf1'::text,
    'antecedentes_federal_regional_trf2'::text,
    'antecedentes_federal_regional_trf3'::text,
    'antecedentes_federal_regional_trf4'::text,
    'antecedentes_federal_regional_trf5'::text,
    'antecedentes_federal_regional_trf6'::text,
    'antecedentes_federal_secao_judiciaria_ac'::text,
    'antecedentes_federal_secao_judiciaria_al'::text,
    'antecedentes_federal_secao_judiciaria_am'::text,
    'antecedentes_federal_secao_judiciaria_ap'::text,
    'antecedentes_federal_secao_judiciaria_ba'::text,
    'antecedentes_federal_secao_judiciaria_ce'::text,
    'antecedentes_federal_secao_judiciaria_df'::text,
    'antecedentes_federal_secao_judiciaria_es'::text,
    'antecedentes_federal_secao_judiciaria_go'::text,
    'antecedentes_federal_secao_judiciaria_ma'::text,
    'antecedentes_federal_secao_judiciaria_mg'::text,
    'antecedentes_federal_secao_judiciaria_ms'::text,
    'antecedentes_federal_secao_judiciaria_mt'::text,
    'antecedentes_federal_secao_judiciaria_pa'::text,
    'antecedentes_federal_secao_judiciaria_pb'::text,
    'antecedentes_federal_secao_judiciaria_pe'::text,
    'antecedentes_federal_secao_judiciaria_pi'::text,
    'antecedentes_federal_secao_judiciaria_pr'::text,
    'antecedentes_federal_secao_judiciaria_rj'::text,
    'antecedentes_federal_secao_judiciaria_rn'::text,
    'antecedentes_federal_secao_judiciaria_ro'::text,
    'antecedentes_federal_secao_judiciaria_rr'::text,
    'antecedentes_federal_secao_judiciaria_rs'::text,
    'antecedentes_federal_secao_judiciaria_sc'::text,
    'antecedentes_federal_secao_judiciaria_se'::text,
    'antecedentes_federal_secao_judiciaria_sp'::text,
    'antecedentes_federal_secao_judiciaria_to'::text,
    'antecedentes_federal_sjsp_jef'::text,
    'antecedentes_federal_trf1_regional'::text,
    'antecedentes_federal_trf2_regional'::text,
    'antecedentes_federal_trf3_regional'::text,
    'antecedentes_federal_trf4_regional'::text,
    'antecedentes_federal_trf5_regional'::text,
    'antecedentes_federal_trf6_regional'::text,
    'antecedentes_militar'::text,
    'antecedentes_militar_estadual'::text,
    'antecedentes_militar_estadual_mg'::text,
    'antecedentes_militar_estadual_rs'::text,
    'antecedentes_militar_estadual_sp'::text,
    'atestado_aptidao_psicologica_instituicao'::text,
    'atestado_capacidade_tecnica_instituicao'::text,
    'autorizacao_compra'::text,
    'boletim_ocorrencia'::text,
    'certidao_alteracao_nome'::text,
    'cin'::text,
    'cnh'::text,
    'comprovante_competicao'::text,
    'comprovante_efetiva_necessidade'::text,
    'comprovante_filiacao_entidade_tiro'::text,
    'comprovante_pagamento'::text,
    'comprovante_residencia'::text,
    'contrato_assinado'::text,
    'cr'::text,
    'craf'::text,
    'ctps'::text,
    'declaracao_correlata'::text,
    'declaracao_endereco_acervo'::text,
    'declaracao_guarda_acervo_1endereco'::text,
    'declaracao_guarda_acervo_2enderecos'::text,
    'declaracao_guarda_responsavel'::text,
    'declaracao_homonimia'::text,
    'declaracao_nao_possuir_segundo_endereco'::text,
    'declaracao_responsavel_imovel'::text,
    'declaracao_sem_inquerito_processo_criminal'::text,
    'despacho'::text,
    'documento_complementar_caso'::text,
    'documento_identificacao_terceiro'::text,
    'dsa_declaracao_seguranca_acervo'::text,
    'exigencia'::text,
    'foto_3x4'::text,
    'gru'::text,
    'gru_comprovante'::text,
    'gt'::text,
    'gte'::text,
    'habilitacao_cacador_ibama'::text,
    'indeferimento'::text,
    'juntada_assinada'::text,
    'laudo_capacidade_tecnica'::text,
    'laudo_psicologico'::text,
    'mandado_seguranca_doc'::text,
    'nota_fiscal_arma'::text,
    'oficio'::text,
    'outro'::text,
    'procuracao'::text,
    'procuracao_assinada'::text,
    'protocolo_processo'::text,
    'recurso_administrativo_doc'::text,
    'renda_cartao_cnpj'::text,
    'renda_carteira_funcional'::text,
    'renda_ccmei'::text,
    'renda_cnpj_autonomo'::text,
    'renda_comprovante_beneficio'::text,
    'renda_contra_cheque_mes_atual'::text,
    'renda_contrato_social'::text,
    'renda_extrato_inss'::text,
    'renda_ficha_cadastral_jucesp'::text,
    'renda_holerite_funcionario_publico'::text,
    'renda_holerite_mes_atual'::text,
    'renda_nf_empresa'::text,
    'renda_qsa'::text,
    'requerimento_de_posse_de_arma_de_fogo'::text,
    'rg_com_cpf'::text,
    'sinarm'::text
  ]));

-- ─── 3) O NOME DO CÓDIGO, DO NOME E DO LINK PARA CADA ESTADO ANTERIOR ────────
-- Uma função por coisa, para que o semeador, a tela e qualquer conferência
-- futura leiam a MESMA regra. Devolvem NULL quando não se aplica — por exemplo,
-- Tribunal de Justiça Militar em estado que não tem um.
CREATE OR REPLACE FUNCTION public.qa_certidao_tipo_do_estado_anterior(
  p_generico text, p_uf char(2))
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE btrim(lower(coalesce(p_generico,'')))
    WHEN 'antecedentes_estadual_distribuicao'
      THEN 'antecedentes_estadual_distribuicao_' || lower(c.uf)
    WHEN 'antecedentes_estadual_execucoes'
      THEN 'antecedentes_estadual_execucoes_' || lower(c.uf)
    WHEN 'antecedentes_criminais'
      THEN 'antecedentes_criminais_' || lower(c.uf)
    WHEN 'antecedentes_federal_sjsp_jef'
      THEN 'antecedentes_federal_secao_judiciaria_' || lower(c.uf)
    WHEN 'antecedentes_federal_trf3_regional'
      -- A certidão da Justiça Federal regional vale para a REGIÃO inteira, não
      -- para o estado. Dois estados da mesma região usam a mesma certidão.
      THEN 'antecedentes_federal_regional_trf' || c.trf_numero::text
    WHEN 'antecedentes_militar_estadual'
      -- Só existe Tribunal de Justiça Militar em SP, MG e RS.
      THEN CASE WHEN c.tjm_link IS NOT NULL
                THEN 'antecedentes_militar_estadual_' || lower(c.uf) END
    ELSE NULL
  END
  FROM public.qa_uf_certidao c
 WHERE c.uf = public.qa_uf_normalizar(p_uf);
$$;

COMMENT ON FUNCTION public.qa_certidao_tipo_do_estado_anterior(text, char) IS
  'Código do documento da certidão de RESIDÊNCIA ANTERIOR equivalente a uma '
  'certidão genérica (a do estado atual). NULL quando não existe equivalente — '
  'caso do Tribunal de Justiça Militar fora de SP, MG e RS.';

CREATE OR REPLACE FUNCTION public.qa_certidao_nome_do_estado_anterior(
  p_generico text, p_uf char(2))
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE btrim(lower(coalesce(p_generico,'')))
    WHEN 'antecedentes_estadual_distribuicao'
      THEN 'Certidão Estadual de Distribuições Criminais — ' || c.tj_sigla
    WHEN 'antecedentes_estadual_execucoes'
      THEN 'Certidão Estadual de Execuções Criminais — ' || c.tj_sigla
    WHEN 'antecedentes_criminais'
      THEN 'Certidão de Antecedentes Criminais — Polícia Civil/' || c.uf
    WHEN 'antecedentes_federal_sjsp_jef'
      THEN 'Certidão da Justiça Federal — Seção Judiciária de ' || c.uf || ' e JEF'
    WHEN 'antecedentes_federal_trf3_regional'
      THEN 'Certidão da Justiça Federal — TRF' || c.trf_numero::text || ' (regional)'
    WHEN 'antecedentes_militar_estadual'
      THEN CASE WHEN c.tjm_link IS NOT NULL
                THEN 'Certidão do Tribunal de Justiça Militar — TJM-' || c.uf END
    ELSE NULL
  END || ' — residência anterior (' || c.uf || ')'
  FROM public.qa_uf_certidao c
 WHERE c.uf = public.qa_uf_normalizar(p_uf);
$$;

CREATE OR REPLACE FUNCTION public.qa_certidao_link_do_estado_anterior(
  p_generico text, p_uf char(2))
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT CASE btrim(lower(coalesce(p_generico,'')))
    WHEN 'antecedentes_estadual_distribuicao'    THEN c.tj_link
    WHEN 'antecedentes_estadual_execucoes'       THEN c.tj_link
    WHEN 'antecedentes_criminais'                THEN c.pc_link
    WHEN 'antecedentes_federal_sjsp_jef'         THEN c.trf_link
    WHEN 'antecedentes_federal_trf3_regional'    THEN c.trf_link
    WHEN 'antecedentes_militar_estadual'         THEN c.tjm_link
    ELSE NULL
  END
  FROM public.qa_uf_certidao c
 WHERE c.uf = public.qa_uf_normalizar(p_uf);
$$;

GRANT EXECUTE ON FUNCTION public.qa_certidao_tipo_do_estado_anterior(text, char) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.qa_certidao_nome_do_estado_anterior(text, char) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.qa_certidao_link_do_estado_anterior(text, char) TO authenticated, service_role;

-- ─── 4) O SEMEADOR: cada estado declarado vira um bloco de certidões ─────────
-- Mesmo molde do qa_seed_endereco_5_anos, que já semeia os comprovantes de
-- endereço por ano nos serviços 31, 44, 50 e 51.
--
-- A TRAVA QUE IMPEDE INVENTAR EXIGÊNCIA: um bloco só nasce se o processo JÁ
-- exige a certidão genérica equivalente. Serviço que não pede antecedentes
-- estaduais não passa a pedir por causa desta migration. Serviço que não pede
-- TJM não ganha TJM. Nada é criado onde nada era pedido.
CREATE OR REPLACE FUNCTION public.qa_seed_certidoes_estados_anteriores(p_processo_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_proc      public.qa_processos%ROWTYPE;
  v_uf_atual  char(2);
  v_ufs       text[];
  v_uf        text;
  v_generico  text;
  v_tipo      text;
  v_nome      text;
  v_link      text;
  v_cidades   text;
  v_rank      integer := 0;
  v_idx       integer;
  v_rows      integer;
  v_total     integer := 0;
  v_origem    record;
  v_destino   uuid;
  -- As certidões que dependem do estado, na ordem em que aparecem no dossiê.
  c_genericos constant text[] := ARRAY[
    'antecedentes_estadual_distribuicao',
    'antecedentes_estadual_execucoes',
    'antecedentes_criminais',
    'antecedentes_federal_trf3_regional',
    'antecedentes_federal_sjsp_jef',
    'antecedentes_militar_estadual'
  ];
BEGIN
  SELECT * INTO v_proc FROM public.qa_processos WHERE id = p_processo_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  -- Dossiê já entregue ao órgão não recebe exigência nova (Lei 9.784/99, mesma
  -- regra de 20260821010000). Notificação e recurso religam o relógio.
  IF public.qa_processo_relogio_parado(p_processo_id) THEN RETURN 0; END IF;

  SELECT public.qa_uf_normalizar(cl.estado) INTO v_uf_atual
    FROM public.qa_clientes cl WHERE cl.id = v_proc.cliente_id;

  -- Estados declarados, sem repetir, sem o estado atual e só os reconhecidos.
  -- É aqui que "morei em três cidades de São Paulo" vira UM estado só.
  SELECT array_agg(DISTINCT ea.uf::text ORDER BY ea.uf::text) INTO v_ufs
    FROM public.qa_cliente_enderecos_anteriores ea
    JOIN public.qa_uf_certidao c ON c.uf = ea.uf
   WHERE ea.qa_cliente_id = v_proc.cliente_id
     AND (v_uf_atual IS NULL OR ea.uf <> v_uf_atual);

  -- ── 4a) Cria (ou atualiza o rótulo de) os blocos dos estados anteriores ───
  FOREACH v_uf IN ARRAY COALESCE(v_ufs, ARRAY[]::text[]) LOOP
    v_rank := v_rank + 1;
    v_idx  := 0;

    SELECT string_agg(DISTINCT btrim(ea.cidade), ', ') INTO v_cidades
      FROM public.qa_cliente_enderecos_anteriores ea
     WHERE ea.qa_cliente_id = v_proc.cliente_id
       AND ea.uf = v_uf
       AND NULLIF(btrim(coalesce(ea.cidade,'')), '') IS NOT NULL;

    FOREACH v_generico IN ARRAY c_genericos LOOP
      v_idx := v_idx + 1;

      -- A TRAVA: o processo precisa JÁ exigir a certidão genérica equivalente.
      IF NOT EXISTS (
        SELECT 1 FROM public.qa_processo_documentos pd
         WHERE pd.processo_id = p_processo_id
           AND pd.tipo_documento = v_generico
      ) THEN
        CONTINUE;
      END IF;

      v_tipo := public.qa_certidao_tipo_do_estado_anterior(v_generico, v_uf::char(2));
      IF v_tipo IS NULL THEN CONTINUE; END IF;   -- TJM onde não há tribunal

      -- Federal regional é por REGIÃO: se o estado anterior está na mesma
      -- região do estado atual, a certidão do estado atual já cobre.
      IF v_generico = 'antecedentes_federal_trf3_regional'
         AND v_uf_atual IS NOT NULL
         AND (SELECT a.trf_numero FROM public.qa_uf_certidao a WHERE a.uf = v_uf)
             = (SELECT b.trf_numero FROM public.qa_uf_certidao b WHERE b.uf = v_uf_atual)
      THEN
        CONTINUE;
      END IF;

      v_nome := public.qa_certidao_nome_do_estado_anterior(v_generico, v_uf::char(2));
      v_link := public.qa_certidao_link_do_estado_anterior(v_generico, v_uf::char(2));

      INSERT INTO public.qa_processo_documentos (
        processo_id, cliente_id, tipo_documento, nome_documento,
        etapa, status, obrigatorio, validade_dias, link_emissao,
        ordem, formato_aceito, uf_referencia,
        instrucoes, regra_validacao, campos_complementares_json
      )
      SELECT p_processo_id, v_proc.cliente_id, v_tipo, v_nome,
             'base', 'pendente', true,
             public.qa_prazo_certidao(v_generico), v_link,
             800 + (v_rank * 10) + v_idx,
             ARRAY['pdf','jpg','jpeg','png'], upper(v_uf)::char(2),
             'Você declarou ter morado em ' || upper(v_uf) ||
               COALESCE(' (' || v_cidades || ')', '') ||
               ' nos últimos 5 anos. O SINARM e o SIGMA exigem a certidão de ' ||
               'cada estado de residência do período.',
             jsonb_build_object(
               'grupo_checklist',       'antecedentes_anteriores',
               'ordem_grupo_checklist', 65,
               'residencia_anterior',   true,
               'uf_referencia',         upper(v_uf)
             ),
             jsonb_build_object(
               'gerado_por',        'estados_anteriores',
               'certidao_generica', v_generico,
               'uf',                upper(v_uf),
               'cidades',           v_cidades
             )
       WHERE NOT EXISTS (
         SELECT 1 FROM public.qa_processo_documentos x
          WHERE x.processo_id = p_processo_id
            AND x.tipo_documento = v_tipo
       );
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_total := v_total + v_rows;

      -- Cidades novas declaradas depois: só o texto é atualizado, e só em
      -- linha que o cliente ainda não cumpriu.
      UPDATE public.qa_processo_documentos pd
         SET campos_complementares_json =
               COALESCE(pd.campos_complementares_json,'{}'::jsonb)
               || jsonb_build_object('cidades', v_cidades),
             updated_at = now()
       WHERE pd.processo_id = p_processo_id
         AND pd.tipo_documento = v_tipo
         AND pd.campos_complementares_json ->> 'cidades' IS DISTINCT FROM v_cidades;
    END LOOP;
  END LOOP;

  -- ── 4b) A CERTIDÃO QUE JÁ EXISTE NÃO SE PERDE ─────────────────────────────
  -- Certidão genérica carimbada com um estado que hoje é ANTERIOR é MOVIDA para
  -- a exigência daquele estado: arquivo, datas e status vão junto. Só depois de
  -- a mudança dar certo é que a linha genérica volta a ficar pendente — agora
  -- pedindo a certidão do estado NOVO, que é o que de fato falta.
  IF v_uf_atual IS NOT NULL THEN
    FOR v_origem IN
      SELECT pd.*
        FROM public.qa_processo_documentos pd
       WHERE pd.processo_id = p_processo_id
         AND pd.tipo_documento = ANY (c_genericos)
         AND pd.uf_referencia IS NOT NULL
         AND pd.uf_referencia <> v_uf_atual
         AND coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')) IS NOT NULL
    LOOP
      v_tipo := public.qa_certidao_tipo_do_estado_anterior(
                  v_origem.tipo_documento, v_origem.uf_referencia);
      IF v_tipo IS NULL THEN CONTINUE; END IF;

      UPDATE public.qa_processo_documentos d
         SET arquivo_storage_key = v_origem.arquivo_storage_key,
             arquivo_url         = v_origem.arquivo_url,
             status              = v_origem.status,
             data_emissao        = v_origem.data_emissao,
             data_validade       = v_origem.data_validade,
             data_envio          = v_origem.data_envio,
             data_validacao      = v_origem.data_validacao,
             orgao_emissor       = v_origem.orgao_emissor,
             dados_extraidos_json = v_origem.dados_extraidos_json,
             observacoes = COALESCE(d.observacoes,'') ||
               CASE WHEN COALESCE(d.observacoes,'') = '' THEN '' ELSE E'\n' END ||
               '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
               '] Certidão que o cliente já havia entregue para ' || v_origem.uf_referencia ||
               ' foi aproveitada aqui — ela continua valendo como certidão da ' ||
               'residência anterior.',
             updated_at = now()
       WHERE d.processo_id = p_processo_id
         AND d.tipo_documento = v_tipo
         AND coalesce(nullif(d.arquivo_storage_key,''), nullif(d.arquivo_url,'')) IS NULL
      RETURNING d.id INTO v_destino;

      IF v_destino IS NOT NULL THEN
        UPDATE public.qa_processo_documentos o
           SET status              = 'pendente',
               arquivo_storage_key = NULL,
               arquivo_url         = NULL,
               data_validacao      = NULL,
               uf_referencia       = NULL,
               observacoes = COALESCE(o.observacoes,'') ||
                 CASE WHEN COALESCE(o.observacoes,'') = '' THEN '' ELSE E'\n' END ||
                 '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
                 '] O endereço do cliente passou a ser ' || v_uf_atual ||
                 '. A certidão de ' || v_origem.uf_referencia ||
                 ' não foi descartada: virou a exigência da residência anterior. ' ||
                 'Aqui falta a certidão de ' || v_uf_atual || '.',
               updated_at = now()
         WHERE o.id = v_origem.id;
        v_destino := NULL;
      END IF;
    END LOOP;
  END IF;

  -- ── 4c) Estado que o cliente retirou da declaração ────────────────────────
  -- Não apaga nada: a linha vira "não aplicável" e só quando está vazia. O que
  -- já foi entregue permanece exatamente como está.
  UPDATE public.qa_processo_documentos pd
     SET status = 'nao_aplicavel',
         observacoes = COALESCE(pd.observacoes,'') ||
           CASE WHEN COALESCE(pd.observacoes,'') = '' THEN '' ELSE E'\n' END ||
           '[' || to_char(now() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI') ||
           '] Estado deixou de constar na declaração de residências dos últimos 5 anos.',
         updated_at = now()
   WHERE pd.processo_id = p_processo_id
     AND pd.campos_complementares_json ->> 'gerado_por' = 'estados_anteriores'
     AND pd.status NOT IN ('nao_aplicavel','aprovado','validado','conforme',
                           'dispensado','dispensado_grupo','dispensado_por_reaproveitamento',
                           'entregue','entregue_pelo_hub','concluido','concluído')
     AND coalesce(nullif(pd.arquivo_storage_key,''), nullif(pd.arquivo_url,'')) IS NULL
     AND NOT (upper(coalesce(pd.campos_complementares_json ->> 'uf','')) =
              ANY (COALESCE(v_ufs, ARRAY[]::text[])));

  RETURN v_total;
END;
$function$;

COMMENT ON FUNCTION public.qa_seed_certidoes_estados_anteriores(uuid) IS
  'Cria no checklist do processo um bloco de certidões para cada estado onde o '
  'cliente declarou ter morado nos últimos 5 anos. Só cria bloco de certidão '
  'que o processo JÁ exigia para o estado atual — não inventa exigência. '
  'Certidão do estado antigo que já estava entregue é MOVIDA para o bloco do '
  'estado anterior, nunca descartada.';

REVOKE ALL ON FUNCTION public.qa_seed_certidoes_estados_anteriores(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_seed_certidoes_estados_anteriores(uuid) TO authenticated, service_role;

-- ─── 5) Quando o semeador roda sozinho ───────────────────────────────────────
-- Um só lugar que resseia todos os processos do cliente que ainda montam
-- dossiê. Os três gatilhos abaixo chamam este atalho.
CREATE OR REPLACE FUNCTION public.qa_resseia_estados_anteriores_do_cliente(p_cliente_id integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE r record; v_total integer := 0;
BEGIN
  FOR r IN
    SELECT p.id FROM public.qa_processos p
     WHERE p.cliente_id = p_cliente_id
       AND NOT public.qa_processo_relogio_parado(p.id)
  LOOP
    BEGIN
      v_total := v_total + COALESCE(public.qa_seed_certidoes_estados_anteriores(r.id), 0);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'semeadura de estados anteriores falhou no processo %: %', r.id, SQLERRM;
    END;
  END LOOP;
  RETURN v_total;
END;
$function$;

REVOKE ALL ON FUNCTION public.qa_resseia_estados_anteriores_do_cliente(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.qa_resseia_estados_anteriores_do_cliente(integer) TO authenticated, service_role;

-- 5a) Declarou, mudou ou apagou um endereço anterior.
CREATE OR REPLACE FUNCTION public.qa_trg_endereco_anterior_resseia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.qa_resseia_estados_anteriores_do_cliente(
    COALESCE(NEW.qa_cliente_id, OLD.qa_cliente_id));
  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS qa_trg_endereco_anterior_resseia ON public.qa_cliente_enderecos_anteriores;
CREATE TRIGGER qa_trg_endereco_anterior_resseia
  AFTER INSERT OR UPDATE OR DELETE
  ON public.qa_cliente_enderecos_anteriores
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_trg_endereco_anterior_resseia();

-- 5b) A resposta da pergunta volta do processo para o cadastro.
--     Mesmo desenho de 20260820210000 (resposta do 2º endereço).
CREATE OR REPLACE FUNCTION public.qa_trg_resposta_residencia_5_anos_no_cadastro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nova  text;
  v_velha text;
BEGIN
  v_nova  := lower(btrim(COALESCE(NEW.respostas_questionario_json ->> 'residencia_5_anos', '')));
  v_velha := lower(btrim(COALESCE(OLD.respostas_questionario_json ->> 'residencia_5_anos', '')));

  IF v_nova = v_velha THEN RETURN NEW; END IF;
  IF v_nova NOT IN ('sim','nao') THEN RETURN NEW; END IF;

  -- 'sim' = morou no mesmo endereço os 5 anos.
  UPDATE public.qa_clientes
     SET residiu_mesmo_endereco_5_anos = (v_nova = 'sim'),
         updated_at = now()
   WHERE id = NEW.cliente_id
     AND residiu_mesmo_endereco_5_anos IS DISTINCT FROM (v_nova = 'sim');

  -- Disse que NÃO mudou: os estados anteriores que porventura estejam
  -- declarados deixam de valer, e os blocos vazios saem do checklist. Nada é
  -- apagado — a declaração some, as linhas cumpridas ficam.
  IF v_nova = 'sim' THEN
    DELETE FROM public.qa_cliente_enderecos_anteriores
     WHERE qa_cliente_id = NEW.cliente_id
       AND origem = 'cliente';
  END IF;

  PERFORM public.qa_resseia_estados_anteriores_do_cliente(NEW.cliente_id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS qa_trg_resposta_residencia_5_anos ON public.qa_processos;
CREATE TRIGGER qa_trg_resposta_residencia_5_anos
  AFTER UPDATE OF respostas_questionario_json
  ON public.qa_processos
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_trg_resposta_residencia_5_anos_no_cadastro();

-- 5c) MUDOU DE ESTADO NO CADASTRO — o estado antigo vira residência anterior.
--     É esta a "trava do estado" que o titular pediu, na forma que NÃO destrói:
--     em vez de apagar a certidão do estado antigo, ela passa a valer como
--     certidão da residência anterior, e o que fica pendente é a do estado novo.
CREATE OR REPLACE FUNCTION public.qa_trg_mudanca_de_estado_vira_residencia_anterior()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_antiga char(2);
  v_nova   char(2);
BEGIN
  v_antiga := public.qa_uf_normalizar(OLD.estado);
  v_nova   := public.qa_uf_normalizar(NEW.estado);

  -- PRIMEIRO preenchimento não é mudança de estado: sem estado antigo, não há
  -- residência anterior nenhuma a registrar.
  IF v_antiga IS NULL OR v_nova IS NULL OR v_antiga = v_nova THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.qa_cliente_enderecos_anteriores
    (qa_cliente_id, uf, cidade, origem, observacao)
  VALUES (NEW.id, v_antiga, NULLIF(btrim(coalesce(OLD.cidade,'')), ''), 'sistema',
          'Registrado automaticamente quando o endereço do cadastro mudou de ' ||
          v_antiga || ' para ' || v_nova || '.')
  ON CONFLICT DO NOTHING;

  -- O gatilho da tabela de endereços já resseia; esta chamada cobre o caso de
  -- o INSERT acima não ter criado linha nova (estado já declarado antes).
  PERFORM public.qa_resseia_estados_anteriores_do_cliente(NEW.id);

  INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, dados_json, ator)
  SELECT p.id, 'mudanca_de_estado_residencia',
         format('Endereço do cliente mudou de %s para %s. %s passa a ser residência anterior: '
             || 'as certidões daquele estado continuam valendo lá, e as do estado novo '
             || 'passam a ser exigidas.', v_antiga, v_nova, v_antiga),
         jsonb_build_object('uf_anterior', v_antiga, 'uf_nova', v_nova),
         'sistema'
    FROM public.qa_processos p
   WHERE p.cliente_id = NEW.id
     AND NOT public.qa_processo_relogio_parado(p.id);

  RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.qa_trg_mudanca_de_estado_vira_residencia_anterior() IS
  'Mudou o estado do cadastro: o estado antigo entra em '
  'qa_cliente_enderecos_anteriores e o checklist ganha o bloco daquele estado. '
  'A certidão já entregue é movida para lá pelo semeador — nada é apagado.';

DROP TRIGGER IF EXISTS qa_trg_mudanca_de_estado_vira_residencia_anterior ON public.qa_clientes;
CREATE TRIGGER qa_trg_mudanca_de_estado_vira_residencia_anterior
  AFTER UPDATE OF estado
  ON public.qa_clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_trg_mudanca_de_estado_vira_residencia_anterior();

-- ─── 6) O exploder do checklist passa a semear os estados anteriores ─────────
-- Patch textual, pela mesma razão de sempre: a definição VIVA de
-- qa_explodir_checklist_processo foi alterada por várias migrations e recriar
-- do arquivo reverteria o que estiver vivo. ABORTA se não achar o alvo.
DO $exploder$
DECLARE
  d    text;
  novo text;
  alvo constant text := 'v_endereco_seed     := public.qa_seed_endereco_5_anos(p_processo_id);';
  oid_alvo oid;
BEGIN
  SELECT p.oid INTO oid_alvo
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public' AND p.proname = 'qa_explodir_checklist_processo'
   LIMIT 1;
  IF oid_alvo IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: qa_explodir_checklist_processo nao encontrada';
  END IF;
  d := pg_get_functiondef(oid_alvo);

  IF position('qa_seed_certidoes_estados_anteriores' in d) > 0 THEN
    RAISE NOTICE 'Exploder ja semeia estados anteriores — nada a fazer.';
    RETURN;
  END IF;
  IF position(alvo in d) = 0 THEN
    RAISE EXCEPTION 'ABORTADO: chamada de qa_seed_endereco_5_anos nao encontrada no exploder';
  END IF;

  novo := replace(d, alvo, alvo || '
      PERFORM public.qa_seed_certidoes_estados_anteriores(p_processo_id);');
  EXECUTE novo;
END
$exploder$;

-- ─── 7) A PERGUNTA, no catálogo — depois do comprovante ──────────────────────
-- "Primeiro deve receber o comprovante e depois que receber, perguntar."
-- A pergunta fica no grupo de endereço, com ordem_grupo_checklist 45 — logo
-- depois do comprovante de residência, que é 40.
INSERT INTO public.qa_servicos_documentos (
  servico_id, tipo_documento, nome_documento, etapa, ordem, obrigatorio,
  obrigatorio_etapa02, ativo, emissor, escopo, formato_aceito,
  validade_dias, instrucoes, observacoes_cliente, regra_validacao
)
SELECT s.servico_id,
       'pergunta_residencia_5_anos',
       'Nos últimos 5 anos você morou sempre no endereço do comprovante que enviou?',
       'complementar', 205, true,
       false, true, 'cliente', 'processo', ARRAY[]::text[],
       NULL,
       'O SINARM e o SIGMA exigem certidão de antecedentes de CADA estado onde '
       || 'você morou nos últimos cinco anos.',
       'Se você mudou de estado nesse período, vamos pedir as certidões dos '
       || 'estados anteriores também.',
       jsonb_build_object(
         'grupo_checklist',       'endereco',
         'ordem_grupo_checklist', 45,
         'tipo',  'pergunta',
         'chave', 'residencia_5_anos',
         'depende_de', jsonb_build_object('documento','comprovante_residencia'),
         'opcoes', jsonb_build_array(
           jsonb_build_object('valor','sim','label','SIM, morei sempre neste mesmo endereço'),
           jsonb_build_object('valor','nao','label','NÃO, morei em outro estado nos últimos 5 anos')
         ))
  FROM (VALUES (31),(44),(50),(51),(60)) AS s(servico_id)
 WHERE EXISTS (
   -- Só entra em serviço que já pede comprovante de residência E certidão
   -- estadual de antecedentes. Serviço sem isso não ganha pergunta nenhuma.
   SELECT 1 FROM public.qa_servicos_documentos sd
    WHERE sd.servico_id = s.servico_id
      AND sd.ativo
      AND sd.tipo_documento = 'antecedentes_estadual_distribuicao'
 )
   AND NOT EXISTS (
   SELECT 1 FROM public.qa_servicos_documentos sd
    WHERE sd.servico_id = s.servico_id
      AND sd.tipo_documento = 'pergunta_residencia_5_anos'
 );

-- ─── 8) O guard das perguntas conhece a pergunta nova ────────────────────────
-- Acréscimo puro: um tipo a mais na lista. Sem isto, a pergunta poderia ser
-- dada por cumprida sem o cliente ter respondido nada.
CREATE OR REPLACE FUNCTION public.qa_guard_pergunta_sem_resposta()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_chave text;
  v_respostas jsonb;
BEGIN
  IF NEW.tipo_documento NOT IN (
    'pergunta_comprovante_em_nome',
    'pergunta_ainda_reside_imovel',
    'pergunta_responde_inquerito_criminal',
    'pergunta_residencia_5_anos'
  ) THEN
    RETURN NEW;
  END IF;

  IF NEW.status NOT IN ('aprovado','validado','dispensado_grupo') THEN
    RETURN NEW;
  END IF;

  v_chave := CASE NEW.tipo_documento
    WHEN 'pergunta_comprovante_em_nome'         THEN 'comprovante_em_nome_titular'
    WHEN 'pergunta_ainda_reside_imovel'         THEN 'ainda_reside_imovel'
    WHEN 'pergunta_responde_inquerito_criminal' THEN 'responde_inquerito_criminal'
    WHEN 'pergunta_residencia_5_anos'           THEN 'residencia_5_anos'
  END;

  SELECT respostas_questionario_json INTO v_respostas
    FROM public.qa_processos
   WHERE id = NEW.processo_id;

  IF v_respostas IS NULL OR NOT (v_respostas ? v_chave) THEN
    RAISE EXCEPTION 'PERGUNTA_SEM_RESPOSTA: a pergunta % não pode ser marcada como cumprida sem resposta explícita do cliente em respostas_questionario_json[%]',
      NEW.tipo_documento, v_chave
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status IN ('aprovado','validado') THEN
    NEW.status := 'dispensado_grupo';
  END IF;

  RETURN NEW;
END;
$function$;

-- ─── 9) O botão de sincronizar não dispensa mais linha SEMEADA ───────────────
-- Linha semeada é a que nasce fora do catálogo por uma regra do cliente: os
-- comprovantes de endereço por ano, e agora as certidões dos estados
-- anteriores. Elas nunca vão constar do catálogo do serviço — é da natureza
-- delas — e por isso o botão as marcava como "não aplicável", apagando do
-- checklist exigência legítima.
--
-- COMPORTAMENTO COMPARTILHADO: isto vale para TODO tipo de documento semeado, e
-- corrige um defeito que já existe hoje nos serviços 31, 44, 50 e 51. É
-- estritamente MENOS dispensa — nada passa a ser dispensado que não fosse.
CREATE OR REPLACE FUNCTION public.qa_documento_semeado(
  p_tipo text, p_campos jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT COALESCE(p_campos ->> 'gerado_por', '') <> ''
      OR btrim(lower(coalesce(p_tipo,''))) LIKE 'comprovante\_endereco\_ano\_%';
$$;

COMMENT ON FUNCTION public.qa_documento_semeado(text, jsonb) IS
  'TRUE quando a linha do checklist nasceu de uma regra do cliente e não do '
  'catálogo do serviço (comprovantes de endereço por ano, certidões dos '
  'estados anteriores). Linha semeada nunca é dispensada por divergência com '
  'o catálogo — ela nunca vai estar lá.';

GRANT EXECUTE ON FUNCTION public.qa_documento_semeado(text, jsonb) TO authenticated, service_role;

COMMIT;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ TRANSAÇÃO 2 — o botão de sincronizar e o painel de divergência             ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
-- Patch textual outra vez, e pelo mesmo motivo: preserva o que estiver VIVO no
-- banco e aborta se o alvo não estiver lá. Recriar as duas funções do arquivo
-- reverteria em silêncio qualquer ajuste aplicado depois de 20260821050000.
BEGIN;

DO $sync$
DECLARE
  d    text;
  novo text;
  o    oid;
  a1 constant text := 'AND NOT EXISTS (SELECT 1 FROM cat c WHERE c.tipo_documento = pd.tipo_documento)';
  a2 constant text := 'AND (coalesce(nullif(pd.arquivo_storage_key,''''), nullif(pd.arquivo_url,'''')) IS NOT NULL';
  n1 int; n2 int;
BEGIN
  SELECT p.oid INTO o
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public'
     AND p.proname = 'qa_sincronizar_checklist_processos_servico'
   LIMIT 1;
  IF o IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: qa_sincronizar_checklist_processos_servico nao encontrada';
  END IF;
  d := pg_get_functiondef(o);

  IF position('qa_documento_semeado' in d) > 0 THEN
    RAISE NOTICE 'Botao de sincronizar ja respeita linha semeada — nada a fazer.';
    RETURN;
  END IF;
  IF position('qa_catalogo_do_processo' in d) = 0 THEN
    RAISE EXCEPTION 'ABORTADO: a versao viva do botao nao e a de 20260821050000 (sem qa_catalogo_do_processo). Reveja antes de aplicar.';
  END IF;

  n1 := (length(d) - length(replace(d, a1, ''))) / length(a1);
  n2 := (length(d) - length(replace(d, a2, ''))) / length(a2);
  IF n1 <> 1 OR n2 <> 1 THEN
    RAISE EXCEPTION 'ABORTADO: alvos do botao nao batem (dispensa=%, preservados=%). Esperado 1 e 1.', n1, n2;
  END IF;

  novo := replace(d, a1, a1 || '
         -- LINHA SEMEADA NUNCA E DISPENSADA: ela nasce de regra do cliente
         -- (comprovante de endereco por ano, certidao de estado anterior) e
         -- por natureza nunca vai constar do catalogo do servico.
         AND NOT public.qa_documento_semeado(pd.tipo_documento, pd.campos_complementares_json)');
  novo := replace(novo, a2,
         '-- espelho exato do filtro de dispensa: semeada nao conta como preservada
       AND NOT public.qa_documento_semeado(pd.tipo_documento, pd.campos_complementares_json)
       ' || a2);

  EXECUTE novo;
  RAISE NOTICE 'Botao de sincronizar passou a preservar linha semeada.';
END
$sync$;

DO $div$
DECLARE
  d    text;
  novo text;
  o    oid;
  a1 constant text := 'SELECT pd.processo_id, pd.tipo_documento, pd.status,';
  a2 constant text := 'AND dp.arquivo IS NULL';
  n1 int; n2 int;
BEGIN
  SELECT p.oid INTO o
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid = p.pronamespace
   WHERE ns.nspname = 'public'
     AND p.proname = 'qa_servico_divergencia_catalogo'
   LIMIT 1;
  IF o IS NULL THEN
    RAISE EXCEPTION 'ABORTADO: qa_servico_divergencia_catalogo nao encontrada';
  END IF;
  d := pg_get_functiondef(o);

  IF position('qa_documento_semeado' in d) > 0 THEN
    RAISE NOTICE 'Painel de divergencia ja respeita linha semeada — nada a fazer.';
    RETURN;
  END IF;
  IF position('qa_catalogo_do_processo' in d) = 0 THEN
    RAISE EXCEPTION 'ABORTADO: a versao viva do painel nao e a de 20260821050000. Reveja antes de aplicar.';
  END IF;

  n1 := (length(d) - length(replace(d, a1, ''))) / length(a1);
  n2 := (length(d) - length(replace(d, a2, ''))) / length(a2);
  IF n1 <> 1 OR n2 <> 1 THEN
    RAISE EXCEPTION 'ABORTADO: alvos do painel nao batem (select=%, filtro=%). Esperado 1 e 1.', n1, n2;
  END IF;

  novo := replace(d, a1, a1 || ' pd.campos_complementares_json,');
  novo := replace(novo, a2, a2 || '
       -- Linha semeada nunca e divergencia: ela nunca esteve no catalogo.
       AND NOT public.qa_documento_semeado(dp.tipo_documento, dp.campos_complementares_json)');

  EXECUTE novo;
  RAISE NOTICE 'Painel de divergencia passou a ignorar linha semeada.';
END
$div$;

COMMIT;


-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║ TRANSAÇÃO 3 — a pergunta entra nos processos que já estão abertos          ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝
BEGIN;

-- Silencia os avisos: uma pergunta nova no checklist não é "documento recebido".
DO $off$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['trg_qa_processo_doc_verde','trg_qa_admin_notif_doc_processo'] LOOP
    IF EXISTS (SELECT 1 FROM pg_trigger g
                 JOIN pg_class c ON c.oid = g.tgrelid
                WHERE c.relname = 'qa_processo_documentos' AND g.tgname = t) THEN
      EXECUTE format('ALTER TABLE public.qa_processo_documentos DISABLE TRIGGER %I', t);
    END IF;
  END LOOP;
END $off$;

INSERT INTO public.qa_processo_documentos (
  processo_id, cliente_id, tipo_documento, nome_documento, etapa,
  status, obrigatorio, validade_dias, formato_aceito, regra_validacao,
  instrucoes, observacoes_cliente, ordem
)
SELECT p.id, p.cliente_id, sd.tipo_documento, sd.nome_documento, sd.etapa,
       'pendente', COALESCE(sd.obrigatorio, true), sd.validade_dias,
       sd.formato_aceito, sd.regra_validacao,
       sd.instrucoes, sd.observacoes_cliente, sd.ordem
  FROM public.qa_processos p
  JOIN public.qa_clientes cl ON cl.id = p.cliente_id
  JOIN public.qa_servicos_documentos sd
    ON sd.servico_id = p.servico_id
   AND sd.tipo_documento = 'pergunta_residencia_5_anos'
   AND sd.ativo
 WHERE NOT public.qa_processo_relogio_parado(p.id)
   AND COALESCE(cl.status,'') <> 'excluido_lgpd'
   AND COALESCE(cl.excluido,false) = false
   -- Só onde o checklist já foi montado; processo sem checklist recebe a
   -- pergunta na explosão, junto com todo o resto.
   AND EXISTS (SELECT 1 FROM public.qa_processo_documentos x WHERE x.processo_id = p.id)
   AND NOT EXISTS (
     SELECT 1 FROM public.qa_processo_documentos x
      WHERE x.processo_id = p.id
        AND x.tipo_documento = 'pergunta_residencia_5_anos'
   );

-- Religa os gatilhos e aborta se algum ficar desligado.
DO $on$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['trg_qa_processo_doc_verde','trg_qa_admin_notif_doc_processo'] LOOP
    IF EXISTS (SELECT 1 FROM pg_trigger g
                 JOIN pg_class c ON c.oid = g.tgrelid
                WHERE c.relname = 'qa_processo_documentos' AND g.tgname = t) THEN
      EXECUTE format('ALTER TABLE public.qa_processo_documentos ENABLE TRIGGER %I', t);
    END IF;
  END LOOP;
END $on$;

DO $chk$
DECLARE v_off text;
BEGIN
  SELECT string_agg(g.tgname, ', ') INTO v_off
    FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
   WHERE c.relname = 'qa_processo_documentos'
     AND g.tgname IN ('trg_qa_processo_doc_verde','trg_qa_admin_notif_doc_processo')
     AND g.tgenabled = 'D';
  IF v_off IS NOT NULL THEN
    RAISE EXCEPTION 'ABORTADO: gatilho(s) ficaram desligados: %', v_off;
  END IF;
END $chk$;

COMMIT;

-- =============================================================================
-- CONFERÊNCIA (rodar depois, UMA DE CADA VEZ)
--
-- A) A tabela nasceu e está vazia (ninguém declarou nada ainda).
--
-- SELECT count(*) AS enderecos_anteriores_declarados
--   FROM public.qa_cliente_enderecos_anteriores;
--
-- B) A pergunta entrou no catálogo dos serviços certos. Esperado: uma linha por
--    serviço que pede certidão estadual (44, 50, 60 e, se existirem, 31 e 51).
--
-- SELECT servico_id, tipo_documento, nome_documento,
--        regra_validacao ->> 'chave'           AS chave,
--        regra_validacao ->> 'grupo_checklist' AS grupo,
--        regra_validacao ->> 'ordem_grupo_checklist' AS ordem_no_grupo
--   FROM public.qa_servicos_documentos
--  WHERE tipo_documento = 'pergunta_residencia_5_anos'
--  ORDER BY servico_id;
--
-- C) A pergunta chegou aos processos abertos.
--
-- SELECT p.servico_id, count(*) AS processos_com_a_pergunta
--   FROM public.qa_processo_documentos pd
--   JOIN public.qa_processos p ON p.id = pd.processo_id
--  WHERE pd.tipo_documento = 'pergunta_residencia_5_anos'
--  GROUP BY p.servico_id
--  ORDER BY p.servico_id;
--
-- D) O cofre passou a aceitar as famílias novas. Esperado: 223.
--
-- SELECT count(*) AS tipos_aceitos_no_cofre
--   FROM regexp_matches(
--          (SELECT pg_get_constraintdef(c.oid)
--             FROM pg_constraint c
--             JOIN pg_class t ON t.oid = c.conrelid
--            WHERE t.relname = 'qa_documentos_cliente'
--              AND c.conname = 'qa_doc_cliente_tipo_check'),
--          '''[a-z0-9_]+''', 'g');
--
-- E) O botão de sincronizar e o painel passaram a respeitar linha semeada.
--    Esperado: 2 linhas.
--
-- SELECT p.proname
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname IN ('qa_sincronizar_checklist_processos_servico',
--                      'qa_servico_divergencia_catalogo')
--    AND pg_get_functiondef(p.oid) LIKE '%qa_documento_semeado%'
--  ORDER BY p.proname;
--
-- F) O exploder passou a semear os estados anteriores. Esperado: 1 linha.
--
-- SELECT p.proname
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public'
--    AND p.proname = 'qa_explodir_checklist_processo'
--    AND pg_get_functiondef(p.oid) LIKE '%qa_seed_certidoes_estados_anteriores%';
--
-- G) Teste de mesa (opcional, num processo de teste): declare um estado
--    anterior e veja o bloco nascer separado.
--
-- INSERT INTO public.qa_cliente_enderecos_anteriores (qa_cliente_id, uf, cidade)
-- VALUES (<id_do_cliente>, 'MG', 'Belo Horizonte');
--
-- SELECT tipo_documento, nome_documento, status, uf_referencia,
--        regra_validacao ->> 'grupo_checklist' AS grupo, ordem
--   FROM public.qa_processo_documentos
--  WHERE processo_id = '<id_do_processo>'
--    AND tipo_documento LIKE 'antecedentes%'
--  ORDER BY (regra_validacao ->> 'grupo_checklist'), ordem;
-- =============================================================================
