-- =============================================================================
-- TRAVA DO PROTOCOLO SEM DEFESA — 20/08/2026
-- -----------------------------------------------------------------------------
-- Regra do titular: em serviço SINARM a defesa vem ANTES da GRU. A equipe
-- monta a peça, o cliente aprova, e só então o processo libera taxa/juntada.
--
-- O furo: nada impedia marcar `pronto_para_protocolar` sem peça aprovada — e é
-- essa marcação que abre a cobrança da GRU no portal. Em 20/08 havia 9 clientes
-- com a etapa final criada e nenhuma defesa; nenhum pagou ainda porque a
-- liberação não aconteceu. Esta trava garante que ela não aconteça sem defesa.
--
-- Serviço fora do catálogo não é bloqueado (senão a operação trava sem saída);
-- o painel continua acusando a fase da PET nesses casos.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.qa_trava_protocolo_sem_defesa()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_exige boolean;
BEGIN
  IF NEW.status = 'pronto_para_protocolar'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN

    SELECT sc.exige_peca_defesa INTO v_exige
      FROM public.qa_servicos_catalogo sc
     WHERE sc.servico_id = NEW.servico_id;

    IF COALESCE(v_exige, false) THEN
      IF NOT EXISTS (
        SELECT 1
          FROM public.qa_geracoes_pecas g
         WHERE g.status_cliente = 'aprovada'
           AND (g.processo_id = NEW.id
                OR (g.processo_id IS NULL AND g.cliente_id = NEW.cliente_id))
      ) THEN
        RAISE EXCEPTION
          'Este serviço exige DEFESA APROVADA PELO CLIENTE antes de liberar o protocolo. Gere a peça, envie ao cliente e aguarde a aprovação — só então o processo pode virar PRONTO PARA PROTOCOLAR. (processo %, serviço %)',
          NEW.id, NEW.servico_nome;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qa_trg_trava_protocolo_sem_defesa ON public.qa_processos;
CREATE TRIGGER qa_trg_trava_protocolo_sem_defesa
  BEFORE INSERT OR UPDATE ON public.qa_processos
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_trava_protocolo_sem_defesa();
