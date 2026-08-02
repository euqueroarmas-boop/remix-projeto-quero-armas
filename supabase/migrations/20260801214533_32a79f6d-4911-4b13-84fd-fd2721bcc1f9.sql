CREATE OR REPLACE FUNCTION public.qa_doc_auto_aprovar_por_ia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_conf          numeric;
  v_reco          text;
  v_tipo_ia       text;
  v_divergencia   boolean;
  v_parser        text;
  v_en            boolean;
  v_ia_nova       boolean;
BEGIN
  IF NEW.status NOT IN ('pendente_aprovacao','reprovado') THEN
    RETURN NEW;
  END IF;

  v_ia_nova := (TG_OP = 'UPDATE'
                AND NEW.ia_dados_extraidos IS NOT NULL
                AND NEW.ia_dados_extraidos IS DISTINCT FROM OLD.ia_dados_extraidos);

  IF NEW.status = 'reprovado' AND NOT v_ia_nova THEN
    RETURN NEW;
  END IF;

  v_en := public.qa_doc_grupo_efetiva_necessidade(NEW.tipo_documento, NEW.categoria_hub);

  IF NEW.ia_dados_extraidos IS NULL THEN
    IF v_en OR TG_OP = 'INSERT' THEN
      RETURN NEW;
    END IF;
    NEW.status := 'reprovado';
    NEW.motivo_reprovacao := COALESCE(
      NEW.motivo_reprovacao,
      'Não foi possível ler este documento automaticamente. Reenvie o arquivo original em PDF, legível e com a página inteira visível.'
    );
    RETURN NEW;
  END IF;

  IF v_ia_nova THEN
    NEW.motivo_reprovacao := NULL;
  END IF;

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
      NEW.status := 'pendente_aprovacao';
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

  IF v_divergencia IS TRUE THEN
    IF v_en THEN
      NEW.status := 'pendente_aprovacao';
      RETURN NEW;
    END IF;
    NEW.status := 'reprovado';
    NEW.motivo_reprovacao := COALESCE(
      NEW.motivo_reprovacao,
      'Os dados do documento divergem do seu cadastro (nome/CPF). Envie o documento correto, emitido em seu nome.'
    );
    RETURN NEW;
  END IF;

  IF (v_conf IS NOT NULL AND v_conf >= 0.7) OR v_reco = 'aceitar' THEN
    NEW.status := 'aprovado';
    NEW.aprovado_em := COALESCE(NEW.aprovado_em, now());
    RETURN NEW;
  END IF;

  IF v_en THEN
    NEW.status := 'pendente_aprovacao';
    RETURN NEW;
  END IF;

  NEW.status := 'reprovado';
  NEW.motivo_reprovacao := COALESCE(
    NEW.motivo_reprovacao,
    'Não foi possível validar este documento automaticamente. Reenvie o arquivo original em PDF, legível e com a página inteira visível.'
  );

  RETURN NEW;
END;
$fn$;

UPDATE public.qa_documentos_cliente d
SET status = 'reprovado',
    motivo_reprovacao = COALESCE(motivo_reprovacao, 'Não foi possível ler este documento automaticamente. Reenvie o arquivo original em PDF, legível e com a página inteira visível.')
WHERE d.status = 'pendente_aprovacao'
  AND d.ia_dados_extraidos IS NULL
  AND NOT public.qa_doc_grupo_efetiva_necessidade(d.tipo_documento, d.categoria_hub);