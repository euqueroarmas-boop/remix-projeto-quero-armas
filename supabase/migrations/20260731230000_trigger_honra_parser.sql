-- O parser passa a decidir a aprovação no Hub, à frente da IA.
--
-- Regra do usuário: "Se está parseado, deve ser aprovado ou rejeitado
-- conforme o parser. Simples. IA não trabalha mais em antecedentes."
--
-- Até aqui a trigger decidia SÓ por campos da IA (confianca, recomendacao,
-- tem_divergencia). O resultado do parser nem sequer era gravado. Agora que
-- ele é (`parser_veredicto` em ia_dados_extraidos), o documento lido pelo
-- parser dependia da confiança da IA para ser aprovado — e um documento
-- perfeito, lido do texto do próprio PDF, ficava parado em
-- 'pendente_aprovacao' esperando análise. É o mesmo sintoma que travou a
-- certidão do TRF3 no lado do processo.
--
-- Por que o parser vem antes: ele lê o texto extraído do PDF e compara campo
-- a campo com o cadastro — nome, CPF, nascimento, filiação. Não estima
-- confiança, não interpreta. Quando ele diz "aprovado", o cruzamento que a
-- IA faria com `tem_divergencia` já foi feito, e com mais rigor.
--
-- O que NÃO muda: documento sem parser (imagem, layout desconhecido, tipo
-- sem parser) segue exatamente pelo caminho de hoje. Os três blocos da
-- decisão por IA continuam intactos, logo abaixo.

BEGIN;

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
  v_parser        text;
BEGIN
  -- Só atua sobre o que entra pendente. Envio da equipe já chega aprovado
  -- e não passa por aqui.
  IF NEW.status <> 'pendente_aprovacao' OR NEW.ia_dados_extraidos IS NULL THEN
    RETURN NEW;
  END IF;

  -- ─── 0) PARSER PRIMEIRO ───────────────────────────────────────────────
  v_parser := NEW.ia_dados_extraidos->>'parser_veredicto';

  IF v_parser = 'aprovado' THEN
    NEW.status := 'aprovado';
    NEW.aprovado_em := COALESCE(NEW.aprovado_em, now());
    RETURN NEW;
  END IF;

  IF v_parser = 'rejeitado' THEN
    NEW.status := 'reprovado';
    NEW.motivo_reprovacao := COALESCE(
      NEW.motivo_reprovacao,
      'Os dados do documento não conferem com o seu cadastro. Reemita o documento com os dados exatamente como no seu RG/CPF.'
    );
    RETURN NEW;
  END IF;

  -- 'cadastro_pendente' é falha NOSSA, não do documento: falta o dado no
  -- cadastro para comparar. Não aprova nem reprova — fica pendente para a
  -- equipe completar o cadastro. Cair na decisão por IA aqui aprovaria um
  -- documento que ninguém conseguiu conferir.
  IF v_parser = 'cadastro_pendente' THEN
    RETURN NEW;
  END IF;

  -- ─── Sem parser: decisão por IA, exatamente como antes ────────────────
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

COMMIT;
