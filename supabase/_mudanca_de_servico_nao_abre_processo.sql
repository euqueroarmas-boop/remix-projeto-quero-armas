-- ============================================================================
-- MUDANÇA DE SERVIÇO (POSSE → CR) NÃO ABRE PROCESSO SOZINHA
--
-- O que está acontecendo: a venda do pacote da posse leva três itens
-- (autorização de compra, CRAF/GT e mudança de serviço). Quando o contrato é
-- assinado, a liberação abre um processo para CADA item da venda — e o
-- checklist da mudança de serviço cai em cima do cliente sem ninguém ter
-- decidido migrar. Foi assim no Ricardo e agora no Marcio.
--
-- A liberação já sabe respeitar o catálogo: item com `gera_processo = false`
-- é liberado (a solicitação fica registrada, o cliente pagou por ele) mas NÃO
-- vira processo nem checklist. É essa chave que este script vira.
--
-- Quando o cliente quiser migrar, a Equipe abre o processo na tela da venda
-- ("Gerar processo") — esse caminho continua funcionando normalmente.
--
-- Nada é apagado: os processos que já nasceram assim viram 'cancelado' com
-- evento, e a solicitação volta a "contratado, processo não aberto".
-- ============================================================================

BEGIN;

-- 1) O catálogo para de mandar abrir processo para este item ------------------
UPDATE public.qa_servicos_catalogo
   SET gera_processo = false,
       updated_at    = now()
 WHERE slug = 'mudanca-servico';

-- 2) Registra o motivo em cada processo que já tinha nascido sozinho ---------
INSERT INTO public.qa_processo_eventos (processo_id, tipo_evento, descricao, ator, dados_json)
SELECT p.id,
       'processo_cancelado_mudanca_nao_autorizada',
       'Processo cancelado: o checklist da mudança de serviço (posse → CR) só deve ser aberto quando o cliente decidir migrar. Foi aberto automaticamente pela liberação do contrato.',
       'sistema',
       jsonb_build_object('servico_id', p.servico_id, 'venda_id', p.venda_id,
                          'status_anterior', p.status)
  FROM public.qa_processos p
  JOIN public.qa_servicos_catalogo c ON c.servico_id = p.servico_id
 WHERE c.slug = 'mudanca-servico'
   AND p.status IN ('aguardando_pagamento', 'aguardando_assinatura', 'aguardando_documentos');

-- 3) Cancela esses processos (só os que ainda estão no começo) ---------------
UPDATE public.qa_processos p
   SET status = 'cancelado'
  FROM public.qa_servicos_catalogo c
 WHERE c.servico_id = p.servico_id
   AND c.slug = 'mudanca-servico'
   AND p.status IN ('aguardando_pagamento', 'aguardando_assinatura', 'aguardando_documentos');

-- 4) A solicitação continua vendida, mas sem processo aberto -----------------
UPDATE public.qa_solicitacoes_servico s
   SET status_servico  = 'contratado',
       status_processo = 'processo_nao_aberto',
       processo_id     = NULL,
       updated_at      = now()
 WHERE s.service_slug = 'mudanca-servico'
   AND (s.status_processo <> 'processo_nao_aberto' OR s.processo_id IS NOT NULL);

COMMIT;

-- ── Conferência: quem foi tocado e como ficou o catálogo ────────────────────
SELECT 'catalogo' AS bloco,
       c.slug     AS quem,
       jsonb_build_object('gera_processo', c.gera_processo,
                          'servico_id', c.servico_id) AS situacao
  FROM public.qa_servicos_catalogo c
 WHERE c.slug = 'mudanca-servico'

UNION ALL

SELECT 'processos de mudanca de servico',
       cl.nome_completo,
       jsonb_build_object('processo_id', p.id,
                          'venda_id', p.venda_id,
                          'status', p.status,
                          'criado_em', p.data_criacao)
  FROM public.qa_processos p
  JOIN public.qa_servicos_catalogo c ON c.servico_id = p.servico_id
  JOIN public.qa_clientes cl ON cl.id = p.cliente_id
 WHERE c.slug = 'mudanca-servico'

 ORDER BY 1, 2;
