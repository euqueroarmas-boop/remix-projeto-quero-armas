-- Fecha a ligação entre o catálogo do Hub (o que aparece no seletor "Alterar
-- tipo") e as exigências dos processos.
--
-- Duas classes de problema corrigidas aqui:
--
-- 1) TIPOS OFERECIDOS MAS REJEITADOS PELO BANCO
--    declaracao_guarda_acervo_2enderecos, declaracao_homonimia e renda_ccmei
--    estão no catálogo — logo aparecem no seletor — mas nunca entraram no
--    CHECK de qa_documentos_cliente. Escolher qualquer um deles fazia o save
--    falhar por violação de constraint.
--
-- 2) EXIGÊNCIAS SEM PONTE PARA O HUB
--    O catálogo de serviços nomeia as exigências de um jeito e o Hub de outro.
--    Sem apelido, nem a trigger nem qa_processo_rever_exigencias casam
--    documento com exigência — o cliente entrega e o checklist pede de novo.
--    Os apelidos abaixo são correspondência literal: o mesmo documento com o
--    nome que o catálogo de serviços usa.

BEGIN;

-- ─── 1) Tipos faltando no CHECK ──────────────────────────────────────────
ALTER TABLE public.qa_documentos_cliente
  DROP CONSTRAINT IF EXISTS qa_doc_cliente_tipo_check;

ALTER TABLE public.qa_documentos_cliente
  ADD CONSTRAINT qa_doc_cliente_tipo_check CHECK (tipo_documento = ANY (ARRAY[
    'cr','craf','sinarm','gt','gte','autorizacao_compra','nota_fiscal_arma',
    'rg_com_cpf','cin','cnh','cpf',
    'comprovante_residencia','declaracao_responsavel_imovel',
    'ctps','renda_holerite_mes_atual','renda_holerite_funcionario_publico',
    'renda_cartao_cnpj','renda_cnpj_autonomo','renda_contrato_social',
    'renda_nf_recente','renda_comprovante_beneficio','renda_extrato_inss',
    'renda_qsa','renda_ccmei','renda_carteira_funcional',
    'antecedentes_criminais','antecedentes_federal',
    'antecedentes_federal_trf3_regional','antecedentes_federal_sjsp_jef',
    'antecedentes_estadual','antecedentes_estadual_distribuicao',
    'antecedentes_estadual_execucoes','antecedentes_militar','antecedentes_eleitoral',
    'declaracao_sem_inquerito_processo_criminal','declaracao_guarda_responsavel',
    'declaracao_correlata','declaracao_guarda_acervo_1endereco',
    'declaracao_guarda_acervo_2enderecos','declaracao_homonimia',
    'declaracao_endereco_acervo','dsa_declaracao_seguranca_acervo',
    'laudo_psicologico','laudo_capacidade_tecnica',
    'comprovante_efetiva_necessidade','documento_complementar_caso',
    'comprovante_habitualidade','declaracao_compromisso_habitualidade',
    'comprovante_clube_tiro','comprovante_competicao',
    'comprovante_pagamento',
    'protocolo_processo','oficio','despacho','exigencia','indeferimento',
    'procuracao','procuracao_assinada','contrato_assinado',
    'recurso_administrativo_doc','mandado_seguranca_doc',
    'certidao_alteracao_nome',
    'outro'
  ]::text[]));

-- ─── 2) Apelidos das exigências restantes ────────────────────────────────
-- Correspondência literal com os nomes do catálogo do Hub:
--   "Certidão Criminal Militar"                              -> antecedentes_militar
--   "Certidão de Antecedentes Criminais — Polícia Civil/SP"  -> antecedentes_criminais
--   "Certidão Estadual TJSP — Distribuição de Ações Criminais"
--   "Certidão Estadual TJSP — Execuções Criminais"
-- (TJSP é o segundo grau, por isso os slots "segundo_grau_*" apontam para ele.)
INSERT INTO public.qa_tipo_documento_aliases (processo_tipo, hub_tipo) VALUES
  ('certidao_estadual_justica_militar',                'antecedentes_militar'),
  ('certidao_estadual_policia_civil',                  'antecedentes_criminais'),
  ('certidao_estadual_segundo_grau_acoes_criminais',   'antecedentes_estadual_distribuicao'),
  ('certidao_estadual_segundo_grau_execucoes_criminais','antecedentes_estadual_execucoes')
ON CONFLICT DO NOTHING;

-- Carteira funcional (exigência de servidor público dentro da ocupação lícita)
-- e as TRÊS declarações de acervo — guarda, endereço e segurança (DSA) — são
-- documentos distintos, cada um com sua finalidade. Ganharam tipo próprio no
-- catálogo, com o mesmo slug que o processo já usa: casam por identidade,
-- sem precisar de apelido.

-- Reavalia todas as exigências pendentes com o catálogo e os apelidos completos.
SELECT public.qa_processo_rever_exigencias(NULL);

COMMIT;
