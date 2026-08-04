CREATE TABLE public.qa_sync_fila (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  tentativas integer NOT NULL DEFAULT 0,
  erro text,
  origem text NOT NULL DEFAULT 'auto',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  processado_em timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_sync_fila TO authenticated;
GRANT ALL ON public.qa_sync_fila TO service_role;

ALTER TABLE public.qa_sync_fila ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados gerenciam a fila de sincronizacao"
ON public.qa_sync_fila FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX qa_sync_fila_pendente_unico
  ON public.qa_sync_fila (processo_id)
  WHERE status IN ('pendente','processando');

CREATE INDEX qa_sync_fila_status_idx ON public.qa_sync_fila (status, created_at);

CREATE TRIGGER qa_sync_fila_updated_at
BEFORE UPDATE ON public.qa_sync_fila
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enfileira todos os processos em aberto que ainda nao estao na fila
CREATE OR REPLACE FUNCTION public.qa_sync_fila_enfileirar_abertos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_qtd integer;
BEGIN
  INSERT INTO public.qa_sync_fila (processo_id, origem)
  SELECT p.id, 'auto'
    FROM public.qa_processos p
   WHERE p.status IN ('aguardando_documentos','em_analise','em_andamento','pendente')
     AND NOT EXISTS (
       SELECT 1 FROM public.qa_sync_fila f
        WHERE f.processo_id = p.id
          AND f.status IN ('pendente','processando')
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.qa_sync_fila f2
        WHERE f2.processo_id = p.id
          AND f2.status = 'concluido'
          AND f2.processado_em > now() - interval '12 hours'
     );
  GET DIAGNOSTICS v_qtd = ROW_COUNT;
  RETURN v_qtd;
END;
$function$;

-- Processa a fila em lotes pequenos (1 processo por chamada por padrao)
CREATE OR REPLACE FUNCTION public.qa_sync_fila_processar(p_limite integer DEFAULT 1)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_feitos integer := 0;
BEGIN
  PERFORM set_config('statement_timeout', '90s', true);

  FOR r IN
    SELECT id, processo_id
      FROM public.qa_sync_fila
     WHERE status = 'pendente'
       AND tentativas < 3
     ORDER BY created_at
     LIMIT GREATEST(coalesce(p_limite, 1), 1)
     FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.qa_sync_fila
       SET status = 'processando', tentativas = tentativas + 1
     WHERE id = r.id;

    BEGIN
      PERFORM public.qa_explodir_checklist_processo(r.processo_id);
      UPDATE public.qa_sync_fila
         SET status = 'concluido', erro = NULL, processado_em = now()
       WHERE id = r.id;
      v_feitos := v_feitos + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.qa_sync_fila
         SET status = CASE WHEN tentativas >= 3 THEN 'erro' ELSE 'pendente' END,
             erro = SQLERRM,
             processado_em = now()
       WHERE id = r.id;
    END;
  END LOOP;

  RETURN v_feitos;
END;
$function$;