-- ============================================================================
-- AUTORIZAÇÃO DE COMPRA — ATIRADOR ESPORTIVO (serviço 50)
-- Checklist montado a partir de TRÊS dossiês DEFERIDOS
-- ----------------------------------------------------------------------------
-- Fonte: os dossiês entregues pelo titular em 20/08/2026 — Eduardo Rizek Elias
-- (autorização 99234025002588, deferida em 16/03/2026), Rivelino Pinto Pereira
-- (99234025002548, 13/05/2026) e Édson Campos (99181025026558, 13/07/2026).
-- Os três têm a MESMA espinha, numerada de 01 a 12 pela própria equipe:
--
--   01 capacidade técnica      07 laudo psicológico
--   02 treinamentos/competições 08 residência dos últimos 5 anos
--   03 DSA                      09 ocupação lícita
--   04 antecedentes federal     10 antecedentes estadual (domicílios 5 anos)
--   05 declaração de inquérito  11 antecedentes justiça militar
--   06 documento de identidade  12 antecedentes justiça eleitoral
--
-- Mais, fora da numeração: foto 3x4, GRU, comprovante de pagamento e a
-- autorização deferida.
--
-- O QUE ESTAVA ERRADO
--   O serviço 50 tinha 12 linhas, 10 ativas, e nenhuma certidão de
--   antecedentes. Faltavam 8 dos 12 itens numerados. Os quatro processos
--   abertos carregavam 6, 7, 13 e 13 exigências — nem entre eles batia. Dossiê
--   montado por esse checklist chega incompleto ao protocolo.
--
-- O QUE ESTE BLOCO FAZ
--   1. completa o catálogo do serviço 50 com os itens dos dossiês deferidos,
--      reaproveitando o vocabulário que já existe (nenhum tipo novo, nenhuma
--      constraint alterada);
--   2. reativa as duas linhas que estavam `ativo = false` sem motivo — a
--      declaração de compromisso de habitualidade (ANEXO C) e a declaração de
--      habitualidade do clube;
--   3. dá chave e opções às perguntas novas, senão o portal desenha um upload
--      no lugar do seletor e a linha nunca fecha;
--   4. NÃO encosta em processo nenhum que já exista.
--
-- SÓ VALE DAQUI PRA FRENTE (decisão do titular, 20/08/2026)
--   Este bloco mexe APENAS no catálogo do serviço. Nenhum processo existente é
--   reexplodido — nem os abertos. Há processos já concluídos, e o titular não
--   quer nenhum deles reaberto por causa de exigência nova: processo entregue
--   é processo entregue, e cliente que já cumpriu a lista não vai ser cobrado
--   de novo por uma regra que passou a valer depois.
--
--   Quem nasce a partir de agora recebe o checklist completo. Se um dia algum
--   processo antigo precisar ser completado, é caso a caso, chamando
--   `qa_explodir_checklist_processo(<id do processo>)` para AQUELE processo —
--   nunca em lote.
--
-- O QUE NÃO ENTRA AQUI, DE PROPÓSITO
--   • Os cinco comprovantes anuais de endereço (item 08) NÃO são semeados
--     aqui: `qa_seed_endereco_5_anos` já cobre o serviço 50 e é chamada dentro
--     da explosão do checklist. Semear de novo criaria linha duplicada.
--   • Os documentos de renda do item 09 NÃO são listados um a um: entra só o
--     placeholder `renda_definir_condicao`, e a edge `qa-processo-set-condicao`
--     injeta o conjunto certo conforme a condição do cliente. É a mesma
--     engrenagem do CR e da posse. Foi por isso que um dossiê veio com holerite
--     e o outro com CTPS + extrato do INSS.
--   • O serviço 51 (caçador) NÃO é tocado. Ele tem 4 linhas e precisa do mesmo
--     tratamento, mas os três dossiês são todos de atirador — montar o do
--     caçador com base neles seria chute.
--   • Nada de bifurcação por órgão: pela IN DG/PF 311 quem gere o CAC é a
--     Polícia Federal (regra do titular, 20/08/2026). Os dois dossiês com
--     cabeçalho do Exército são legado.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

-- ── 1) A lista, na ordem do dossiê real ─────────────────────────────────────
CREATE TEMP TABLE ac_exigencias (
  tipo_documento        text,
  nome_documento        text,
  etapa                 text,
  ordem                 integer,
  obrigatorio           boolean,
  escopo                text,
  condicao_profissional text,
  condicao_modalidade   text[],
  validade_dias         integer,
  grupo_checklist       text,
  ordem_grupo           integer,
  orgao_emissor         text,
  instrucoes            text,
  observacoes_cliente   text
) ON COMMIT DROP;

INSERT INTO ac_exigencias VALUES
  -- ── item 06 do dossiê: identificação ──────────────────────────────────────
  ('rg_com_cpf', 'Documento de identidade (CIN, RG ou CNH)',
   'base', 10, true, 'permanente', NULL, NULL::text[], NULL::int,
   'identificacao', 10, 'Governo Federal, Detran ou Governo do Estado',
   'Envie o documento inteiro, frente e verso, legível, em PDF. Nos três dossiês '
   || 'deferidos foi usada a CNH digital do gov.br.',
   'Precisa aparecer o seu CPF no documento.'),
  ('foto_3x4', 'Foto 3x4 recente',
   'base', 20, true, 'permanente', NULL, NULL, NULL,
   'identificacao', 10, NULL,
   'Foto de rosto, fundo claro, sem óculos escuros e sem boné.', NULL),

  -- ── item 08: endereço. Os cinco anos vêm do semeador próprio; aqui ficam
  --    só as perguntas que definem de quem é o comprovante. ─────────────────
  ('pergunta_comprovante_em_nome', 'O comprovante de residência está no seu nome?',
   'base', 30, true, 'processo', NULL, NULL, NULL,
   'endereco', 20, NULL, NULL, NULL),
  ('comprovante_residencia', 'Comprovante de residência atual',
   'base', 40, true, 'permanente', NULL, NULL, 30,
   'endereco', 20, NULL,
   'Conta de luz, água, telefone ou internet dos últimos 30 dias.', NULL),
  ('documento_identificacao_terceiro', 'Documento de identificação do titular do comprovante',
   'complementar', 50, false, 'permanente', NULL, NULL, NULL,
   'endereco', 20, NULL,
   'Só é necessário quando o comprovante está no nome de outra pessoa.', NULL),
  ('pergunta_ainda_reside_imovel', 'Você ainda mora no endereço do comprovante?',
   'complementar', 60, true, 'processo', NULL, NULL, NULL,
   'endereco', 20, NULL, NULL, NULL),
  ('pergunta_titular_estado_civil', 'Qual o estado civil do titular do comprovante?',
   'complementar', 70, true, 'processo', NULL, NULL, NULL,
   'endereco', 20, NULL, NULL, NULL),
  ('pergunta_titular_profissao', 'Qual a profissão do titular do comprovante?',
   'complementar', 80, true, 'processo', NULL, NULL, NULL,
   'endereco', 20, NULL, NULL, NULL),
  ('declaracao_responsavel_imovel', 'Declaração do responsável pelo imóvel',
   'complementar', 90, false, 'permanente', NULL, NULL, NULL,
   'endereco', 20, NULL,
   'Só é necessária quando o comprovante está no nome de outra pessoa.',
   'A declaração precisa ser assinada no gov.br pelo dono do comprovante.'),

  -- ── item 09: ocupação lícita. O placeholder abre o leque certo conforme a
  --    condição escolhida — holerite, CTPS + INSS, CNPJ, benefício. ─────────
  ('renda_definir_condicao', 'Defina sua condição profissional',
   'complementar', 130, true, 'processo', NULL, NULL, NULL,
   'ocupacao', 30, NULL,
   'A resposta define quais comprovantes de ocupação lícita o sistema pede.', NULL),

  -- ── itens 04, 10, 11 e 12: idoneidade. Prazos conforme o que cada órgão
  --    imprime na própria certidão. ─────────────────────────────────────────
  ('antecedentes_eleitoral', 'Certidão de Antecedentes Criminais — Justiça Eleitoral',
   'base', 330, true, 'permanente', NULL, NULL, 30,
   'antecedentes', 40, 'TSE', NULL, NULL),
  ('antecedentes_militar', 'Certidão Criminal — Justiça Militar da União (STM)',
   'base', 340, true, 'permanente', NULL, NULL, 30,
   'antecedentes', 40, 'STM', NULL, NULL),
  ('antecedentes_federal_trf3_regional', 'Certidão Federal TRF3 — Abrangência Regional',
   'base', 350, true, 'permanente', NULL, NULL, 90,
   'antecedentes', 40, 'Justiça Federal', NULL, NULL),
  ('antecedentes_federal_sjsp_jef', 'Certidão Federal — Seção Judiciária de SP e JEF',
   'base', 360, true, 'permanente', NULL, NULL, 90,
   'antecedentes', 45, 'Justiça Federal', NULL, NULL),
  ('antecedentes_estadual_distribuicao', 'Certidão Estadual de Distribuições Criminais — TJSP',
   'base', 370, true, 'permanente', NULL, NULL, 30,
   'antecedentes', 40, 'TJSP',
   'Uma certidão por estado onde você morou nos últimos cinco anos.', NULL),
  ('antecedentes_estadual_execucoes', 'Certidão Estadual de Execuções Criminais — TJSP',
   'base', 380, true, 'permanente', NULL, NULL, 30,
   'antecedentes', 40, 'TJSP', NULL, NULL),
  ('antecedentes_criminais', 'Atestado de Antecedentes Criminais — Polícia Civil (SSP)',
   'base', 390, true, 'permanente', NULL, NULL, 30,
   'antecedentes', 40, 'Polícia Civil', NULL, NULL),
  -- Condicional: só entra quando a certidão estadual volta com apontamento de
  -- homônimo. Foi o caso do Édson Campos. Fica não-obrigatória para não travar
  -- a fila de quem não precisa.
  ('declaracao_homonimia', 'Declaração de Homonímia',
   'complementar', 395, false, 'permanente', NULL, NULL, NULL,
   'antecedentes', 40, NULL,
   'Só é necessária quando a certidão estadual aponta processo de pessoa com nome '
   || 'igual ao seu. A equipe avisa se for o caso.',
   'A declaração é assinada no gov.br.'),

  -- ── item 05: a pergunta e a declaração que ela destrava ──────────────────
  ('pergunta_responde_inquerito_criminal', 'Você responde a algum inquérito ou processo criminal?',
   'complementar', 405, true, 'processo', NULL, NULL, NULL,
   'antecedentes', 40, NULL, NULL, NULL),
  ('declaracao_sem_inquerito_processo_criminal',
   'Declaração de não responder a inquérito ou processo criminal',
   'complementar', 410, true, 'permanente', NULL, NULL, NULL,
   'antecedentes', 40, NULL, NULL,
   'A declaração é assinada no gov.br.'),

  -- ── item 02: habitualidade ───────────────────────────────────────────────
  ('comprovante_filiacao_entidade_tiro',
   'Comprovante de filiação ativa a entidade de tiro',
   'complementar', 420, true, 'permanente', NULL,
   ARRAY['atirador','cacador'], 365,
   'habitualidade', 50, NULL,
   'Peça à entidade a declaração de filiação com data e o número de registro dela.',
   'A filiação precisa estar em dia — anuidade vencida derruba o pedido.'),
  ('comprovante_competicao',
   'Comprovante de participação em treinamentos e competições de tiro',
   'complementar', 422, true, 'permanente', NULL,
   ARRAY['atirador'], NULL,
   'habitualidade', 50, NULL,
   'Os registros de treino e competição emitidos pelo seu clube.', NULL),
  ('declaracao_compromisso_habitualidade',
   'Declaração de compromisso de habitualidade (ANEXO C)',
   'complementar', 425, true, 'permanente', NULL,
   ARRAY['atirador'], NULL,
   'habitualidade', 50, NULL,
   'Você se compromete a comprovar, a cada doze meses, no mínimo oito treinos ou '
   || 'competições em eventos distintos, por espécie de arma do seu acervo '
   || '(IN DG/PF 311).',
   'A declaração é assinada no gov.br.'),

  -- ── item 03: segurança do acervo ─────────────────────────────────────────
  ('dsa_declaracao_seguranca_acervo', 'DSA — Declaração de Segurança do Acervo',
   'complementar', 440, true, 'permanente', NULL, NULL, NULL,
   'arma', 55, NULL,
   'Você declara que a guarda tem cofre ou lugar seguro com tranca, que as armas ficam '
   || 'desmuniciadas e que ninguém menor de dezoito anos ou civilmente incapaz alcança o acervo.',
   'A declaração é assinada no gov.br.'),

  -- ── itens 07 e 01: laudos ────────────────────────────────────────────────
  ('laudo_psicologico', 'Laudo psicológico (psicólogo credenciado pela PF)',
   'tecnico', 470, true, 'permanente', NULL, NULL, 365,
   'laudos', 60, NULL,
   'O psicólogo precisa ser credenciado pela Polícia Federal.',
   'O laudo vale no máximo um ano contado da emissão.'),
  ('laudo_capacidade_tecnica', 'Comprovante de capacidade técnica (instrutor credenciado pela PF)',
   'tecnico', 480, true, 'permanente', NULL, NULL, 365,
   'laudos', 60, NULL,
   'O instrutor de armamento precisa ser credenciado pela Polícia Federal. O comprovante '
   || 'traz a finalidade "Aquisição, Registro ou Transferência" e a categoria CAC.', NULL),

  -- ── fecho: taxa e a autorização que sai ──────────────────────────────────
  -- A GRU só nasce DEPOIS do pedido aberto: o número de referência da guia é o
  -- próprio número da autorização. Confirmado no código de barras dos três
  -- dossiês deferidos.
  ('gru', 'Boleto da GRU — taxa de autorização de aquisição (R$ 25,00)',
   'final', 500, true, 'processo', NULL, NULL, NULL,
   'requerimento', 70, 'Polícia Federal',
   'A guia só é gerada depois que a equipe abre o pedido — o número de referência dela '
   || 'é o próprio número da sua autorização.',
   'Envie a página do boleto.'),
  ('gru_comprovante', 'Comprovante de pagamento da taxa (GRU)',
   'final', 501, true, 'processo', NULL, NULL, NULL,
   'requerimento', 71, 'Polícia Federal', NULL,
   'Sem a taxa paga o pedido não anda.'),
  ('credencial_gov_br', 'Acesso ao gov.br para protocolar',
   'final', 502, true, 'processo', NULL, NULL, NULL,
   'requerimento', 72, NULL,
   'A equipe precisa do seu acesso para protocolar o pedido no sistema da Polícia Federal.',
   'Nunca mande a senha por e-mail, WhatsApp ou dentro de uma pasta de documentos — '
   || 'use o campo próprio do sistema, que guarda cifrado.'),
  ('autorizacao_compra', 'Autorização de compra deferida',
   'final', 510, false, 'arma', NULL, NULL, 180,
   'requerimento', 75, 'Polícia Federal',
   'É o documento que a equipe entrega ao final. Vale 180 dias contados da emissão — '
   || 'é dentro desse prazo que a compra e o registro precisam acontecer.',
   'Guarde: a loja vai pedir este documento na hora da venda.');

-- ── 2) O que JÁ EXISTE no serviço 50 é atualizado no lugar ──────────────────
-- Inclusive `ativo = true`: é isto que reacende a declaração de compromisso de
-- habitualidade, que estava apagada sem motivo registrado.
UPDATE public.qa_servicos_documentos sd
   SET nome_documento      = e.nome_documento,
       etapa               = e.etapa,
       ordem               = e.ordem,
       obrigatorio         = e.obrigatorio,
       ativo               = true,
       escopo              = e.escopo,
       condicao_modalidade = e.condicao_modalidade,
       validade_dias       = e.validade_dias,
       orgao_emissor       = COALESCE(e.orgao_emissor, sd.orgao_emissor),
       instrucoes          = COALESCE(e.instrucoes, sd.instrucoes),
       observacoes_cliente = COALESCE(e.observacoes_cliente, sd.observacoes_cliente),
       regra_validacao     = COALESCE(sd.regra_validacao, '{}'::jsonb)
                             || jsonb_build_object('grupo_checklist', e.grupo_checklist,
                                                   'ordem_grupo_checklist', e.ordem_grupo),
       updated_at          = now()
  FROM ac_exigencias e
 WHERE sd.servico_id = 50
   AND sd.tipo_documento = e.tipo_documento
   AND sd.condicao_profissional IS NOT DISTINCT FROM e.condicao_profissional;

-- ── 3) O que FALTA entra como linha nova ────────────────────────────────────
INSERT INTO public.qa_servicos_documentos (
  servico_id, tipo_documento, nome_documento, etapa, ordem, obrigatorio,
  obrigatorio_etapa02, ativo, emissor, escopo, formato_aceito,
  condicao_profissional, condicao_modalidade, validade_dias, orgao_emissor,
  instrucoes, observacoes_cliente, regra_validacao
)
SELECT 50, e.tipo_documento, e.nome_documento, e.etapa, e.ordem, e.obrigatorio,
       false, true, 'cliente', e.escopo,
       CASE WHEN e.tipo_documento LIKE 'pergunta\_%' ESCAPE '\'
                 OR e.tipo_documento IN ('renda_definir_condicao')
            THEN ARRAY[]::text[]
            ELSE ARRAY['pdf','jpg','jpeg','png'] END,
       e.condicao_profissional, e.condicao_modalidade, e.validade_dias, e.orgao_emissor,
       e.instrucoes, e.observacoes_cliente,
       jsonb_build_object('grupo_checklist', e.grupo_checklist,
                          'ordem_grupo_checklist', e.ordem_grupo)
  FROM ac_exigencias e
 WHERE NOT EXISTS (
   SELECT 1 FROM public.qa_servicos_documentos sd
    WHERE sd.servico_id = 50
      AND sd.tipo_documento = e.tipo_documento
      AND sd.condicao_profissional IS NOT DISTINCT FROM e.condicao_profissional
 );

-- ── 4) Perguntas precisam de chave e opções ─────────────────────────────────
-- Sem `chave`/`opcoes` o portal desenha um upload no lugar do seletor, e o
-- gatilho que vigia pergunta sem resposta nunca deixa a linha ser cumprida.
UPDATE public.qa_servicos_documentos
   SET regra_validacao = COALESCE(regra_validacao, '{}'::jsonb) || jsonb_build_object(
         'tipo',  'pergunta',
         'chave', 'responde_inquerito_criminal',
         'opcoes', jsonb_build_array(
           jsonb_build_object('valor','nao','label','NÃO RESPONDO A NENHUM'),
           jsonb_build_object('valor','sim','label','SIM, RESPONDO'))),
       updated_at = now()
 WHERE servico_id = 50 AND tipo_documento = 'pergunta_responde_inquerito_criminal';

-- A declaração do item 05 só é cobrada de quem respondeu "não".
UPDATE public.qa_servicos_documentos
   SET regra_validacao = COALESCE(regra_validacao, '{}'::jsonb) || jsonb_build_object(
         'assinatura_requerida','govbr',
         'label_botao','ENVIAR DECLARAÇÃO ASSINADA',
         'template_key','declaracao_sem_inquerito_processo_criminal_v2',
         'exige_quando', jsonb_build_object('responde_inquerito_criminal','nao')),
       updated_at = now()
 WHERE servico_id = 50 AND tipo_documento = 'declaracao_sem_inquerito_processo_criminal';

-- O ANEXO C aponta para o modelo v2 — o de maio traz o texto antigo
-- "por calibre", que a IN DG/PF 311 substituiu por espécie de arma.
UPDATE public.qa_servicos_documentos
   SET regra_validacao = COALESCE(regra_validacao, '{}'::jsonb) || jsonb_build_object(
         'assinatura_requerida','govbr',
         'label_botao','ENVIAR DECLARAÇÃO ASSINADA',
         'template_key','declaracao_compromisso_habitualidade_v2'),
       updated_at = now()
 WHERE servico_id = 50 AND tipo_documento = 'declaracao_compromisso_habitualidade';

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- 1) O checklist do serviço 50, na ordem do dossiê (esperado: 28 linhas ativas):
--
-- SELECT ordem, etapa, tipo_documento, nome_documento, obrigatorio,
--        validade_dias, regra_validacao ->> 'grupo_checklist' AS grupo
--   FROM public.qa_servicos_documentos
--  WHERE servico_id = 50 AND ativo
--  ORDER BY ordem;
--
-- 2) Nenhuma linha do serviço 50 pode ter sobrado inativa:
--
-- SELECT tipo_documento, nome_documento FROM public.qa_servicos_documentos
--  WHERE servico_id = 50 AND NOT ativo;
--
-- 3) Os processos que já existiam NÃO podem ter mudado. Os números tinham de
--    continuar 6, 7, 13 e 13 — se subiram, alguma coisa reexplodiu:
--
-- SELECT pd.processo_id, cl.nome_completo, p.status, count(*) AS exigencias,
--        count(*) FILTER (WHERE pd.status = 'pendente') AS pendentes
--   FROM public.qa_processo_documentos pd
--   JOIN public.qa_processos p ON p.id = pd.processo_id
--   JOIN public.qa_clientes cl ON cl.id = p.cliente_id
--  WHERE p.servico_id = 50
--  GROUP BY pd.processo_id, cl.nome_completo, p.status
--  ORDER BY exigencias;
--
-- 4) As perguntas ficaram com chave e opções (esperado: 6 linhas, todas com
--    chave preenchida):
--
-- SELECT tipo_documento,
--        regra_validacao ->> 'chave'  AS chave,
--        regra_validacao -> 'opcoes'  AS opcoes
--   FROM public.qa_servicos_documentos
--  WHERE servico_id = 50 AND tipo_documento LIKE 'pergunta\_%' ESCAPE '\'
--  ORDER BY ordem;
