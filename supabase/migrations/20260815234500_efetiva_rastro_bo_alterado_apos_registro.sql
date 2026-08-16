-- ============================================================================
-- Efetiva necessidade — rastro do boletim: quem mudou o texto, e quando.
--
-- Regra do usuário (15/08/2026): o carimbo `bo_registro_confirmado_em` NUNCA é
-- apagado. Ele é a prova de que o cliente declarou o registro naquela data.
--
-- O que faltava era o outro lado da prova: quando o cliente acrescenta um fato
-- novo DEPOIS de declarar o registro e manda refazer o texto, o texto que vai
-- para a delegacia muda — e o boletim que ele registrou deixa de cobrir o texto
-- atual. Amanhã, se ele disser "não mudei nada", a auditoria mostra a data da
-- declaração dele, a data em que ele mesmo mandou mudar, e quantos fatos ele
-- acrescentou no meio. A alteração partiu do cliente, e fica registrado que
-- partiu dele.
--
-- Reusa a tabela de auditoria que já existe (qa_efetiva_necessidade_auditoria),
-- em vez de criar tabela nova. O gatilho é um TRIGGER no banco porque o clique
-- do "Já registrei o boletim" é gravado direto pelo navegador do cliente — uma
-- edge function nunca veria esse evento.
-- ============================================================================

BEGIN;

-- ─── 1. A auditoria passa a aceitar os dois eventos do boletim ──────────────
ALTER TABLE public.qa_efetiva_necessidade_auditoria
  DROP CONSTRAINT IF EXISTS qa_efetiva_necessidade_auditoria_acao_check;

ALTER TABLE public.qa_efetiva_necessidade_auditoria
  ADD CONSTRAINT qa_efetiva_necessidade_auditoria_acao_check
  CHECK (acao IN (
    'aceite_cliente',
    'enviado_revisao',
    'aprovado_equipe',
    'devolvido_equipe',
    'reaberto',
    -- Novos: o cliente declarou que registrou o BO / o cliente mudou o texto
    -- do BO depois de ter declarado o registro.
    'bo_registro_declarado',
    'bo_texto_alterado_apos_registro'
  ));

-- ─── 2. O motor do rastro ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.qa_efetiva_rastro_bo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fatos integer;
BEGIN
  -- (a) O cliente declarou que registrou o boletim.
  IF NEW.bo_registro_confirmado_em IS NOT NULL
     AND NEW.bo_registro_confirmado_em IS DISTINCT FROM OLD.bo_registro_confirmado_em
  THEN
    INSERT INTO public.qa_efetiva_necessidade_auditoria
      (efetiva_id, cliente_id, acao, status_anterior, status_novo, autor_tipo, observacao)
    VALUES (
      NEW.id, NEW.cliente_id, 'bo_registro_declarado', OLD.status, NEW.status, 'cliente',
      'O cliente declarou no portal que já registrou o boletim na delegacia, em '
        || to_char(NEW.bo_registro_confirmado_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
        || '. A declaração é dele; o documento continua sendo exigido no passo "Enviar o boletim".'
    );
  END IF;

  -- (b) O texto do boletim mudou DEPOIS da declaração do cliente.
  --     `texto_bo_gerado_em` só avança quando o texto realmente muda, então
  --     regerar sem alteração não gera evento falso.
  IF NEW.texto_bo_gerado_em IS NOT NULL
     AND NEW.texto_bo_gerado_em IS DISTINCT FROM OLD.texto_bo_gerado_em
     AND OLD.bo_registro_confirmado_em IS NOT NULL
     AND NEW.texto_bo_gerado_em > OLD.bo_registro_confirmado_em
  THEN
    SELECT count(*) INTO v_fatos
      FROM public.qa_efetiva_necessidade_acrescimos a
     WHERE a.efetiva_necessidade_id = NEW.id
       AND a.created_at > OLD.bo_registro_confirmado_em;

    INSERT INTO public.qa_efetiva_necessidade_auditoria
      (efetiva_id, cliente_id, acao, status_anterior, status_novo, autor_tipo, observacao)
    VALUES (
      NEW.id, NEW.cliente_id, 'bo_texto_alterado_apos_registro', OLD.status, NEW.status, 'cliente',
      'O cliente havia declarado o registro do boletim em '
        || to_char(OLD.bo_registro_confirmado_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
        || '. Depois disso ele acrescentou ' || v_fatos || ' fato(s) novo(s) e mandou refazer o texto, '
        || 'que mudou em '
        || to_char(NEW.texto_bo_gerado_em AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI')
        || '. O boletim registrado não cobre mais o texto atual: o passo "Registrar o boletim" '
        || 'reabriu para aditamento. A alteração partiu do cliente. O carimbo da declaração anterior '
        || 'foi mantido.'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Postgres concede EXECUTE a PUBLIC por padrão; o trigger dispara mesmo sem ele.
REVOKE ALL ON FUNCTION public.qa_efetiva_rastro_bo() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_qa_efetiva_rastro_bo ON public.qa_efetiva_necessidade;
CREATE TRIGGER trg_qa_efetiva_rastro_bo
  AFTER UPDATE ON public.qa_efetiva_necessidade
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_efetiva_rastro_bo();

COMMIT;
