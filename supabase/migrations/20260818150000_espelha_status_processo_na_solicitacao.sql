-- ============================================================================
-- A SEGUNDA VERDADE: o processo anda e a solicitação fica parada
-- ----------------------------------------------------------------------------
-- Achado da REAUDITORIA de 18/08/2026, depois de fechados os 18 furos originais.
--
-- Existem dois lugares que guardam "onde está o processo":
--   • `qa_processos.status`               — o que a Equipe opera
--   • `qa_solicitacoes_servico.status_servico` — o que os KPIs, o Arsenal e a
--                                            aba Serviços mostram ao cliente
--
-- Até a metade do fluxo eles conversam: `qa_recalcular_status_servico` deriva o
-- status da solicitação a partir do progresso do checklist. Mas ela tem esta
-- guarda logo no começo:
--
--     IF v_atual IN ('enviado_ao_orgao','em_analise_orgao','notificado',
--                    'restituido','recurso_administrativo','deferido',
--                    'indeferido','finalizado') THEN RETURN;
--
-- Ou seja: a partir do protocolo, ela sai de cena — e NINGUÉM assume. O único
-- ponto do sistema que escreve esses status é um popover manual
-- (`SolicitacaoStatusPopover`), em que alguém escolhe na mão.
--
-- Resultado prático: agora que o processo avança sozinho (protocolado,
-- notificado, recurso, deferido), a solicitação continua marcada
-- "PRONTO PARA PROTOCOLO" — e é ela que o cliente vê no Arsenal e que alimenta
-- os KPIs. Processo deferido aparecendo como pronto para protocolar é
-- exatamente o "KPI verde com problema" que a Regra-Mãe proíbe.
--
-- ── POR QUE GATILHO, E NÃO CHAMADA NAS EDGES ────────────────────────────────
-- São muitos os pontos que mexem em `qa_processos.status`: o painel, quatro
-- edge functions, o webhook do Asaas. Espalhar a cópia por todos eles é garantir
-- que o próximo ponto novo esqueça. No gatilho é um lugar só, e cobre até quem
-- escrever direto pelo SQL Editor.
--
-- ── DIVISÃO DE TRABALHO, SEM BRIGA ──────────────────────────────────────────
-- Este gatilho trata SOMENTE os status pós-protocolo — exatamente aqueles em
-- que `qa_recalcular_status_servico` desiste. Antes do protocolo, quem manda
-- continua sendo ela, pelo progresso do checklist. Os dois nunca disputam a
-- mesma linha.
--
-- Reexecutável.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.qa_espelhar_status_processo_na_solicitacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_novo   text;
  v_atual  text;
BEGIN
  -- Só reage a mudança real de status, e só quando há solicitação ligada.
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF NEW.solicitacao_id IS NULL THEN RETURN NEW; END IF;

  -- Mapa processo → serviço. Só o trecho pós-protocolo: antes disso quem
  -- decide é qa_recalcular_status_servico, pelo progresso do checklist.
  v_novo := CASE NEW.status
    WHEN 'protocolado'            THEN 'enviado_ao_orgao'
    WHEN 'em_analise_orgao'       THEN 'em_analise_orgao'
    WHEN 'notificado'             THEN 'notificado'
    WHEN 'recurso_administrativo' THEN 'recurso_administrativo'
    WHEN 'deferido'               THEN 'deferido'
    WHEN 'indeferido'             THEN 'indeferido'
    WHEN 'concluido'              THEN 'finalizado'
    ELSE NULL
  END;

  IF v_novo IS NULL THEN RETURN NEW; END IF;

  SELECT status_servico INTO v_atual
    FROM public.qa_solicitacoes_servico
   WHERE id = NEW.solicitacao_id;

  IF v_atual IS NULL OR v_atual = v_novo THEN RETURN NEW; END IF;

  -- `finalizado` é terminal: não se volta dele por espelhamento.
  IF v_atual = 'finalizado' THEN RETURN NEW; END IF;

  -- O guarda de transições de `qa_solicitacoes_servico` recusa saltos legítimos
  -- daqui (ex.: `aguardando_documentacao` → `enviado_ao_orgao`, que acontece
  -- quando a equipe protocola um processo cujo checklist ficou incompleto por
  -- decisão dela). A máquina de estados do PROCESSO é a autoridade; a
  -- solicitação espelha. Mesmo bypass que `qa_recalcular_status_servico` usa.
  PERFORM set_config('qa.bypass_transicao', 'on', true);
  UPDATE public.qa_solicitacoes_servico
     SET status_servico = v_novo,
         updated_at     = now()
   WHERE id = NEW.solicitacao_id;
  PERFORM set_config('qa.bypass_transicao', 'off', true);

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Espelho quebrado NÃO pode derrubar o avanço do processo. O protocolo, o
  -- deferimento e o recurso são o dado que não pode se perder; o status da
  -- solicitação é leitura derivada e se conserta depois.
  RAISE WARNING 'qa_espelhar_status_processo_na_solicitacao falhou (processo %): %',
    NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_qa_processos_espelha_solicitacao ON public.qa_processos;
CREATE TRIGGER trg_qa_processos_espelha_solicitacao
  AFTER UPDATE OF status ON public.qa_processos
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_espelhar_status_processo_na_solicitacao();

-- ── BACKFILL: alinha o que já divergiu ──────────────────────────────────────
-- Roda o mesmo mapa sobre os processos que já passaram do protocolo e cuja
-- solicitação ficou para trás.
DO $backfill$
DECLARE
  r record;
  v_novo text;
  v_n int := 0;
BEGIN
  PERFORM set_config('qa.bypass_transicao', 'on', true);
  FOR r IN
    SELECT p.id, p.status, p.solicitacao_id, s.status_servico
      FROM public.qa_processos p
      JOIN public.qa_solicitacoes_servico s ON s.id = p.solicitacao_id
     WHERE p.status IN ('protocolado','em_analise_orgao','notificado',
                        'recurso_administrativo','deferido','indeferido','concluido')
  LOOP
    v_novo := CASE r.status
      WHEN 'protocolado'            THEN 'enviado_ao_orgao'
      WHEN 'em_analise_orgao'       THEN 'em_analise_orgao'
      WHEN 'notificado'             THEN 'notificado'
      WHEN 'recurso_administrativo' THEN 'recurso_administrativo'
      WHEN 'deferido'               THEN 'deferido'
      WHEN 'indeferido'             THEN 'indeferido'
      WHEN 'concluido'              THEN 'finalizado'
    END;
    IF v_novo IS DISTINCT FROM r.status_servico AND r.status_servico <> 'finalizado' THEN
      UPDATE public.qa_solicitacoes_servico
         SET status_servico = v_novo, updated_at = now()
       WHERE id = r.solicitacao_id;
      v_n := v_n + 1;
    END IF;
  END LOOP;
  PERFORM set_config('qa.bypass_transicao', 'off', true);
  RAISE NOTICE 'Solicitacoes realinhadas: %', v_n;
END
$backfill$;

COMMIT;

-- ── CONFERÊNCIA ─────────────────────────────────────────────────────────────
-- Esperado: ZERO linhas. Cada linha aqui é um processo cujo status o cliente
-- vê errado no Arsenal e que entra torto nos KPIs.
--
-- SELECT p.id, p.status AS processo, s.status_servico AS solicitacao
--   FROM public.qa_processos p
--   JOIN public.qa_solicitacoes_servico s ON s.id = p.solicitacao_id
--  WHERE (p.status, s.status_servico) NOT IN (
--          ('protocolado','enviado_ao_orgao'),
--          ('em_analise_orgao','em_analise_orgao'),
--          ('notificado','notificado'),
--          ('recurso_administrativo','recurso_administrativo'),
--          ('deferido','deferido'),
--          ('indeferido','indeferido'),
--          ('concluido','finalizado'))
--    AND p.status IN ('protocolado','em_analise_orgao','notificado',
--                     'recurso_administrativo','deferido','indeferido','concluido')
--    AND s.status_servico <> 'finalizado';
