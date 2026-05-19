-- WAVE 1 — Checklist documental para os 3 serviços críticos de defesa pessoal
-- servico_id=48 → aquisicao-registro-posse-de-arma-de-fogo
-- servico_id=43 → registro-arma-fogo
-- servico_id=35 → posse-de-arma-de-fogo

-- =============================================================================
-- BLOCO 1 — aquisicao-registro-posse-de-arma-de-fogo (servico_id=48)
-- =============================================================================

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 48, 'certidao_antecedentes_policia_civil_sp', 'Certidão de Antecedentes Criminais — Polícia Civil/SP', 'base', true, 10, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='certidao_antecedentes_policia_civil_sp');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 48, 'certidao_crimes_eleitorais_tse', 'Certidão Negativa de Crimes Eleitorais (TSE)', 'base', true, 11, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='certidao_crimes_eleitorais_tse');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 48, 'certidao_crimes_militares_stm', 'Certidão Negativa de Crimes Militares (STM)', 'base', true, 12, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='certidao_crimes_militares_stm');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 48, 'certidao_criminal_tjmsp', 'Certidão Criminal do TJM-SP', 'base', true, 13, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='certidao_criminal_tjmsp');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 48, 'certidao_federal_trf3_regional', 'Certidão Federal TRF3 — Abrangência Regional', 'base', true, 14, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='certidao_federal_trf3_regional');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 48, 'certidao_federal_trf3_sjsp_jef', 'Certidão Federal TRF3 — Seção Judiciária de São Paulo (SJSP/JEF)', 'base', true, 15, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='certidao_federal_trf3_sjsp_jef');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 48, 'certidao_tjsp_distribuicao_criminal', 'Certidão Estadual TJSP — Distribuição de Ações Criminais', 'base', true, 16, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='certidao_tjsp_distribuicao_criminal');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 48, 'certidao_tjsp_execucoes_criminais', 'Certidão Estadual TJSP — Execuções Criminais', 'base', true, 17, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='certidao_tjsp_execucoes_criminais');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 48, 'rg_com_cpf', 'RG com CPF', 'base', true, 1, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='rg_com_cpf');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 48, 'cnh', 'CNH (Carteira Nacional de Habilitação)', 'base', false, 2, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='cnh');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 48, 'comprovante_residencia', 'Comprovante de residência (últimos 90 dias)', 'base', true, 3, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='comprovante_residencia');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 48, 'ctps', 'Carteira de Trabalho (CTPS)', 'base', false, 4, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='ctps');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 48, 'renda_definir_condicao', 'Defina sua condição profissional para liberar os comprovantes corretos', 'complementar', true, 20, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='renda_definir_condicao');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 48, 'renda_holerite_mes_atual', 'Holerite mais recente (mês atual)', 'complementar', false, 21, true, 'clt'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='renda_holerite_mes_atual');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 48, 'renda_holerite_funcionario_publico', 'Holerite recente (servidor público)', 'complementar', false, 22, true, 'funcionario_publico'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='renda_holerite_funcionario_publico');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 48, 'renda_cartao_cnpj', 'Cartão CNPJ da empresa', 'complementar', false, 23, true, 'empresario'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='renda_cartao_cnpj');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 48, 'renda_contrato_social', 'Contrato Social', 'complementar', false, 24, true, 'empresario'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='renda_contrato_social');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 48, 'renda_qsa', 'QSA (Quadro de Sócios e Administradores)', 'complementar', false, 25, true, 'empresario'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='renda_qsa');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 48, 'renda_cnpj_autonomo', 'Cartão CNPJ (autônomo / MEI)', 'complementar', false, 26, true, 'autonomo'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='renda_cnpj_autonomo');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 48, 'renda_nf_recente', 'Nota fiscal recente emitida', 'complementar', false, 27, true, 'autonomo'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='renda_nf_recente');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 48, 'renda_comprovante_beneficio', 'Comprovante de benefício (aposentadoria)', 'complementar', false, 28, true, 'aposentado'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='renda_comprovante_beneficio');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 48, 'renda_extrato_inss', 'Extrato completo de contribuições do INSS', 'complementar', false, 29, true, 'aposentado'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='renda_extrato_inss');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 48, 'renda_carteira_funcional', 'Carteira Funcional / Documento Funcional', 'complementar', false, 30, true, 'funcionario_publico'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='renda_carteira_funcional');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 48, 'pergunta_comprovante_em_nome', 'O comprovante de residência atual está em seu nome?', 'complementar', true, 31, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='pergunta_comprovante_em_nome');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 48, 'declaracao_responsavel_imovel', 'Declaração do responsável pelo imóvel', 'complementar', false, 32, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='declaracao_responsavel_imovel');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 48, 'pergunta_responde_inquerito_criminal', 'Você responde a algum inquérito ou processo criminal?', 'complementar', true, 33, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='pergunta_responde_inquerito_criminal');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 48, 'declaracao_sem_inquerito_processo_criminal', 'Declaração de não responder a inquérito/processo criminal', 'complementar', true, 34, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='declaracao_sem_inquerito_processo_criminal');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 48, 'declaracao_guarda_responsavel', 'Declaração de guarda responsável (cofre ou lugar seguro)', 'complementar', true, 35, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='declaracao_guarda_responsavel');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 48, 'laudo_psicologico', 'Laudo Psicológico (psicólogo credenciado pela PF)', 'tecnico', true, 40, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='laudo_psicologico');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 48, 'laudo_capacidade_tecnica', 'Atestado de Capacidade Técnica (instrutor credenciado)', 'tecnico', true, 41, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=48 AND tipo_documento='laudo_capacidade_tecnica');

-- =============================================================================
-- BLOCO 2 — registro-arma-fogo (servico_id=43)
-- =============================================================================

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 43, 'rg_com_cpf', 'RG com CPF', 'base', true, 1, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=43 AND tipo_documento='rg_com_cpf');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 43, 'cnh', 'CNH (Carteira Nacional de Habilitação)', 'base', false, 2, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=43 AND tipo_documento='cnh');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 43, 'comprovante_residencia', 'Comprovante de residência (últimos 90 dias)', 'base', true, 3, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=43 AND tipo_documento='comprovante_residencia');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 43, 'declaracao_guarda_responsavel', 'Declaração de guarda responsável (cofre ou lugar seguro)', 'complementar', true, 20, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=43 AND tipo_documento='declaracao_guarda_responsavel');

-- =============================================================================
-- BLOCO 3 — posse-de-arma-de-fogo (servico_id=35)
-- =============================================================================

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 35, 'rg_com_cpf', 'RG com CPF', 'base', true, 1, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=35 AND tipo_documento='rg_com_cpf');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 35, 'cnh', 'CNH (Carteira Nacional de Habilitação)', 'base', false, 2, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=35 AND tipo_documento='cnh');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 35, 'comprovante_residencia', 'Comprovante de residência (últimos 90 dias)', 'base', true, 3, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=35 AND tipo_documento='comprovante_residencia');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 35, 'renda_definir_condicao', 'Defina sua condição profissional', 'complementar', true, 20, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=35 AND tipo_documento='renda_definir_condicao');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 35, 'renda_holerite_mes_atual', 'Holerite mais recente (mês atual)', 'complementar', false, 21, true, 'clt'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=35 AND tipo_documento='renda_holerite_mes_atual');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 35, 'renda_holerite_funcionario_publico', 'Holerite recente (servidor público)', 'complementar', false, 22, true, 'funcionario_publico'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=35 AND tipo_documento='renda_holerite_funcionario_publico');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 35, 'renda_cartao_cnpj', 'Cartão CNPJ da empresa', 'complementar', false, 23, true, 'empresario'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=35 AND tipo_documento='renda_cartao_cnpj');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 35, 'renda_cnpj_autonomo', 'Cartão CNPJ (autônomo / MEI)', 'complementar', false, 24, true, 'autonomo'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=35 AND tipo_documento='renda_cnpj_autonomo');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 35, 'renda_comprovante_beneficio', 'Comprovante de benefício (aposentadoria)', 'complementar', false, 25, true, 'aposentado'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=35 AND tipo_documento='renda_comprovante_beneficio');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 35, 'pergunta_comprovante_em_nome', 'O comprovante de residência atual está em seu nome?', 'complementar', true, 30, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=35 AND tipo_documento='pergunta_comprovante_em_nome');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 35, 'declaracao_responsavel_imovel', 'Declaração do responsável pelo imóvel', 'complementar', false, 31, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=35 AND tipo_documento='declaracao_responsavel_imovel');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 35, 'declaracao_sem_inquerito_processo_criminal', 'Declaração de não responder a inquérito/processo criminal', 'complementar', true, 32, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=35 AND tipo_documento='declaracao_sem_inquerito_processo_criminal');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 35, 'declaracao_guarda_responsavel', 'Declaração de guarda responsável (cofre ou lugar seguro)', 'complementar', true, 33, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=35 AND tipo_documento='declaracao_guarda_responsavel');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 35, 'laudo_psicologico', 'Laudo Psicológico (psicólogo credenciado pela PF)', 'tecnico', true, 40, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=35 AND tipo_documento='laudo_psicologico');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 35, 'laudo_capacidade_tecnica', 'Atestado de Capacidade Técnica (instrutor credenciado)', 'tecnico', true, 41, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=35 AND tipo_documento='laudo_capacidade_tecnica');