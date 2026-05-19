BEGIN;

-- BLOCO 1 — renovacao-cr (32)
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 32, 'rg_com_cpf', 'RG com CPF', 'base', true, 1, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=32 AND tipo_documento='rg_com_cpf');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 32, 'cnh', 'CNH (alternativa ao RG)', 'base', false, 2, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=32 AND tipo_documento='cnh');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 32, 'comprovante_residencia', 'Comprovante de residência (atual)', 'base', true, 3, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=32 AND tipo_documento='comprovante_residencia');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 32, 'comprovante_residencia_ano_1', 'Comprovante de residência ano anterior (-1)', 'base', true, 4, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=32 AND tipo_documento='comprovante_residencia_ano_1');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 32, 'comprovante_residencia_ano_2', 'Comprovante de residência (-2)', 'base', true, 5, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=32 AND tipo_documento='comprovante_residencia_ano_2');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 32, 'comprovante_residencia_ano_3', 'Comprovante de residência (-3)', 'base', true, 6, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=32 AND tipo_documento='comprovante_residencia_ano_3');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 32, 'comprovante_residencia_ano_4', 'Comprovante de residência (-4)', 'base', true, 7, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=32 AND tipo_documento='comprovante_residencia_ano_4');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 32, 'renda_definir_condicao', 'Defina sua condição profissional', 'complementar', true, 20, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=32 AND tipo_documento='renda_definir_condicao');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 32, 'renda_holerite_mes_atual', 'Holerite recente', 'complementar', false, 21, true, 'clt'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=32 AND tipo_documento='renda_holerite_mes_atual');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 32, 'renda_cartao_cnpj', 'Cartão CNPJ', 'complementar', false, 22, true, 'empresario'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=32 AND tipo_documento='renda_cartao_cnpj');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 32, 'declaracao_habitualidade_clube', 'Declaração de habitualidade no clube de tiro', 'complementar', true, 30, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=32 AND tipo_documento='declaracao_habitualidade_clube');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 32, 'declaracao_compromisso_treino', 'Declaração de compromisso de treino', 'complementar', true, 31, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=32 AND tipo_documento='declaracao_compromisso_treino');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 32, 'declaracao_endereco_acervo', 'Declaração de Endereço do Guarda (DEGA)', 'complementar', true, 32, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=32 AND tipo_documento='declaracao_endereco_acervo');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 32, 'dsa_declaracao_seguranca_acervo', 'Declaração de Segurança do Acervo (DSA)', 'complementar', true, 33, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=32 AND tipo_documento='dsa_declaracao_seguranca_acervo');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 32, 'comprovante_filiacao_entidade_tiro', 'Comprovante de filiação a entidade de tiro', 'complementar', true, 34, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=32 AND tipo_documento='comprovante_filiacao_entidade_tiro');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 32, 'laudo_psicologico', 'Laudo Psicológico atualizado', 'tecnico', true, 40, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=32 AND tipo_documento='laudo_psicologico');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 32, 'laudo_capacidade_tecnica', 'Atestado de Capacidade Técnica atualizado', 'tecnico', true, 41, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=32 AND tipo_documento='laudo_capacidade_tecnica');

-- BLOCO 2 — mudanca-servico (42)
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 42, 'rg_com_cpf', 'RG com CPF', 'base', true, 1, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=42 AND tipo_documento='rg_com_cpf');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 42, 'comprovante_residencia', 'Comprovante de residência (atual)', 'base', true, 3, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=42 AND tipo_documento='comprovante_residencia');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 42, 'comprovante_residencia_ano_1', 'Comprovante de residência (-1)', 'base', true, 4, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=42 AND tipo_documento='comprovante_residencia_ano_1');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 42, 'comprovante_residencia_ano_2', 'Comprovante de residência (-2)', 'base', true, 5, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=42 AND tipo_documento='comprovante_residencia_ano_2');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 42, 'comprovante_residencia_ano_3', 'Comprovante de residência (-3)', 'base', true, 6, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=42 AND tipo_documento='comprovante_residencia_ano_3');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 42, 'comprovante_residencia_ano_4', 'Comprovante de residência (-4)', 'base', true, 7, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=42 AND tipo_documento='comprovante_residencia_ano_4');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 42, 'comprovante_filiacao_entidade_tiro', 'Comprovante de filiação a entidade de tiro', 'complementar', true, 30, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=42 AND tipo_documento='comprovante_filiacao_entidade_tiro');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 42, 'declaracao_habitualidade_clube', 'Declaração de habitualidade no clube', 'complementar', true, 31, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=42 AND tipo_documento='declaracao_habitualidade_clube');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 42, 'declaracao_endereco_acervo', 'DEGA — Declaração de Endereço do Acervo', 'complementar', true, 32, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=42 AND tipo_documento='declaracao_endereco_acervo');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 42, 'dsa_declaracao_seguranca_acervo', 'DSA — Declaração de Segurança do Acervo', 'complementar', true, 33, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=42 AND tipo_documento='dsa_declaracao_seguranca_acervo');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 42, 'laudo_psicologico', 'Laudo Psicológico', 'tecnico', true, 40, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=42 AND tipo_documento='laudo_psicologico');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 42, 'laudo_capacidade_tecnica', 'Atestado de Capacidade Técnica', 'tecnico', true, 41, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=42 AND tipo_documento='laudo_capacidade_tecnica');

-- BLOCO 3 — registro-e-apostilamento (33)
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 33, 'rg_com_cpf', 'RG com CPF', 'base', true, 1, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=33 AND tipo_documento='rg_com_cpf');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 33, 'comprovante_residencia', 'Comprovante de residência atual', 'base', true, 3, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=33 AND tipo_documento='comprovante_residencia');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 33, 'declaracao_endereco_acervo', 'DEGA — Declaração de Endereço do Acervo', 'complementar', true, 30, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=33 AND tipo_documento='declaracao_endereco_acervo');

-- BLOCO 4 — guia-de-trafego-especial-cac (34)
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 34, 'rg_com_cpf', 'RG com CPF', 'base', true, 1, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=34 AND tipo_documento='rg_com_cpf');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 34, 'comprovante_residencia', 'Comprovante de residência atual', 'base', true, 3, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=34 AND tipo_documento='comprovante_residencia');

-- BLOCO 5 — apostilamento-atualizacao (45)
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 45, 'rg_com_cpf', 'RG com CPF', 'base', true, 1, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=45 AND tipo_documento='rg_com_cpf');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 45, 'comprovante_residencia', 'Comprovante de residência atualizado', 'base', true, 3, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=45 AND tipo_documento='comprovante_residencia');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 45, 'declaracao_endereco_acervo', 'DEGA — novo endereço do acervo', 'complementar', true, 30, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=45 AND tipo_documento='declaracao_endereco_acervo');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 45, 'dsa_declaracao_seguranca_acervo', 'DSA — Declaração de Segurança do Acervo (novo endereço)', 'complementar', true, 31, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=45 AND tipo_documento='dsa_declaracao_seguranca_acervo');

-- BLOCO 6 — autorizacao-compra-atirador (50)
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 50, 'rg_com_cpf', 'RG com CPF', 'base', true, 1, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=50 AND tipo_documento='rg_com_cpf');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 50, 'comprovante_residencia', 'Comprovante de residência atual', 'base', true, 3, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=50 AND tipo_documento='comprovante_residencia');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 50, 'comprovante_filiacao_entidade_tiro', 'Comprovante de filiação ativa a entidade de tiro', 'complementar', true, 30, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=50 AND tipo_documento='comprovante_filiacao_entidade_tiro');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 50, 'declaracao_habitualidade_clube', 'Declaração de habitualidade no clube', 'complementar', true, 31, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=50 AND tipo_documento='declaracao_habitualidade_clube');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 50, 'declaracao_compromisso_habitualidade', 'Declaração de compromisso de habitualidade', 'complementar', true, 32, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=50 AND tipo_documento='declaracao_compromisso_habitualidade');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 50, 'laudo_capacidade_tecnica', 'Atestado de Capacidade Técnica vigente', 'tecnico', true, 40, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=50 AND tipo_documento='laudo_capacidade_tecnica');

-- BLOCO 7 — autorizacao-compra-cacador (51)
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 51, 'rg_com_cpf', 'RG com CPF', 'base', true, 1, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=51 AND tipo_documento='rg_com_cpf');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 51, 'comprovante_residencia', 'Comprovante de residência atual', 'base', true, 3, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=51 AND tipo_documento='comprovante_residencia');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 51, 'habilitacao_cacador_ibama', 'Habilitação ambiental de caçador (IBAMA/IBRAM)', 'complementar', true, 30, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=51 AND tipo_documento='habilitacao_cacador_ibama');
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 51, 'laudo_capacidade_tecnica', 'Atestado de Capacidade Técnica vigente', 'tecnico', true, 40, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=51 AND tipo_documento='laudo_capacidade_tecnica');

COMMIT;