-- FIX: DELETE em qa_processo_documentos falhava silenciosamente porque a FK
-- qa_processo_eventos.documento_id (ON DELETE SET NULL) disparava UPDATE no eventos,
-- e o trigger trg_qa_processo_eventos_imut_upd bloqueia QUALQUER UPDATE/DELETE.
--
-- Estratégia: permitir o SET NULL automático da FK relaxando o trigger.
-- O trigger imutável agora bloqueia DELETE total e UPDATE de qualquer coluna != documento_id.
-- Assim, o histórico continua imutável, mas a FK consegue limpar a referência ao doc apagado.

CREATE OR REPLACE FUNCTION public.qa_processo_eventos_imutavel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'qa_processo_eventos é imutável (DELETE bloqueado).';
  END IF;
  -- UPDATE: permitido APENAS se for a FK SET NULL (documento_id passando para NULL)
  -- e nenhuma outra coluna materialmente alterada.
  IF TG_OP = 'UPDATE' THEN
    IF NEW.documento_id IS NULL
       AND OLD.documento_id IS NOT NULL
       AND NEW.id              IS NOT DISTINCT FROM OLD.id
       AND NEW.processo_id     IS NOT DISTINCT FROM OLD.processo_id
       AND NEW.tipo_evento     IS NOT DISTINCT FROM OLD.tipo_evento
       AND NEW.descricao       IS NOT DISTINCT FROM OLD.descricao
       AND NEW.dados_json      IS NOT DISTINCT FROM OLD.dados_json
       AND NEW.ator            IS NOT DISTINCT FROM OLD.ator
       AND NEW.user_id         IS NOT DISTINCT FROM OLD.user_id
       AND NEW.created_at      IS NOT DISTINCT FROM OLD.created_at
    THEN
      RETURN NEW; -- libera o SET NULL automático
    END IF;
    RAISE EXCEPTION 'qa_processo_eventos é imutável (UPDATE bloqueado em colunas críticas).';
  END IF;
  RETURN NULL;
END;
$$;
