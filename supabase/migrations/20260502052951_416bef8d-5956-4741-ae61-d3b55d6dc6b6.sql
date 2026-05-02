CREATE TABLE IF NOT EXISTS public.qa_processos_alertas_enviados (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id  uuid NOT NULL REFERENCES public.qa_processos(id) ON DELETE CASCADE,
  cliente_id   bigint,
  marco_dias   integer NOT NULL,
  canal        text NOT NULL,
  prazo_data   date,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (processo_id, marco_dias, canal, prazo_data)
);

CREATE INDEX IF NOT EXISTS idx_qa_proc_alertas_processo
  ON public.qa_processos_alertas_enviados (processo_id);
CREATE INDEX IF NOT EXISTS idx_qa_proc_alertas_created
  ON public.qa_processos_alertas_enviados (created_at DESC);

ALTER TABLE public.qa_processos_alertas_enviados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qa_proc_alertas_staff_read" ON public.qa_processos_alertas_enviados;
CREATE POLICY "qa_proc_alertas_staff_read"
  ON public.qa_processos_alertas_enviados
  FOR SELECT TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));