-- ============================================================================
-- CR: o protocolo é da equipe — ajustes A, B e C confirmados pelo titular
-- ----------------------------------------------------------------------------
-- Relato do titular (19/08/2026) sobre a etapa final do CR, confirmado ponto a
-- ponto: o Sinarm-CAC é um site dentro da gestão da PF (o CR deferido sai em
-- nome do Exército); com a documentação conferida, a EQUIPE entra com a senha
-- GOV do cliente, cadastra o cliente, entrega os documentos em campos
-- individuais, o sistema libera o boleto (GRU), o cliente paga, e após a
-- compensação bancária o processo entra em "Pronto para análise" — primeiro
-- status no órgão, onde fica até pendência, deferimento ou indeferimento.
--
-- A) A senha GOV vira o PRIMEIRO item do grupo Requerimento — sem ela a
--    equipe nem cadastra o cliente. Estava depois do boleto.
--
-- B) NÃO existe juntada final assinada no CR: os documentos entram em campos
--    individuais, e cada DECLARAÇÃO é assinada no gov.br separadamente, com a
--    cadeia de certificados verificada na entrega (mesma verificação do
--    contrato e da procuração). Então: o item de juntada sai do CR, e as
--    declarações ganham `assinatura_requerida: govbr`, que aciona a
--    verificação de cadeia já existente.
--
-- C) O requerimento é marco da EQUIPE (`emissor: quero_armas`), não tarefa do
--    cliente. O boleto também: a equipe o obtém no sistema e envia. Do cliente
--    são só a senha GOV e o comprovante de pagamento.
--
-- Nada é apagado do catálogo (a juntada vira ativo=false). Nos processos EM
-- ABERTO, a linha pendente de juntada é removida — mesmo critério da troca de
-- modalidade: linha pendente que não corresponde a exigência real sai; linha
-- entregue jamais.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

-- ── A) Senha GOV abre o grupo Requerimento ──────────────────────────────────
UPDATE public.qa_servicos_documentos
   SET ordem           = 499,
       nome_documento  = 'Senha do gov.br para o protocolo',
       instrucoes      = 'Nossa equipe usa o seu acesso gov.br para cadastrar você no Sinarm-CAC '
                         || 'da Polícia Federal e entregar seus documentos. Sem ele o protocolo não começa.',
       observacoes_cliente = 'Forneça a senha pelo canal seguro indicado pela equipe — nunca por e-mail.',
       regra_validacao = COALESCE(regra_validacao, '{}'::jsonb)
                         || jsonb_build_object('grupo_checklist', 'requerimento',
                                               'ordem_grupo_checklist', 69),
       updated_at      = now()
 WHERE servico_id = 44 AND tipo_documento = 'credencial_gov_br';

-- ── B1) Juntada não existe no CR ────────────────────────────────────────────
UPDATE public.qa_servicos_documentos
   SET ativo = false, updated_at = now()
 WHERE servico_id = 44 AND tipo_documento = 'juntada_assinada';

-- Nos processos em aberto, a linha pendente de juntada sai. Linha já entregue
-- (não há nenhuma) ficaria.
DELETE FROM public.qa_processo_documentos pd
 USING public.qa_processos p
 WHERE p.id = pd.processo_id
   AND p.servico_id = 44
   AND public.qa_processo_em_aberto(p.status)
   AND pd.tipo_documento = 'juntada_assinada'
   AND pd.status = 'pendente';

-- ── B2) Cada declaração é assinada no gov.br, com cadeia verificada ─────────
UPDATE public.qa_servicos_documentos
   SET regra_validacao = COALESCE(regra_validacao, '{}'::jsonb)
                         || jsonb_build_object('assinatura_requerida', 'govbr'),
       updated_at      = now()
 WHERE servico_id = 44
   AND ativo
   AND tipo_documento IN (
     'declaracao_responsavel_imovel',
     'declaracao_sem_inquerito_processo_criminal',
     'declaracao_compromisso_habitualidade',
     'dsa_declaracao_seguranca_acervo',
     'declaracao_endereco_acervo',
     'declaracao_guarda_acervo_2enderecos',
     'declaracao_nao_possuir_segundo_endereco'
   );

-- O mesmo carimbo nas linhas correspondentes dos processos em aberto.
UPDATE public.qa_processo_documentos pd
   SET regra_validacao = COALESCE(pd.regra_validacao, '{}'::jsonb)
                         || jsonb_build_object('assinatura_requerida', 'govbr'),
       updated_at      = now()
  FROM public.qa_processos p
 WHERE p.id = pd.processo_id
   AND p.servico_id = 44
   AND public.qa_processo_em_aberto(p.status)
   AND pd.tipo_documento IN (
     'declaracao_responsavel_imovel',
     'declaracao_sem_inquerito_processo_criminal',
     'declaracao_compromisso_habitualidade',
     'dsa_declaracao_seguranca_acervo',
     'declaracao_endereco_acervo',
     'declaracao_guarda_acervo_2enderecos',
     'declaracao_nao_possuir_segundo_endereco'
   );

-- ── C) O protocolo é da equipe; o cliente acompanha ─────────────────────────
UPDATE public.qa_servicos_documentos
   SET emissor         = 'quero_armas',
       nome_documento  = 'Cadastro e entrega dos documentos no Sinarm-CAC',
       instrucoes      = 'Nossa equipe cadastra você no Sinarm-CAC da Polícia Federal e entrega '
                         || 'toda a sua documentação, campo a campo, usando o seu acesso gov.br. '
                         || 'Você acompanha por aqui — não precisa fazer nada nesta etapa.',
       observacoes_cliente = 'Com os documentos entregues, o sistema libera o boleto da taxa. '
                         || 'Depois do seu pagamento e da compensação bancária, o processo entra '
                         || 'em "Pronto para análise" na Polícia Federal.',
       updated_at      = now()
 WHERE servico_id = 44 AND tipo_documento = 'requerimento_cr';

UPDATE public.qa_servicos_documentos
   SET emissor         = 'quero_armas',
       nome_documento  = 'Boleto da GRU — taxa do CR',
       instrucoes      = 'O boleto é liberado pelo Sinarm-CAC depois que a equipe entrega todos '
                         || 'os seus documentos. Nós o enviamos para você pagar.',
       observacoes_cliente = 'Pague assim que receber — o processo só entra na fila de análise '
                         || 'depois da compensação bancária.',
       updated_at      = now()
 WHERE servico_id = 44 AND tipo_documento = 'gru';

UPDATE public.qa_servicos_documentos
   SET nome_documento  = 'Comprovante de pagamento da taxa (GRU)',
       instrucoes      = 'Pague o boleto que enviamos e anexe aqui o comprovante.',
       observacoes_cliente = 'Sem a taxa paga e compensada o processo não entra em análise.',
       updated_at      = now()
 WHERE servico_id = 44 AND tipo_documento = 'gru_comprovante';

-- Espelha nome/ordem/emissor nas linhas dos processos em aberto.
UPDATE public.qa_processo_documentos pd
   SET nome_documento = sd.nome_documento,
       instrucoes     = sd.instrucoes,
       observacoes_cliente = sd.observacoes_cliente,
       ordem          = sd.ordem,
       regra_validacao = COALESCE(pd.regra_validacao, '{}'::jsonb)
                         || jsonb_build_object('grupo_checklist', sd.regra_validacao ->> 'grupo_checklist',
                                               'ordem_grupo_checklist',
                                               (sd.regra_validacao ->> 'ordem_grupo_checklist')::int),
       updated_at     = now()
  FROM public.qa_processos p, public.qa_servicos_documentos sd
 WHERE p.id = pd.processo_id
   AND p.servico_id = 44
   AND public.qa_processo_em_aberto(p.status)
   AND sd.servico_id = 44
   AND sd.tipo_documento = pd.tipo_documento
   AND sd.ativo
   AND pd.tipo_documento IN ('credencial_gov_br', 'requerimento_cr', 'gru', 'gru_comprovante');

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- 1) O grupo Requerimento na ordem nova — senha GOV abrindo, sem juntada:
--
-- SELECT ordem, tipo_documento, emissor,
--        regra_validacao ->> 'ordem_grupo_checklist' AS ordem_no_grupo
--   FROM public.qa_servicos_documentos
--  WHERE servico_id = 44 AND ativo
--    AND (regra_validacao ->> 'grupo_checklist') = 'requerimento'
--  ORDER BY ordem;
--
-- Esperado: 4 linhas — credencial_gov_br (499, cliente), requerimento_cr
-- (500, quero_armas), gru (501, quero_armas), gru_comprovante (502, cliente).
--
-- 2) As 7 declarações do CR com a assinatura gov.br exigida:
--
-- SELECT tipo_documento, regra_validacao ->> 'assinatura_requerida' AS assinatura
--   FROM public.qa_servicos_documentos
--  WHERE servico_id = 44 AND ativo
--    AND regra_validacao ->> 'assinatura_requerida' IS NOT NULL
--  ORDER BY ordem;
--
-- 3) Nenhuma juntada sobrando nos processos abertos:
--
-- SELECT count(*) AS juntadas_restantes
--   FROM public.qa_processo_documentos pd
--   JOIN public.qa_processos p ON p.id = pd.processo_id
--  WHERE p.servico_id = 44 AND pd.tipo_documento = 'juntada_assinada'
--    AND public.qa_processo_em_aberto(p.status);
--
-- Esperado: 0.
