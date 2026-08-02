-- Regra: SOMENTE o grupo "efetiva necessidade" pode ficar em análise humana.
-- Todos os demais grupos precisam sair do upload já APROVADOS ou REPROVADOS.
BEGIN;

CREATE OR REPLACE FUNCTION public.qa_doc_grupo_efetiva_necessidade(_tipo text, _categoria text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(_categoria, '') = 'efetiva_necessidade'
      OR COALESCE(_tipo, '') ILIKE '%efetiva_necessidade%'
      OR COALESCE(_tipo, '') IN ('boletim_ocorrencia', 'documento_complementar_caso');
$$;

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
  v_en            boolean;
BEGIN
  IF NEW.status <> 'pendente_aprovacao' OR NEW.ia_dados_extraidos IS NULL THEN
    RETURN NEW;
  END IF;

  v_en := public.qa_doc_grupo_efetiva_necessidade(NEW.tipo_documento, NEW.categoria_hub);

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

  IF v_parser = 'cadastro_pendente' THEN
    IF v_en THEN
      RETURN NEW;
    END IF;
    NEW.status := 'reprovado';
    NEW.motivo_reprovacao := COALESCE(
      NEW.motivo_reprovacao,
      'Não foi possível conferir este documento com o seu cadastro. Complete os dados cadastrais e reenvie o documento.'
    );
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

  IF NEW.tipo_documento = 'outro' OR v_tipo_ia = 'DESCONHECIDO' THEN
    NEW.status := 'reprovado';
    NEW.motivo_reprovacao := COALESCE(
      NEW.motivo_reprovacao,
      'Não foi possível identificar o tipo deste documento. Reenvie o arquivo original, colorido, legível e com a página inteira visível.'
    );
    RETURN NEW;
  END IF;

  -- Divergência de nome/CPF
  IF v_divergencia IS TRUE THEN
    IF v_en THEN
      RETURN NEW;  -- só efetiva necessidade vai para análise humana
    END IF;
    NEW.status := 'reprovado';
    NEW.motivo_reprovacao := COALESCE(
      NEW.motivo_reprovacao,
      'Os dados do documento divergem do seu cadastro (nome/CPF). Envie o documento correto, emitido em seu nome.'
    );
    RETURN NEW;
  END IF;

  -- Leitura confiável e sem divergência: aprova.
  IF (v_conf IS NOT NULL AND v_conf >= 0.7) OR v_reco = 'aceitar' THEN
    NEW.status := 'aprovado';
    NEW.aprovado_em := COALESCE(NEW.aprovado_em, now());
    RETURN NEW;
  END IF;

  -- Nenhuma regra decidiu. Fora da efetiva necessidade não existe "em análise".
  IF NOT v_en THEN
    NEW.status := 'reprovado';
    NEW.motivo_reprovacao := COALESCE(
      NEW.motivo_reprovacao,
      'Não foi possível validar este documento automaticamente. Reenvie o arquivo original em PDF, legível e com a página inteira visível.'
    );
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
