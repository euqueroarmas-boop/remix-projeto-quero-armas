ALTER TABLE public.qa_processos_alertas_enviados
  ADD COLUMN IF NOT EXISTS evento text NOT NULL DEFAULT 'LEGADO';

-- Drop antigo unique (processo_id, marco_dias, canal, prazo_data) se ainda presente
ALTER TABLE public.qa_processos_alertas_enviados
  DROP CONSTRAINT IF EXISTS qa_processos_alertas_enviados_processo_id_marco_dias_canal__key;

-- Novo unique incluindo evento
ALTER TABLE public.qa_processos_alertas_enviados
  ADD CONSTRAINT qa_proc_alertas_unique_v2
  UNIQUE (processo_id, evento, marco_dias, canal, prazo_data);

CREATE INDEX IF NOT EXISTS idx_qa_proc_alertas_processo_evento
  ON public.qa_processos_alertas_enviados (processo_id, evento);