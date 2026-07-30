-- Auto-aprovação passa a exigir que o documento seja DO CLIENTE, não apenas
-- que esteja legível.
--
-- Antes: a trigger promovia para 'aprovado' com base só na confiança da
-- LEITURA (confianca >= 0.7 ou recomendacao = 'aceitar'). O cruzamento de
-- nome/CPF/nascimento contra o cadastro e os documentos já aprovados era
-- calculado no front, gravado em ia_dados_extraidos.tem_divergencia — e
-- ignorado na decisão. Um documento nítido de OUTRA pessoa era aprovado.
--
-- Também: documento que a IA não conseguiu identificar entrava como 'outro'
-- e era aprovado assim mesmo. Ficava no Hub aparentando resolvido, sem
-- cumprir exigência nenhuma e sem ninguém saber o que era.
--
-- Agora:
--   tipo 'outro' / DESCONHECIDO  -> reprovado (com motivo para o cliente)
--   divergência de dados         -> permanece pendente para revisão humana
--   caso contrário               -> aprovado como antes

CREATE OR REPLACE FUNCTION public.qa_doc_auto_aprovar_por_ia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conf          numeric;
  v_reco          text;
  v_tipo_ia       text;
  v_divergencia   boolean;
BEGIN
  -- Só atua sobre o que entra pendente. Envio da equipe já chega aprovado
  -- e não passa por aqui.
  IF NEW.status <> 'pendente_aprovacao' OR NEW.ia_dados_extraidos IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_conf := (NEW.ia_dados_extraidos->>'confianca')::numeric;
  EXCEPTION WHEN OTHERS THEN
    v_conf := NULL;
  END;
  v_reco    := NEW.ia_dados_extraidos->>'recomendacao';
  v_tipo_ia := NEW.ia_dados_extraidos->>'tipoDetectado';

  BEGIN
    v_divergencia := (NEW.ia_dados_extraidos->>'tem_divergencia')::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_divergencia := NULL;
  END;

  -- 1) Sem identidade: rejeita. Não há o que validar num documento que a IA
  --    não soube dizer o que é, e mantê-lo como "aprovado" mascara a pendência.
  IF NEW.tipo_documento = 'outro' OR v_tipo_ia = 'DESCONHECIDO' THEN
    NEW.status := 'reprovado';
    NEW.motivo_reprovacao := COALESCE(
      NEW.motivo_reprovacao,
      'Não foi possível identificar o tipo deste documento. Reenvie o arquivo original, colorido, legível e com a página inteira visível.'
    );
    RETURN NEW;
  END IF;

  -- 2) Dados do documento não batem com o cliente: NÃO aprova, mas também não
  --    rejeita — pode ser variação legítima de nome que a IA leu mal. Fica
  --    pendente para a equipe decidir.
  IF v_divergencia IS TRUE THEN
    RETURN NEW;
  END IF;

  -- 3) Leitura confiável e sem divergência: aprova.
  IF (v_conf IS NOT NULL AND v_conf >= 0.7) OR v_reco = 'aceitar' THEN
    NEW.status := 'aprovado';
    NEW.aprovado_em := COALESCE(NEW.aprovado_em, now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS qa_doc_auto_aprovar_por_ia_trigger ON public.qa_documentos_cliente;
CREATE TRIGGER qa_doc_auto_aprovar_por_ia_trigger
  BEFORE INSERT ON public.qa_documentos_cliente
  FOR EACH ROW
  EXECUTE FUNCTION public.qa_doc_auto_aprovar_por_ia();
