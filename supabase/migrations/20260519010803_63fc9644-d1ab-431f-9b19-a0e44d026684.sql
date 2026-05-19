-- WAVE 2 — Checklist documental para porte e renovações (defesa pessoal)
-- Idempotente via WHERE NOT EXISTS. Apenas qa_servicos_documentos é alterada.

BEGIN;

-- BLOCO 1 — porte-arma-fogo (servico_id=41)
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 41, 'rg_com_cpf', 'RG com CPF', 'base', true, 1, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='rg_com_cpf');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 41, 'cnh', 'CNH (Carteira Nacional de Habilitação)', 'base', false, 2, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='cnh');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 41, 'comprovante_residencia', 'Comprovante de residência (últimos 90 dias)', 'base', true, 3, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='comprovante_residencia');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 41, 'ctps', 'Carteira de Trabalho (CTPS)', 'base', false, 4, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='ctps');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 41, 'renda_definir_condicao', 'Defina sua condição profissional', 'complementar', true, 20, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='renda_definir_condicao');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 41, 'renda_holerite_mes_atual', 'Holerite mais recente', 'complementar', false, 21, true, 'clt'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='renda_holerite_mes_atual');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 41, 'renda_holerite_funcionario_publico', 'Holerite recente (servidor público)', 'complementar', false, 22, true, 'funcionario_publico'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='renda_holerite_funcionario_publico');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 41, 'renda_cartao_cnpj', 'Cartão CNPJ', 'complementar', false, 23, true, 'empresario'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='renda_cartao_cnpj');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 41, 'renda_contrato_social', 'Contrato Social', 'complementar', false, 24, true, 'empresario'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='renda_contrato_social');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 41, 'renda_cnpj_autonomo', 'Cartão CNPJ (autônomo / MEI)', 'complementar', false, 25, true, 'autonomo'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='renda_cnpj_autonomo');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 41, 'renda_nf_recente', 'Nota fiscal recente', 'complementar', false, 26, true, 'autonomo'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='renda_nf_recente');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 41, 'renda_comprovante_beneficio', 'Comprovante de benefício (aposentadoria)', 'complementar', false, 27, true, 'aposentado'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='renda_comprovante_beneficio');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 41, 'renda_extrato_inss', 'Extrato INSS', 'complementar', false, 28, true, 'aposentado'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='renda_extrato_inss');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 41, 'pergunta_comprovante_em_nome', 'O comprovante de residência está em seu nome?', 'complementar', true, 30, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='pergunta_comprovante_em_nome');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 41, 'declaracao_responsavel_imovel', 'Declaração do responsável pelo imóvel', 'complementar', false, 31, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='declaracao_responsavel_imovel');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 41, 'pergunta_responde_inquerito_criminal', 'Responde a inquérito/processo criminal?', 'complementar', true, 32, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='pergunta_responde_inquerito_criminal');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 41, 'declaracao_sem_inquerito_processo_criminal', 'Declaração de não responder a inquérito/processo criminal', 'complementar', true, 33, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='declaracao_sem_inquerito_processo_criminal');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 41, 'declaracao_guarda_responsavel', 'Declaração de guarda responsável (cofre ou lugar seguro)', 'complementar', true, 34, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='declaracao_guarda_responsavel');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 41, 'comprovante_efetiva_necessidade', 'Comprovação de efetiva necessidade (porte)', 'complementar', true, 35, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='comprovante_efetiva_necessidade');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 41, 'laudo_psicologico', 'Laudo Psicológico (psicólogo credenciado PF)', 'tecnico', true, 40, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='laudo_psicologico');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 41, 'laudo_capacidade_tecnica', 'Atestado de Capacidade Técnica (instrutor credenciado)', 'tecnico', true, 41, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='laudo_capacidade_tecnica');

-- BLOCO 2 — renovacao-posse-de-arma-de-fogo (servico_id=36)
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 36, 'rg_com_cpf', 'RG com CPF', 'base', true, 1, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='rg_com_cpf');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 36, 'cnh', 'CNH (Carteira Nacional de Habilitação)', 'base', false, 2, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='cnh');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 36, 'comprovante_residencia', 'Comprovante de residência (últimos 90 dias)', 'base', true, 3, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='comprovante_residencia');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 36, 'renda_definir_condicao', 'Defina sua condição profissional', 'complementar', true, 20, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='renda_definir_condicao');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 36, 'renda_holerite_mes_atual', 'Holerite mais recente', 'complementar', false, 21, true, 'clt'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='renda_holerite_mes_atual');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 36, 'renda_holerite_funcionario_publico', 'Holerite recente (servidor público)', 'complementar', false, 22, true, 'funcionario_publico'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='renda_holerite_funcionario_publico');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 36, 'renda_cartao_cnpj', 'Cartão CNPJ', 'complementar', false, 23, true, 'empresario'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='renda_cartao_cnpj');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 36, 'renda_contrato_social', 'Contrato Social', 'complementar', false, 24, true, 'empresario'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='renda_contrato_social');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 36, 'renda_cnpj_autonomo', 'Cartão CNPJ (autônomo / MEI)', 'complementar', false, 25, true, 'autonomo'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='renda_cnpj_autonomo');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 36, 'renda_nf_recente', 'Nota fiscal recente', 'complementar', false, 26, true, 'autonomo'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='renda_nf_recente');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 36, 'renda_comprovante_beneficio', 'Comprovante de benefício (aposentadoria)', 'complementar', false, 27, true, 'aposentado'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='renda_comprovante_beneficio');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 36, 'renda_extrato_inss', 'Extrato INSS', 'complementar', false, 28, true, 'aposentado'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='renda_extrato_inss');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 36, 'pergunta_comprovante_em_nome', 'O comprovante de residência está em seu nome?', 'complementar', true, 30, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='pergunta_comprovante_em_nome');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 36, 'declaracao_responsavel_imovel', 'Declaração do responsável pelo imóvel', 'complementar', false, 31, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='declaracao_responsavel_imovel');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 36, 'pergunta_responde_inquerito_criminal', 'Responde a inquérito/processo criminal?', 'complementar', true, 32, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='pergunta_responde_inquerito_criminal');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 36, 'declaracao_sem_inquerito_processo_criminal', 'Declaração de não responder a inquérito/processo criminal', 'complementar', true, 33, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='declaracao_sem_inquerito_processo_criminal');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 36, 'declaracao_guarda_responsavel', 'Declaração de guarda responsável (cofre ou lugar seguro)', 'complementar', true, 34, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='declaracao_guarda_responsavel');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 36, 'laudo_psicologico', 'Laudo Psicológico (psicólogo credenciado PF)', 'tecnico', true, 40, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='laudo_psicologico');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 36, 'laudo_capacidade_tecnica', 'Atestado de Capacidade Técnica (instrutor credenciado)', 'tecnico', true, 41, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='laudo_capacidade_tecnica');

-- BLOCO 3 — renovacao-de-porte-de-arma-de-fogo (servico_id=37)
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'rg_com_cpf', 'RG com CPF', 'base', true, 1, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='rg_com_cpf');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'cnh', 'CNH (Carteira Nacional de Habilitação)', 'base', false, 2, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='cnh');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'comprovante_residencia', 'Comprovante de residência (últimos 90 dias)', 'base', true, 3, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='comprovante_residencia');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'renda_definir_condicao', 'Defina sua condição profissional', 'complementar', true, 20, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='renda_definir_condicao');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 37, 'renda_holerite_mes_atual', 'Holerite mais recente', 'complementar', false, 21, true, 'clt'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='renda_holerite_mes_atual');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 37, 'renda_holerite_funcionario_publico', 'Holerite recente (servidor público)', 'complementar', false, 22, true, 'funcionario_publico'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='renda_holerite_funcionario_publico');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 37, 'renda_cartao_cnpj', 'Cartão CNPJ', 'complementar', false, 23, true, 'empresario'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='renda_cartao_cnpj');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 37, 'renda_contrato_social', 'Contrato Social', 'complementar', false, 24, true, 'empresario'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='renda_contrato_social');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 37, 'renda_cnpj_autonomo', 'Cartão CNPJ (autônomo / MEI)', 'complementar', false, 25, true, 'autonomo'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='renda_cnpj_autonomo');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 37, 'renda_nf_recente', 'Nota fiscal recente', 'complementar', false, 26, true, 'autonomo'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='renda_nf_recente');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 37, 'renda_comprovante_beneficio', 'Comprovante de benefício (aposentadoria)', 'complementar', false, 27, true, 'aposentado'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='renda_comprovante_beneficio');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 37, 'renda_extrato_inss', 'Extrato INSS', 'complementar', false, 28, true, 'aposentado'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='renda_extrato_inss');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'pergunta_comprovante_em_nome', 'O comprovante de residência está em seu nome?', 'complementar', true, 30, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='pergunta_comprovante_em_nome');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'declaracao_responsavel_imovel', 'Declaração do responsável pelo imóvel', 'complementar', false, 31, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='declaracao_responsavel_imovel');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'pergunta_responde_inquerito_criminal', 'Responde a inquérito/processo criminal?', 'complementar', true, 32, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='pergunta_responde_inquerito_criminal');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'declaracao_sem_inquerito_processo_criminal', 'Declaração de não responder a inquérito/processo criminal', 'complementar', true, 33, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='declaracao_sem_inquerito_processo_criminal');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'declaracao_guarda_responsavel', 'Declaração de guarda responsável (cofre ou lugar seguro)', 'complementar', true, 34, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='declaracao_guarda_responsavel');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'comprovante_efetiva_necessidade', 'Comprovação de efetiva necessidade (porte)', 'complementar', true, 35, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='comprovante_efetiva_necessidade');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'laudo_psicologico', 'Laudo Psicológico (psicólogo credenciado PF)', 'tecnico', true, 40, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='laudo_psicologico');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'laudo_capacidade_tecnica', 'Atestado de Capacidade Técnica (instrutor credenciado)', 'tecnico', true, 41, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='laudo_capacidade_tecnica');

COMMIT;