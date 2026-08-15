-- =============================================================================
-- PROTOCOLO ≠ CERTIDÃO — a trava no último portão (15/08/2026)
--
-- Caso Mizael (ID #0047, slot "Antecedentes Estadual Execuções"): o cliente
-- enviou o "Cadastro de Pedido de Certidão" do e-SAJ — o comprovante de que o
-- pedido entrou na fila do TJSP — e o sistema deu a exigência por cumprida.
--
-- Por que passou, no lado do banco: `qa_doc_auto_aprovar_por_ia` aprovava com
-- `confianca >= 0.7 OR recomendacao = 'aceitar'`. Essa confiança é a da
-- LEITURA ("tenho certeza do que estou vendo"), não a da ADEQUAÇÃO ("isto é o
-- documento que o slot pede"). Um protocolo nítido, com nome, CPF, filiação e
-- o título "CERTIDÃO DE EXECUÇÃO CRIMINAL" impresso no campo Modelo, é lido
-- com altíssima confiança — e era aprovado por isso.
--
-- Duas travas novas, ambas conservadoras:
--
--   0b) Documento marcado como PROTOCOLO pela leitura determinística
--       (`documento_e_protocolo`) ou recusado na origem (`recomendacao =
--       'rejeitar'`) entra REPROVADO, com motivo. Nunca cumpre exigência.
--
--   2b) Certidão de antecedentes (família `antecedentes%`) só é aprovada
--       automaticamente com o RESULTADO da busca lido: `nada_consta`. Sem
--       resultado não há certidão — há papel do tribunal. Não reprova: fica
--       `pendente_aprovacao` para a equipe conferir. É esta regra que fecha o
--       buraco de forma genérica, mesmo para um protocolo de portal que o
--       detector ainda não conheça.
--
-- O caminho do parser (bloco 0) continua tendo precedência e não muda: quem
-- leu o texto do próprio PDF e conferiu campo a campo já verificou o
-- resultado da certidão.
--
-- Idempotente.
-- =============================================================================

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
  v_protocolo     boolean;
  v_resultado     text;
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

  -- ─── 0b) PROTOCOLO DE PEDIDO NÃO É DOCUMENTO ──────────────────────────
  -- O comprovante de pedido de certidão traz o mesmo tribunal, o mesmo título
  -- e a mesma qualificação da certidão. Quem detectou (parser local ou a trava
  -- do classificador) já disse o que é: aqui só se registra a recusa.
  BEGIN
    v_protocolo := (NEW.ia_dados_extraidos->>'documento_e_protocolo')::boolean;
  EXCEPTION WHEN OTHERS THEN
    v_protocolo := NULL;
  END;

  IF v_protocolo IS TRUE OR NEW.ia_dados_extraidos->>'recomendacao' = 'rejeitar' THEN
    NEW.status := 'reprovado';
    NEW.motivo_reprovacao := COALESCE(
      NEW.motivo_reprovacao,
      'Este arquivo é o comprovante do PEDIDO da certidão (protocolo), não a certidão emitida. Aguarde a liberação pelo tribunal e envie o PDF da certidão.'
    );
    RETURN NEW;
  END IF;

  -- ─── Sem parser: decisão por IA ───────────────────────────────────────
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

  -- 2b) CERTIDÃO DE ANTECEDENTES SEM RESULTADO LIDO NÃO É APROVADA SOZINHA.
  --     Certidão é o papel que DECLARA o resultado da busca. Se a leitura não
  --     achou 'nada_consta', ou o documento não é a certidão (é o protocolo,
  --     é a página de autenticação, é a capa), ou tem apontamento — nos dois
  --     casos a decisão é humana, nunca automática.
  IF NEW.tipo_documento LIKE 'antecedentes%' THEN
    v_resultado := lower(COALESCE(
      NEW.ia_dados_extraidos->>'resultado_certidao',
      NEW.ia_dados_extraidos#>>'{camposExtraidos,resultado_certidao}',
      ''
    ));
    IF v_resultado <> 'nada_consta' THEN
      RETURN NEW;
    END IF;
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

-- ─── CONFERÊNCIA (rodar depois de aplicar) ───────────────────────────────
-- Lista as certidões de antecedentes hoje APROVADAS no Hub sem resultado da
-- busca registrado — o mesmo sintoma do protocolo do Mizael. Não altera nada:
-- é a fila de revisão manual do passivo já aprovado.
--
-- SELECT d.id, d.qa_cliente_id, c.nome_completo, d.tipo_documento,
--        d.arquivo_nome, d.created_at,
--        COALESCE(d.ia_dados_extraidos->>'resultado_certidao',
--                 d.ia_dados_extraidos#>>'{camposExtraidos,resultado_certidao}') AS resultado_lido,
--        d.ia_dados_extraidos->>'tipoDetectado' AS tipo_detectado_ia,
--        d.ia_dados_extraidos->>'parser_veredicto' AS parser
--   FROM public.qa_documentos_cliente d
--   LEFT JOIN public.qa_clientes c ON c.id = d.qa_cliente_id
--  WHERE d.tipo_documento LIKE 'antecedentes%'
--    AND d.status = 'aprovado'
--    AND COALESCE(d.ia_dados_extraidos->>'parser_veredicto', '') <> 'aprovado'
--    AND lower(COALESCE(d.ia_dados_extraidos->>'resultado_certidao',
--                       d.ia_dados_extraidos#>>'{camposExtraidos,resultado_certidao}', '')) <> 'nada_consta'
--  ORDER BY d.created_at DESC;
