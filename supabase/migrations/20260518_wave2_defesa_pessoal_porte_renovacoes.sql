-- =============================================================================
-- WAVE 2 — Checklist documental para os 3 serviços restantes de defesa pessoal
-- =============================================================================
-- Data: 2026-05-18
-- Autor: Willian Massaroto (Quero Armas) + apoio Claude
--
-- OBJETIVO
-- Completar a cobertura documental dos serviços PF/SINARM de defesa pessoal
-- que hoje têm apenas os 8 antecedentes cadastrados, reaproveitando os
-- tipo_documento já criados (e introduzindo o de "efetiva necessidade"
-- para porte, que é específico do regime de porte).
--
-- SERVIÇOS ATENDIDOS NESTA WAVE
--   servico_id=41 → porte-arma-fogo (R$ 3.997, defesa pessoal)
--   servico_id=36 → renovacao-posse-de-arma-de-fogo (R$ 2.997)
--   servico_id=37 → renovacao-de-porte-de-arma-de-fogo (R$ 2.997)
--
-- BASE LEGAL
--   - Lei 10.826/2003 art. 6º e 10 (porte)
--   - Decreto 11.615/2023 art. 22, 23, 24, 25 (porte e renovação)
--   - Decreto 12.345/2024
--   - Portaria DG/PF 18.988/2024 (CRPF defesa pessoal)
--   - IN DG/PF 201/2021 art. 36-40 (procedimentos de porte e renovação)
--
-- IDEMPOTÊNCIA — todos os INSERTs usam WHERE NOT EXISTS.
--
-- REVERSÃO (se precisar):
--   DELETE FROM qa_servicos_documentos
--   WHERE servico_id IN (41, 36, 37)
--     AND created_at >= '2026-05-18'::date;
-- =============================================================================

BEGIN;

-- =============================================================================
-- BLOCO 1 — porte-arma-fogo (servico_id=41, R$ 3.997)
-- Base: Decreto 11.615 art. 22-25 + IN 201/2021 art. 36 + Portaria 18.988/2024
-- =============================================================================

-- BASE — identidade + endereço (antecedentes já estão cadastrados)
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

-- COMPLEMENTAR — renda (ocupação lícita)
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

-- Perguntas + declarações
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

-- ⚠️ EFETIVA NECESSIDADE — Decreto 11.615 art. 24
-- Específico do porte (não exigido na posse). Marcado como obrigatório.
-- OBS: este tipo_documento ainda NÃO existe nos seus catálogos.
-- Criamos aqui pela primeira vez para o serviço 41.
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 41, 'comprovante_efetiva_necessidade', 'Comprovação de efetiva necessidade (porte)', 'complementar', true, 35, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='comprovante_efetiva_necessidade');

-- TECNICO
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 41, 'laudo_psicologico', 'Laudo Psicológico (psicólogo credenciado PF)', 'tecnico', true, 40, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='laudo_psicologico');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 41, 'laudo_capacidade_tecnica', 'Atestado de Capacidade Técnica (instrutor credenciado)', 'tecnico', true, 41, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=41 AND tipo_documento='laudo_capacidade_tecnica');


-- =============================================================================
-- BLOCO 2 — renovacao-posse-de-arma-de-fogo (servico_id=36, R$ 2.997)
-- Base: IN 201/2021 + Portaria 18.988/2024
-- =============================================================================
-- A renovação exige a documentação atualizada (laudos vigentes e antecedentes
-- recentes). PF NÃO reaproveita laudos antigos. Estrutura é praticamente
-- igual à posse inicial.

-- BASE — identidade + endereço
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 36, 'rg_com_cpf', 'RG com CPF', 'base', true, 1, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='rg_com_cpf');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 36, 'cnh', 'CNH', 'base', false, 2, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='cnh');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 36, 'comprovante_residencia', 'Comprovante de residência (últimos 90 dias)', 'base', true, 3, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='comprovante_residencia');

-- COMPLEMENTAR — atualizações
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 36, 'renda_definir_condicao', 'Defina sua condição profissional', 'complementar', true, 20, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='renda_definir_condicao');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 36, 'renda_holerite_mes_atual', 'Holerite mais recente', 'complementar', false, 21, true, 'clt'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='renda_holerite_mes_atual');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 36, 'renda_holerite_funcionario_publico', 'Holerite (servidor)', 'complementar', false, 22, true, 'funcionario_publico'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='renda_holerite_funcionario_publico');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 36, 'renda_cartao_cnpj', 'Cartão CNPJ', 'complementar', false, 23, true, 'empresario'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='renda_cartao_cnpj');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 36, 'renda_cnpj_autonomo', 'Cartão CNPJ (autônomo)', 'complementar', false, 24, true, 'autonomo'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='renda_cnpj_autonomo');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 36, 'renda_comprovante_beneficio', 'Comprovante de aposentadoria', 'complementar', false, 25, true, 'aposentado'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='renda_comprovante_beneficio');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 36, 'pergunta_comprovante_em_nome', 'Comprovante está em seu nome?', 'complementar', true, 30, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='pergunta_comprovante_em_nome');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 36, 'pergunta_responde_inquerito_criminal', 'Responde a inquérito/processo criminal?', 'complementar', true, 31, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='pergunta_responde_inquerito_criminal');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 36, 'declaracao_sem_inquerito_processo_criminal', 'Declaração de não responder a inquérito/processo criminal', 'complementar', true, 32, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='declaracao_sem_inquerito_processo_criminal');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 36, 'declaracao_guarda_responsavel', 'Declaração de guarda responsável (cofre)', 'complementar', true, 33, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='declaracao_guarda_responsavel');

-- TECNICO — laudos atualizados
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 36, 'laudo_psicologico', 'Laudo Psicológico atualizado (validade 365 dias)', 'tecnico', true, 40, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='laudo_psicologico');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 36, 'laudo_capacidade_tecnica', 'Atestado de Capacidade Técnica atualizado', 'tecnico', true, 41, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=36 AND tipo_documento='laudo_capacidade_tecnica');


-- =============================================================================
-- BLOCO 3 — renovacao-de-porte-de-arma-de-fogo (servico_id=37, R$ 2.997)
-- Base: IN 201/2021 art. 40 + Portaria 18.988/2024
-- =============================================================================
-- Igual à renovação da posse + reavaliação da efetiva necessidade.

-- BASE
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'rg_com_cpf', 'RG com CPF', 'base', true, 1, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='rg_com_cpf');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'cnh', 'CNH', 'base', false, 2, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='cnh');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'comprovante_residencia', 'Comprovante de residência (últimos 90 dias)', 'base', true, 3, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='comprovante_residencia');

-- COMPLEMENTAR
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'renda_definir_condicao', 'Defina sua condição profissional', 'complementar', true, 20, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='renda_definir_condicao');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 37, 'renda_holerite_mes_atual', 'Holerite recente', 'complementar', false, 21, true, 'clt'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='renda_holerite_mes_atual');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 37, 'renda_holerite_funcionario_publico', 'Holerite (servidor)', 'complementar', false, 22, true, 'funcionario_publico'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='renda_holerite_funcionario_publico');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 37, 'renda_cartao_cnpj', 'Cartão CNPJ', 'complementar', false, 23, true, 'empresario'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='renda_cartao_cnpj');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 37, 'renda_cnpj_autonomo', 'CNPJ (autônomo)', 'complementar', false, 24, true, 'autonomo'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='renda_cnpj_autonomo');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo, condicao_profissional)
SELECT 37, 'renda_comprovante_beneficio', 'Comprovante de aposentadoria', 'complementar', false, 25, true, 'aposentado'
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='renda_comprovante_beneficio');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'pergunta_comprovante_em_nome', 'Comprovante está em seu nome?', 'complementar', true, 30, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='pergunta_comprovante_em_nome');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'pergunta_responde_inquerito_criminal', 'Responde a inquérito criminal?', 'complementar', true, 31, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='pergunta_responde_inquerito_criminal');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'declaracao_sem_inquerito_processo_criminal', 'Declaração de não responder a inquérito/processo criminal', 'complementar', true, 32, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='declaracao_sem_inquerito_processo_criminal');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'declaracao_guarda_responsavel', 'Declaração de guarda responsável (cofre)', 'complementar', true, 33, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='declaracao_guarda_responsavel');

-- ⚠️ Reavaliação de efetiva necessidade (Decreto 11.615 art. 24)
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'comprovante_efetiva_necessidade', 'Comprovação atualizada de efetiva necessidade (porte)', 'complementar', true, 34, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='comprovante_efetiva_necessidade');

-- TECNICO
INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'laudo_psicologico', 'Laudo Psicológico atualizado (365 dias)', 'tecnico', true, 40, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='laudo_psicologico');

INSERT INTO qa_servicos_documentos (servico_id, tipo_documento, nome_documento, etapa, obrigatorio, ordem, ativo)
SELECT 37, 'laudo_capacidade_tecnica', 'Atestado de Capacidade Técnica atualizado', 'tecnico', true, 41, true
WHERE NOT EXISTS (SELECT 1 FROM qa_servicos_documentos WHERE servico_id=37 AND tipo_documento='laudo_capacidade_tecnica');

COMMIT;

-- =============================================================================
-- VALIDAÇÃO PÓS-ROLLOUT
-- =============================================================================
-- SELECT c.slug, c.nome,
--        COUNT(d.id) AS total,
--        COUNT(d.id) FILTER (WHERE d.etapa='base') AS base,
--        COUNT(d.id) FILTER (WHERE d.etapa='complementar') AS complementar,
--        COUNT(d.id) FILTER (WHERE d.etapa='tecnico') AS tecnico
-- FROM qa_servicos_catalogo c
-- LEFT JOIN qa_servicos_documentos d ON d.servico_id = c.servico_id AND d.ativo = true
-- WHERE c.servico_id IN (41, 36, 37)
-- GROUP BY c.servico_id, c.slug, c.nome
-- ORDER BY c.servico_id;
--
-- Resultado esperado (com os 8 antecedentes que já estavam):
--   porte-arma-fogo (41)                          → ~30 docs (8 ant + 4 base + 16 comp + 2 tec)
--   renovacao-posse-de-arma-de-fogo (36)          → ~26 docs (8 ant + 3 base + 13 comp + 2 tec)
--   renovacao-de-porte-de-arma-de-fogo (37)       → ~27 docs (8 ant + 3 base + 14 comp + 2 tec)
-- =============================================================================
