-- ============================================================================
-- CR: DEGA é sempre exigida, e o segundo endereço sempre gera declaração
-- ----------------------------------------------------------------------------
-- Correção guiada pelos 4 dossiês DEFERIDOS entregues pelo titular em 19/08
-- (Rivelino, Wellington, Augusto e Fabrício — todos atirador, todos com o CR
-- emitido). Nos quatro, sem exceção:
--
--   • item 3 do dossiê — "Declaração de endereço de guarda do acervo" (DEGA)
--     está SEMPRE presente e assinada. Ela declara ONDE o acervo fica (em
--     geral a própria residência). Eu a tinha condicionado a existir um
--     segundo endereço — errado: a declaração do endereço PRINCIPAL é
--     obrigatória para todo mundo.
--
--   • item 11 do dossiê — sobre o SEGUNDO endereço, sempre há uma declaração,
--     positiva ou negativa: quem tem, declara o segundo endereço; quem não
--     tem, assina a "Declaração de NÃO possuir segundo endereço" (foi o que
--     Wellington e Fabrício entregaram). No meu desenho, quem respondia "não"
--     não entregava nada — e o dossiê ia para o protocolo sem o item 11.
--
-- O QUE ESTE BLOCO FAZ
--   1. DEGA vira obrigatória e incondicional no serviço 44;
--   2. a pergunta do segundo endereço passa a abrir uma das duas declarações:
--      "sim" → declaração do 2º endereço de guarda;
--      "não" → declaração de não possuir segundo endereço;
--   3. acerta os processos de CR EM ABERTO: DEGA deles vira obrigatória e as
--      duas declarações condicionais entram via reexplosão (aditiva — nunca
--      apaga nem duplica).
--
-- Os dois tipos já existem no vocabulário fechado do catálogo
-- (`declaracao_guarda_acervo_2enderecos` e
-- `declaracao_nao_possuir_segundo_endereco`) e no CHECK de
-- qa_documentos_cliente — nenhum ALTER de constraint é necessário.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

-- ── 1) DEGA sempre, para todos ──────────────────────────────────────────────
UPDATE public.qa_servicos_documentos
   SET obrigatorio     = true,
       nome_documento  = 'DEGA — Declaração de Endereço de Guarda do Acervo',
       instrucoes      = 'Declara o endereço onde o acervo será guardado — em geral, a própria '
                         || 'residência. Todo requerente entrega, tenha ou não segundo endereço.',
       observacoes_cliente = 'A declaração é assinada no gov.br.',
       -- sai a condição; fica o grupo
       regra_validacao = (COALESCE(regra_validacao, '{}'::jsonb) - 'depende_de'),
       updated_at      = now()
 WHERE servico_id = 44
   AND tipo_documento = 'declaracao_endereco_acervo';

-- ── 2) Segundo endereço: declaração positiva OU negativa, nunca nada ────────
INSERT INTO public.qa_servicos_documentos (
  servico_id, tipo_documento, nome_documento, etapa, ordem, obrigatorio,
  obrigatorio_etapa02, ativo, emissor, escopo, formato_aceito,
  condicao_profissional, condicao_modalidade, validade_dias, orgao_emissor,
  instrucoes, observacoes_cliente, regra_validacao
)
SELECT 44, v.tipo, v.nome, 'complementar', v.ordem, true,
       false, true, 'cliente', 'permanente', ARRAY['pdf','jpg','jpeg','png'],
       NULL, NULL, NULL, NULL,
       v.instrucoes, 'A declaração é assinada no gov.br.',
       jsonb_build_object(
         'grupo_checklist',       v.grupo,
         'ordem_grupo_checklist', v.ordem_grupo,
         'exige_quando',          jsonb_build_object('segundo_endereco_acervo', v.resposta),
         'depende_de',            jsonb_build_object('chave', 'segundo_endereco_acervo',
                                                     'valor', v.resposta)
       )
  FROM (VALUES
    ('declaracao_guarda_acervo_2enderecos',
     'Declaração do 2º endereço de guarda do acervo',
     446, 'arma', 56, 'sim',
     'Declara o segundo endereço onde parte do acervo ficará guardada.'),
    ('declaracao_nao_possuir_segundo_endereco',
     'Declaração de NÃO possuir segundo endereço de guarda',
     447, 'endereco', 26, 'nao',
     'Você declara que guarda todo o acervo em um único endereço. '
     || 'Entra no dossiê no lugar do comprovante de segundo endereço.')
  ) AS v(tipo, nome, ordem, grupo, ordem_grupo, resposta, instrucoes)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.qa_servicos_documentos sd
    WHERE sd.servico_id = 44
      AND sd.tipo_documento = v.tipo
      AND sd.condicao_profissional IS NULL
 );

-- ── 3) Acerto dos processos de CR em aberto ─────────────────────────────────
-- 3a. A DEGA que já está nos processos vira obrigatória e incondicional.
UPDATE public.qa_processo_documentos pd
   SET obrigatorio     = true,
       nome_documento  = 'DEGA — Declaração de Endereço de Guarda do Acervo',
       regra_validacao = (COALESCE(pd.regra_validacao, '{}'::jsonb) - 'depende_de'),
       updated_at      = now()
  FROM public.qa_processos p
 WHERE p.id = pd.processo_id
   AND p.servico_id = 44
   AND public.qa_processo_em_aberto(p.status)
   AND pd.tipo_documento = 'declaracao_endereco_acervo';

-- 3b. Reexplosão aditiva: entra o que falta (as duas declarações novas),
--     nada é apagado nem duplicado.
DO $$
DECLARE
  r     record;
  v_res record;
BEGIN
  FOR r IN
    SELECT p.id FROM public.qa_processos p
     WHERE p.servico_id = 44 AND public.qa_processo_em_aberto(p.status)
  LOOP
    SELECT * INTO v_res FROM public.qa_explodir_checklist_processo(r.id);
    RAISE NOTICE 'Processo %: % exigência(s) inserida(s)', r.id, v_res.inseridos;
  END LOOP;
END $$;

COMMIT;

-- ── Conferência ─────────────────────────────────────────────────────────────
-- 1) O trio do acervo no catálogo do serviço 44 — DEGA obrigatória e
--    incondicional, e as duas declarações condicionadas à resposta:
--
-- SELECT ordem, tipo_documento, obrigatorio,
--        regra_validacao -> 'exige_quando' AS exige_quando
--   FROM public.qa_servicos_documentos
--  WHERE servico_id = 44 AND ativo
--    AND tipo_documento IN ('declaracao_endereco_acervo',
--                           'declaracao_guarda_acervo_2enderecos',
--                           'declaracao_nao_possuir_segundo_endereco',
--                           'pergunta_segundo_endereco_acervo')
--  ORDER BY ordem;
--
-- Esperado: 4 linhas — a pergunta (445), a do 2º endereço (446, exige sim),
-- a de não possuir (447, exige nao) e a DEGA (450, sem exige_quando).
--
-- 2) Os dois processos abertos com as duas declarações novas dentro:
--
-- SELECT pd.processo_id, pd.tipo_documento, pd.status, pd.obrigatorio
--   FROM public.qa_processo_documentos pd
--   JOIN public.qa_processos p ON p.id = pd.processo_id
--  WHERE p.servico_id = 44 AND public.qa_processo_em_aberto(p.status)
--    AND pd.tipo_documento IN ('pergunta_segundo_endereco_acervo',
--                              'declaracao_guarda_acervo_2enderecos',
--                              'declaracao_nao_possuir_segundo_endereco')
--  ORDER BY pd.processo_id, pd.tipo_documento;
