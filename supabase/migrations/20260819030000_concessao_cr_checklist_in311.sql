-- ============================================================================
-- CONCESSÃO DE CR (serviço 44) — checklist conforme IN DG/PF nº 311/2025
-- ----------------------------------------------------------------------------
-- FONTE DA EXIGÊNCIA: IN 311/2025, art. 18, § 2º (texto integral já carregado
-- em qa_fontes_normativas). A norma lista, para a CONCESSÃO do CR:
--
--   I  - colecionador, alíneas "a" a "i":
--        a) documento de identificação pessoal
--        b) certidões criminais das Justiças Federal, Estadual/Distrital,
--           Militar e Eleitoral dos domicílios dos últimos cinco anos
--        c) comprovante de ocupação lícita
--        d) comprovantes de residência dos últimos cinco anos
--        e) comprovante de segundo endereço de guarda do acervo, se for o caso
--        f) DSA — Declaração de Segurança do Acervo
--        g) laudo de aptidão psicológica (psicólogo credenciado pela PF)
--        h) comprovante de capacidade técnica (instrutor credenciado pela PF)
--        i) pagamento da taxa
--   II - atirador desportivo maior de 18: "a" a "i" + comprovante de filiação
--        à entidade de tiro + declaração de compromisso de habitualidade
--        (8 treinos/competições por tipo de arma a cada 12 meses)
--   IV - caçador excepcional: "a" a "i" + comprovante de filiação à entidade
--        de caça + documento do Ibama comprovando a necessidade de abate
--
--   § 4º: o laudo psicológico vale, no máximo, um ano.
--   § 1º do art. 18: o requerimento é feito pelo Sinarm-CAC.
--   Art. 17: o CR vale três anos.
--
-- O QUE ESTE BLOCO FAZ
--   1. cadastra os dois tipos novos que o CR exige (requerimento do Sinarm-CAC
--      e a pergunta da modalidade);
--   2. completa o checklist do serviço 44, que hoje está pela metade — não tem
--      ocupação lícita, filiação, DSA, DEGA, requerimento nem taxa;
--   3. corrige a validade do CR, hoje gravada como 12 meses com base em decreto
--      revogado, para os 3 anos do art. 17.
--
-- O QUE ELE NÃO FAZ
--   Não apaga nada. Linha que já existe é ATUALIZADA (o `regra_validacao` é
--   mesclado, nunca sobrescrito — senão a pergunta híbrida do laudo psicológico
--   se perderia). Reexecutável: rodar duas vezes dá o mesmo resultado.
--
-- Os comprovantes de residência dos 5 anos (alínea "d") NÃO entram aqui de
-- propósito: `qa_seed_endereco_5_anos` já semeia `comprovante_endereco_ano_AAAA`
-- para o serviço 44 quando o processo nasce. Repetir criaria exigência dobrada.
-- ============================================================================

BEGIN;

-- ── 1) Tipos novos no catálogo do Hub ───────────────────────────────────────
-- O requerimento do CR é peça própria: o do serviço de posse tem regime
-- `defesa_pessoal` e não serve para CAC.
INSERT INTO public.qa_tipos_documento_catalogo (
  tipo_documento, categoria_hub, subcategoria_hub, escopo_documental,
  label_publico, descricao_upload, aceita_ia, aceita_vinculo_arma,
  exige_validade, reaproveitavel_global, revisao_humana_obrigatoria,
  regime, ativo, ordem, fonte_normativa
) VALUES
  ('requerimento_cr', 'documentos_processo', NULL, 'processo',
   'Requerimento de CR (Sinarm-CAC)',
   'Requerimento gerado no Sinarm-CAC da Polícia Federal.',
   true, false, false, false, false, 'cac', true, 909,
   ARRAY['IN DG/PF 311/2025, art. 18, § 1º']),
  ('pergunta_modalidade_cac', 'outros', 'outros', 'pergunta',
   'Qual atividade você vai registrar no CR?',
   NULL, false, false, false, false, false, 'cac', true, 900,
   ARRAY['IN DG/PF 311/2025, arts. 4º, 10 e 14'])
ON CONFLICT (tipo_documento) DO UPDATE
  SET categoria_hub  = EXCLUDED.categoria_hub,
      label_publico  = EXCLUDED.label_publico,
      regime         = EXCLUDED.regime,
      fonte_normativa= EXCLUDED.fonte_normativa,
      ativo          = true,
      updated_at     = now();

-- ── 2) Checklist do serviço 44 ──────────────────────────────────────────────
-- Uma linha por exigência. O `regra_validacao` carrega o grupo do checklist
-- guiado (o mesmo vocabulário de `pendenciasGrupos.ts`) e é MESCLADO com o que
-- já estiver gravado.
WITH exigencias(
  tipo_documento, nome_documento, etapa, ordem, obrigatorio, escopo,
  condicao_profissional, condicao_modalidade, validade_dias,
  grupo_checklist, ordem_grupo, orgao_emissor, instrucoes, observacoes_cliente
) AS (
  VALUES
  -- Modalidade: primeira pergunta do processo. Sem ela o checklist não sabe se
  -- pede filiação a clube (atirador/caçador) ou nada (colecionador).
  ('pergunta_modalidade_cac',
   'Qual atividade você vai registrar no seu CR?',
   'base', 5, true, 'processo', NULL, NULL::text[], NULL::int,
   'perguntas', 5, NULL,
   'Colecionador guarda armas como acervo histórico. Atirador desportivo treina '
   || 'e compete em clube de tiro. Caçador excepcional atua no controle de fauna '
   || 'invasora autorizado pelo Ibama. A escolha muda os documentos que pedimos.',
   'Escolha a atividade. Se quiser mais de uma, fale com a equipe — cada uma tem exigência própria.'),

  -- Alínea "a": identificação pessoal.
  ('rg_com_cpf', 'Documento de identidade (CIN, RG ou CNH)',
   'base', 10, true, 'permanente', NULL, NULL, NULL,
   'identificacao', 10, 'Governo Federal, Detran ou Governo do Estado',
   'Envie o documento inteiro, frente e verso, legível, em PDF.',
   'Precisa aparecer o seu CPF no documento.'),

  -- Alínea "d": endereço. Os cinco anos vêm do semeador próprio; aqui ficam só
  -- as perguntas que definem de quem é o comprovante.
  ('pergunta_comprovante_em_nome', 'O comprovante de residência está no seu nome?',
   'base', 30, true, 'processo', NULL, NULL, NULL,
   'endereco', 20, NULL, NULL, NULL),
  ('declaracao_responsavel_imovel', 'Declaração do responsável pelo imóvel',
   'complementar', 90, false, 'permanente', NULL, NULL, NULL,
   'endereco', 20, NULL,
   'Só é necessária quando o comprovante está no nome de outra pessoa.',
   'A declaração precisa ser assinada no gov.br pelo dono do comprovante.'),
  ('pergunta_titular_estado_civil', 'Qual o estado civil do titular do comprovante?',
   'complementar', 100, true, 'processo', NULL, NULL, NULL,
   'endereco', 20, NULL, NULL, NULL),
  ('pergunta_titular_profissao', 'Qual a profissão do titular do comprovante?',
   'complementar', 110, true, 'processo', NULL, NULL, NULL,
   'endereco', 20, NULL, NULL, NULL),
  ('pergunta_ainda_reside_imovel', 'Você ainda mora no endereço do comprovante?',
   'complementar', 120, true, 'processo', NULL, NULL, NULL,
   'endereco', 20, NULL, NULL, NULL),

  -- Alínea "c": ocupação lícita. O placeholder abre o leque certo de documentos
  -- conforme a condição escolhida, igual ao serviço de posse.
  ('renda_definir_condicao', 'Defina sua condição profissional',
   'complementar', 130, true, 'processo', NULL, NULL, NULL,
   'ocupacao', 30, NULL,
   'Escolha como você comprova renda hoje. A lista de documentos muda conforme a escolha.',
   NULL),
  ('renda_carteira_funcional', 'Identidade Funcional Digital',
   'complementar', 140, true, 'permanente', 'funcionario_publico', NULL, NULL,
   'ocupacao', 30, NULL, NULL, NULL),
  ('renda_carteira_funcional', 'Identidade Funcional Digital',
   'complementar', 141, true, 'permanente', 'seguranca_publica', NULL, NULL,
   'ocupacao', 30, NULL, NULL, NULL),
  ('renda_contra_cheque_mes_atual', 'Contra-cheque do mês atual (servidor público)',
   'complementar', 150, true, 'permanente', 'funcionario_publico', NULL, 30,
   'ocupacao', 30, NULL, NULL, NULL),
  ('renda_contra_cheque_mes_atual', 'Contra-cheque do mês atual (servidor público)',
   'complementar', 151, true, 'permanente', 'seguranca_publica', NULL, 30,
   'ocupacao', 30, NULL, NULL, NULL),
  ('ctps', 'Carteira de Trabalho Digital',
   'complementar', 160, true, 'permanente', 'clt', NULL, NULL,
   'ocupacao', 30, NULL, NULL, NULL),
  ('renda_holerite_mes_atual', 'Holerite mais recente (mês atual)',
   'complementar', 170, true, 'permanente', 'clt', NULL, 30,
   'ocupacao', 30, NULL, NULL, NULL),
  ('renda_extrato_inss', 'Extrato completo de contribuições do INSS (CNIS)',
   'complementar', 171, true, 'permanente', 'clt', NULL, 30,
   'ocupacao', 30, 'INSS', NULL, NULL),
  ('renda_contrato_social', 'Contrato Social, Requerimento de Empresário ou Ficha Cadastral',
   'complementar', 180, true, 'permanente', 'empresario', NULL, NULL,
   'ocupacao', 30, NULL, NULL, NULL),
  ('renda_ccmei', 'CCMEI — Certificado da Condição de Microempreendedor Individual',
   'complementar', 190, true, 'permanente', 'autonomo', NULL, NULL,
   'ocupacao', 30, NULL, NULL, NULL),
  ('renda_cartao_cnpj', 'Cartão CNPJ (emitido nos últimos 30 dias)',
   'complementar', 200, true, 'permanente', 'autonomo,empresario', NULL, 30,
   'ocupacao', 30, NULL, NULL, NULL),
  ('renda_qsa', 'QSA — Quadro de Sócios e Administradores',
   'complementar', 210, true, 'permanente', 'autonomo,empresario', NULL, 30,
   'ocupacao', 30, NULL, NULL, NULL),
  ('renda_nf_empresa', 'Nota Fiscal da Empresa',
   'complementar', 220, true, 'permanente', 'autonomo,empresario', NULL, NULL,
   'ocupacao', 30, NULL, NULL, NULL),
  ('renda_comprovante_beneficio', 'Comprovante de pagamento do benefício (último mês)',
   'complementar', 230, true, 'permanente', 'aposentado', NULL, 30,
   'ocupacao', 30, 'INSS', NULL, NULL),

  -- Alínea "b": idoneidade nas quatro justiças. Federal em duas abrangências,
  -- militar da União (STM) e militar estadual (TJM) separadas.
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
   'antecedentes', 40, 'TJSP', NULL, NULL),
  ('antecedentes_estadual_execucoes', 'Certidão Estadual de Execuções Criminais — TJSP',
   'base', 380, true, 'permanente', NULL, NULL, 30,
   'antecedentes', 40, 'TJSP', NULL, NULL),
  ('antecedentes_criminais', 'Antecedentes Criminais — Polícia Civil (SSP)',
   'base', 390, true, 'permanente', NULL, NULL, 30,
   'antecedentes', 40, 'Polícia Civil', NULL, NULL),
  ('antecedentes_militar_estadual', 'Certidão Criminal — Tribunal de Justiça Militar (TJM)',
   'base', 400, true, 'permanente', NULL, NULL, 90,
   'antecedentes', 40, 'TJM', NULL, NULL),
  ('pergunta_responde_inquerito_criminal', 'Você responde a algum inquérito ou processo criminal?',
   'complementar', 405, true, 'processo', NULL, NULL, NULL,
   'antecedentes', 40, NULL, NULL, NULL),
  ('declaracao_sem_inquerito_processo_criminal',
   'Declaração de não responder a inquérito ou processo criminal',
   'complementar', 410, true, 'permanente', NULL, NULL, NULL,
   'antecedentes', 40, NULL, NULL,
   'A declaração é assinada no gov.br.'),

  -- Inciso II "b" e inciso IV "b": filiação. Colecionador não se filia a nada,
  -- por isso a linha só vale para atirador e caçador.
  ('comprovante_filiacao_entidade_tiro',
   'Comprovante de filiação à entidade de tiro ou de caça',
   'complementar', 420, true, 'permanente', NULL,
   ARRAY['atirador','cacador'], 365,
   'habitualidade', 50, NULL,
   'Peça à entidade a declaração de filiação com data e número de registro dela no Exército.',
   'A filiação precisa estar em dia — anuidade vencida derruba o pedido.'),
  -- Inciso II "c": compromisso de habitualidade (8 eventos por tipo de arma
  -- a cada 12 meses). É do atirador desportivo.
  ('declaracao_compromisso_habitualidade',
   'Declaração de compromisso de habitualidade (8 treinos ou competições por ano)',
   'complementar', 425, true, 'permanente', NULL,
   ARRAY['atirador'], NULL,
   'habitualidade', 50, NULL,
   'Você se compromete a comprovar, a cada doze meses, no mínimo oito treinos ou '
   || 'competições em eventos distintos, por arma representativa de cada tipo do seu acervo.',
   'A declaração é assinada no gov.br.'),
  -- Inciso IV "c": documento do Ibama, exclusivo do caçador excepcional.
  ('habilitacao_cacador_ibama',
   'Documento do Ibama comprovando a necessidade de abate de fauna invasora',
   'complementar', 430, true, 'permanente', NULL,
   ARRAY['cacador'], 365,
   'habitualidade', 50, 'IBAMA',
   'Emitido pelo Ibama, deve indicar a espécie e a autorização de controle de fauna.',
   NULL),

  -- Alíneas "f" e "e": segurança e endereço de guarda do acervo.
  ('dsa_declaracao_seguranca_acervo', 'DSA — Declaração de Segurança do Acervo',
   'complementar', 440, true, 'processo', NULL, NULL, NULL,
   'arma', 55, NULL,
   'Você declara que a guarda tem cofre ou lugar seguro com tranca, que as armas ficam '
   || 'desmuniciadas e que ninguém menor de dezoito anos ou civilmente incapaz alcança o acervo.',
   'A declaração é assinada no gov.br.'),
  -- A pergunta do segundo endereço fica com os endereços, onde o cliente já
  -- está pensando em onde mora e onde guarda. A DEGA que ela destrava fica com
  -- o acervo. Os dois grupos estão liberados para o CR, nada some da fila.
  ('pergunta_segundo_endereco_acervo', 'Você vai guardar parte do acervo em um segundo endereço?',
   'complementar', 445, true, 'processo', NULL, NULL, NULL,
   'endereco', 25, NULL,
   'O segundo endereço de guarda é opcional e só existe se você quiser.', NULL),
  ('declaracao_endereco_acervo', 'DEGA — Declaração de Endereço de Guarda do Acervo',
   'complementar', 450, false, 'permanente', NULL, NULL, NULL,
   'arma', 55, NULL,
   'Só é necessária quando existe segundo endereço de guarda.', NULL),

  -- Alíneas "g" e "h": laudos. Quem é da segurança pública usa os da própria
  -- instituição (Portaria Conjunta 1/2024) — mesma engrenagem dos outros serviços.
  ('exames_instituicao_definir',
   'Você trabalha na Segurança Pública: vai usar os exames da sua instituição?',
   'tecnico', 460, true, 'processo', 'seguranca_publica', NULL, NULL,
   'laudos', 60, NULL, NULL, NULL),
  ('atestado_aptidao_psicologica_instituicao', 'Atestado de Aptidão Psicológica da Instituição',
   'tecnico', 461, true, 'processo', 'seguranca_publica', NULL, 365,
   'laudos', 60, NULL, NULL, NULL),
  ('atestado_capacidade_tecnica_instituicao', 'Atestado de Capacidade Técnica / Tiro da Instituição',
   'tecnico', 462, true, 'processo', 'seguranca_publica', NULL, 365,
   'laudos', 60, NULL, NULL, NULL),
  ('laudo_psicologico', 'Laudo psicológico (psicólogo credenciado pela PF)',
   'tecnico', 470, true, 'permanente', NULL, NULL, 365,
   'laudos', 60, NULL,
   'O psicólogo precisa ser credenciado pela Polícia Federal.',
   'O laudo vale no máximo um ano contado da emissão.'),
  ('laudo_capacidade_tecnica', 'Comprovante de capacidade técnica (instrutor credenciado pela PF)',
   'tecnico', 480, true, 'permanente', NULL, NULL, 365,
   'laudos', 60, NULL,
   'O instrutor de armamento precisa ser credenciado pela Polícia Federal.', NULL),

  -- Requerimento no Sinarm-CAC e a taxa (alínea "i"), na mesma ordem do dossiê.
  ('requerimento_cr', 'Requerimento de CR no Sinarm-CAC',
   'final', 500, true, 'processo', NULL, NULL, 15,
   'requerimento', 70, 'Polícia Federal',
   'O requerimento é feito no Sinarm-CAC da Polícia Federal. Nossa equipe monta com você e '
   || 'confere antes de qualquer pagamento.',
   'Só pague a taxa depois que a equipe liberar o requerimento — taxa paga em requerimento errado não volta.'),
  ('gru', 'Boleto da GRU — taxa do CR (Polícia Federal)',
   'final', 501, true, 'processo', NULL, NULL, NULL,
   'requerimento', 71, 'Polícia Federal',
   'O boleto sai no mesmo site do requerimento, no botão "Boleto" ou "Pagar GRU com PagTesouro".',
   'Envie a página do boleto.'),
  ('gru_comprovante', 'Comprovante de pagamento da taxa (GRU)',
   'final', 502, true, 'processo', NULL, NULL, NULL,
   'requerimento', 72, 'Polícia Federal', NULL,
   'Sem a taxa paga o processo não é protocolado.'),
  ('credencial_gov_br', 'Acesso ao gov.br para protocolar',
   'final', 503, true, 'processo', NULL, NULL, NULL,
   'requerimento', 73, NULL, NULL, NULL),
  ('juntada_assinada', 'Juntada final assinada no gov.br',
   'final', 504, true, 'processo', NULL, NULL, NULL,
   'requerimento', 74, NULL, NULL, NULL)
)
INSERT INTO public.qa_servicos_documentos (
  servico_id, tipo_documento, nome_documento, etapa, ordem, obrigatorio,
  obrigatorio_etapa02, ativo, emissor, escopo, formato_aceito,
  condicao_profissional, condicao_modalidade, validade_dias, orgao_emissor,
  instrucoes, observacoes_cliente, regra_validacao
)
SELECT 44, e.tipo_documento, e.nome_documento, e.etapa, e.ordem, e.obrigatorio,
       false, true, 'cliente', e.escopo,
       CASE WHEN e.tipo_documento LIKE 'pergunta\_%' ESCAPE '\'
                 OR e.tipo_documento IN ('renda_definir_condicao','exames_instituicao_definir')
            THEN ARRAY[]::text[]
            ELSE ARRAY['pdf','jpg','jpeg','png'] END,
       e.condicao_profissional, e.condicao_modalidade, e.validade_dias, e.orgao_emissor,
       e.instrucoes, e.observacoes_cliente,
       jsonb_build_object('grupo_checklist', e.grupo_checklist,
                          'ordem_grupo_checklist', e.ordem_grupo)
  FROM exigencias e
ON CONFLICT (servico_id, tipo_documento, condicao_profissional) DO UPDATE
  SET nome_documento      = EXCLUDED.nome_documento,
      etapa               = EXCLUDED.etapa,
      ordem               = EXCLUDED.ordem,
      obrigatorio         = EXCLUDED.obrigatorio,
      ativo               = true,
      escopo              = EXCLUDED.escopo,
      condicao_modalidade = EXCLUDED.condicao_modalidade,
      validade_dias       = EXCLUDED.validade_dias,
      orgao_emissor       = COALESCE(EXCLUDED.orgao_emissor, public.qa_servicos_documentos.orgao_emissor),
      instrucoes          = COALESCE(EXCLUDED.instrucoes, public.qa_servicos_documentos.instrucoes),
      observacoes_cliente = COALESCE(EXCLUDED.observacoes_cliente, public.qa_servicos_documentos.observacoes_cliente),
      -- Mescla: o que já estava gravado manda, o grupo entra por cima. Assim a
      -- pergunta híbrida do laudo psicológico (chave/opções/dispensa_quando)
      -- sobrevive à reaplicação deste bloco.
      regra_validacao     = COALESCE(public.qa_servicos_documentos.regra_validacao, '{}'::jsonb)
                            || EXCLUDED.regra_validacao,
      updated_at          = now();

-- ── 2b) As três linhas que são PERGUNTA precisam de chave e opções ──────────
-- Sem `chave`/`opcoes` o portal desenha um upload no lugar do seletor, e o
-- trigger `qa_trg_guard_pergunta_resposta` nunca deixa a linha ser cumprida.
-- O merge preserva o grupo gravado no passo anterior.
UPDATE public.qa_servicos_documentos
   SET regra_validacao = COALESCE(regra_validacao, '{}'::jsonb) || jsonb_build_object(
         'tipo',  'pergunta',
         'chave', 'modalidade_cac',
         'opcoes', jsonb_build_array(
           jsonb_build_object('valor','colecionador','label','COLECIONADOR — acervo histórico'),
           jsonb_build_object('valor','atirador',    'label','ATIRADOR DESPORTIVO — treino e competição em clube'),
           jsonb_build_object('valor','cacador',     'label','CAÇADOR EXCEPCIONAL — controle de fauna invasora')
         )),
       updated_at = now()
 WHERE servico_id = 44 AND tipo_documento = 'pergunta_modalidade_cac';

UPDATE public.qa_servicos_documentos
   SET regra_validacao = COALESCE(regra_validacao, '{}'::jsonb) || jsonb_build_object(
         'tipo',  'pergunta',
         'chave', 'segundo_endereco_acervo',
         'opcoes', jsonb_build_array(
           jsonb_build_object('valor','nao','label','NÃO, guardo tudo em um endereço só'),
           jsonb_build_object('valor','sim','label','SIM, quero um segundo endereço de guarda')
         )),
       updated_at = now()
 WHERE servico_id = 44 AND tipo_documento = 'pergunta_segundo_endereco_acervo';

-- A DEGA só aparece para quem respondeu que tem segundo endereço.
UPDATE public.qa_servicos_documentos
   SET regra_validacao = COALESCE(regra_validacao, '{}'::jsonb) || jsonb_build_object(
         'depende_de', jsonb_build_object('chave','segundo_endereco_acervo','valor','sim')),
       updated_at = now()
 WHERE servico_id = 44 AND tipo_documento = 'declaracao_endereco_acervo';

-- Condição profissional: mesmas opções já usadas nos demais serviços.
UPDATE public.qa_servicos_documentos
   SET regra_validacao = COALESCE(regra_validacao, '{}'::jsonb) || jsonb_build_object(
         'tipo',  'pergunta',
         'chave', 'condicao_profissional',
         'opcoes', jsonb_build_array(
           jsonb_build_object('valor','clt',                'label','CLT — carteira assinada'),
           jsonb_build_object('valor','funcionario_publico','label','Servidor público (área geral)'),
           jsonb_build_object('valor','seguranca_publica',  'label','Servidor de segurança pública (PM, PC, PF, PRF, Guarda, Bombeiro, agente penitenciário)'),
           jsonb_build_object('valor','autonomo',           'label','Autônomo ou MEI'),
           jsonb_build_object('valor','empresario',         'label','Empresário ou sócio'),
           jsonb_build_object('valor','aposentado',         'label','Aposentado ou pensionista')
         )),
       updated_at = now()
 WHERE servico_id = 44 AND tipo_documento = 'renda_definir_condicao';

-- ── 3) Validade do CR: três anos, não doze meses ────────────────────────────
-- A linha atual diz 12 meses com base no Decreto 9.847/19. O prazo vigente é o
-- do art. 17 da IN 311/2025: três anos da concessão ou da última revalidação.
UPDATE public.qa_validade_documentos
   SET validade_dias = 36,
       unidade       = 'meses',
       alerta_dias   = 120,
       rotulo        = 'Certificado de Registro (CR)',
       base_legal    = 'IN DG/PF 311/2025, art. 17',
       updated_at    = now()
 WHERE tipo_documento = 'cr';

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- 1) O checklist do CR, na ordem em que o cliente vai ver:
--
-- SELECT ordem, tipo_documento, nome_documento, etapa, obrigatorio,
--        condicao_modalidade, condicao_profissional,
--        regra_validacao ->> 'grupo_checklist' AS grupo
--   FROM public.qa_servicos_documentos
--  WHERE servico_id = 44 AND ativo
--  ORDER BY ordem;
--
-- Esperado: 40 linhas, começando na pergunta da modalidade (ordem 5) e
-- terminando na juntada assinada (ordem 504).
--
-- 2) Nenhuma exigência pode ficar sem grupo:
--
-- SELECT tipo_documento FROM public.qa_servicos_documentos
--  WHERE servico_id = 44 AND ativo
--    AND (regra_validacao ->> 'grupo_checklist') IS NULL;
--
-- Esperado: zero linhas.
--
-- 3) A validade do CR:
--
-- SELECT tipo_documento, validade_dias, unidade, base_legal
--   FROM public.qa_validade_documentos WHERE tipo_documento = 'cr';
--
-- Esperado: 36 meses, IN DG/PF 311/2025, art. 17.
