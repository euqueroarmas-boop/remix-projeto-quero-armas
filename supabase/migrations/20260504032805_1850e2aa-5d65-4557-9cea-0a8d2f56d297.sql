CREATE TABLE IF NOT EXISTS public.qa_arsenal_grupos_layout (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id INTEGER NOT NULL,
  contexto TEXT NOT NULL DEFAULT 'arsenal',
  ordem_grupos JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT qa_arsenal_grupos_layout_unique UNIQUE (cliente_id, contexto)
);

CREATE INDEX IF NOT EXISTS idx_qa_arsenal_grupos_layout_cliente
  ON public.qa_arsenal_grupos_layout(cliente_id);

ALTER TABLE public.qa_arsenal_grupos_layout ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arsenal grupos layout select"
ON public.qa_arsenal_grupos_layout FOR SELECT TO authenticated
USING (qa_is_owner_of_cliente(cliente_id) OR qa_is_active_staff(auth.uid()));

CREATE POLICY "arsenal grupos layout insert"
ON public.qa_arsenal_grupos_layout FOR INSERT TO authenticated
WITH CHECK (qa_is_owner_of_cliente(cliente_id) OR qa_is_active_staff(auth.uid()));

CREATE POLICY "arsenal grupos layout update"
ON public.qa_arsenal_grupos_layout FOR UPDATE TO authenticated
USING (qa_is_owner_of_cliente(cliente_id) OR qa_is_active_staff(auth.uid()));

CREATE POLICY "arsenal grupos layout delete"
ON public.qa_arsenal_grupos_layout FOR DELETE TO authenticated
USING (qa_is_active_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.qa_arsenal_grupos_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_qa_arsenal_grupos_layout_updated_at
BEFORE UPDATE ON public.qa_arsenal_grupos_layout
FOR EACH ROW EXECUTE FUNCTION public.qa_arsenal_grupos_set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.qa_arsenal_grupos_layout;