-- ============================================================================
-- A PETIÇÃO VOLTA PARA O CLIENTE APROVAR
-- ----------------------------------------------------------------------------
-- Furo levantado na primeira mensagem da auditoria, 18/08/2026.
--
-- As peças geradas pela IA (defesa de posse, defesa de porte, resposta à
-- notificação) vivem inteiras na área da equipe. NENHUMA tela do portal do
-- cliente lê `qa_geracoes_pecas`. Ou seja: o documento que sustenta o pedido
-- dele — que a Polícia Federal vai ler e que decide o processo — é escrito,
-- revisado e protocolado sem que ele veja uma linha.
--
-- Hoje só duas coisas voltam para o cliente aprovar: o relato da efetiva
-- necessidade e o relato do recurso. A peça principal, não.
--
-- POR QUE ISSO IMPORTA E NÃO É FORMALIDADE: petição protocolada com fato errado
-- não se conserta — vira parte do processo, e a autoridade seguinte lê aquilo.
-- Nos indeferimentos reais que analisamos, dois motivos não tinham nada a ver
-- com mérito: divergência de nome e de endereço entre o que foi declarado e o
-- que os documentos diziam. Quem pega isso é o cliente, não o revisor.
--
-- Esta migration dá à peça o ciclo que o recurso já tem:
--   nao_enviada → aguardando_cliente → aprovada
--                                   ↘ devolvida (cliente pediu ajuste)
--
-- O aceite guarda prova de sessão (IP, agente, idioma, hash do texto), no mesmo
-- padrão de `qa_efetiva_necessidade` — MP 2.200-2/2001.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

ALTER TABLE public.qa_geracoes_pecas
  -- A peça nasceu de um caso, mas quem vai à delegacia é o PROCESSO. Sem este
  -- vínculo não há como saber em qual fila do cliente ela entra, nem como
  -- travar o protocolo enquanto ela não for aprovada.
  ADD COLUMN IF NOT EXISTS processo_id uuid REFERENCES public.qa_processos(id) ON DELETE SET NULL,

  ADD COLUMN IF NOT EXISTS status_cliente text NOT NULL DEFAULT 'nao_enviada',
  ADD COLUMN IF NOT EXISTS enviada_cliente_em timestamptz,
  ADD COLUMN IF NOT EXISTS enviada_cliente_por uuid,

  -- O texto que o cliente de fato aprovou. Pode diferir de `minuta_gerada`:
  -- ele corrige data, nome de rua, número de boletim — e a correção dele é a
  -- que vale, porque quem viveu o fato é ele.
  ADD COLUMN IF NOT EXISTS texto_final text,
  ADD COLUMN IF NOT EXISTS editada_pelo_cliente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS aprovada_cliente_em timestamptz,

  -- Prova de sessão do aceite eletrônico (MP 2.200-2/2001), igual à efetiva
  -- necessidade. Nunca é apagada.
  ADD COLUMN IF NOT EXISTS aprovacao_ip text,
  ADD COLUMN IF NOT EXISTS aprovacao_user_agent text,
  ADD COLUMN IF NOT EXISTS aprovacao_accept_language text,
  ADD COLUMN IF NOT EXISTS aprovacao_hash text,

  -- Cliente leu e pediu ajuste. O motivo é dele, com as palavras dele.
  ADD COLUMN IF NOT EXISTS devolucao_motivo text,
  ADD COLUMN IF NOT EXISTS devolvida_em timestamptz;

-- Vocabulário fechado. Idempotente.
ALTER TABLE public.qa_geracoes_pecas
  DROP CONSTRAINT IF EXISTS qa_geracoes_pecas_status_cliente_check;
ALTER TABLE public.qa_geracoes_pecas
  ADD CONSTRAINT qa_geracoes_pecas_status_cliente_check CHECK (
    status_cliente = ANY (ARRAY['nao_enviada','aguardando_cliente','aprovada','devolvida'])
  );

COMMENT ON COLUMN public.qa_geracoes_pecas.status_cliente IS
  'Ciclo de aprovacao pelo cliente: nao_enviada -> aguardando_cliente -> aprovada (ou devolvida).';
COMMENT ON COLUMN public.qa_geracoes_pecas.texto_final IS
  'O texto que o cliente aprovou. Vence minuta_gerada — a correcao de quem viveu o fato e a que vale.';
COMMENT ON COLUMN public.qa_geracoes_pecas.processo_id IS
  'Processo a que a peca pertence. Define em qual fila do cliente ela entra e trava o protocolo ate ser aprovada.';

-- A fila do cliente e o gate do protocolo consultam por aqui.
CREATE INDEX IF NOT EXISTS idx_qa_geracoes_pecas_processo_status
  ON public.qa_geracoes_pecas (processo_id, status_cliente)
  WHERE processo_id IS NOT NULL;

COMMIT;

-- ── CONFERÊNCIA ─────────────────────────────────────────────────────────────
-- (a) As colunas existem. Esperado: 12 linhas.
--
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'qa_geracoes_pecas'
--    AND column_name IN ('processo_id','status_cliente','enviada_cliente_em',
--                        'enviada_cliente_por','texto_final','editada_pelo_cliente',
--                        'aprovada_cliente_em','aprovacao_ip','aprovacao_user_agent',
--                        'aprovacao_accept_language','aprovacao_hash','devolucao_motivo')
--  ORDER BY column_name;
--
-- (b) Panorama das peças por estado de aprovação:
--
-- SELECT status_cliente, count(*) AS pecas,
--        count(*) FILTER (WHERE processo_id IS NULL) AS sem_processo
--   FROM public.qa_geracoes_pecas
--  GROUP BY status_cliente
--  ORDER BY status_cliente;
--
-- Toda peça antiga nasce 'nao_enviada' — nada muda de comportamento sozinho.
-- A equipe é quem envia, uma a uma.
