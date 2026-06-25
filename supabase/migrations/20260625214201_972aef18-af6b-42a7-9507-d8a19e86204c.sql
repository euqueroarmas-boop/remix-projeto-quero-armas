
CREATE TABLE public.qa_sidebar_temas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  descricao text,
  bg text NOT NULL,
  accent text NOT NULL,
  stripe text,
  top_mode text NOT NULL DEFAULT 'hero',
  hero_image_path text,
  hero_image_url text,
  emblem text,
  ativo boolean NOT NULL DEFAULT true,
  is_global_default boolean NOT NULL DEFAULT false,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qa_sidebar_temas_top_mode_chk CHECK (top_mode IN ('compact','hero'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_sidebar_temas TO authenticated;
GRANT ALL ON public.qa_sidebar_temas TO service_role;

ALTER TABLE public.qa_sidebar_temas ENABLE ROW LEVEL SECURITY;

CREATE POLICY qa_sidebar_temas_read_auth
  ON public.qa_sidebar_temas FOR SELECT
  TO authenticated
  USING (ativo = true);

CREATE POLICY qa_sidebar_temas_staff_read_all
  ON public.qa_sidebar_temas FOR SELECT
  TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

CREATE POLICY qa_sidebar_temas_staff_insert
  ON public.qa_sidebar_temas FOR INSERT
  TO authenticated
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE POLICY qa_sidebar_temas_staff_update
  ON public.qa_sidebar_temas FOR UPDATE
  TO authenticated
  USING (public.qa_is_active_staff(auth.uid()))
  WITH CHECK (public.qa_is_active_staff(auth.uid()));

CREATE POLICY qa_sidebar_temas_staff_delete
  ON public.qa_sidebar_temas FOR DELETE
  TO authenticated
  USING (public.qa_is_active_staff(auth.uid()));

CREATE TRIGGER trg_qa_sidebar_temas_updated_at
  BEFORE UPDATE ON public.qa_sidebar_temas
  FOR EACH ROW EXECUTE FUNCTION public.qa_set_updated_at();

CREATE OR REPLACE FUNCTION public.qa_sidebar_temas_single_default()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_global_default IS TRUE THEN
    UPDATE public.qa_sidebar_temas
       SET is_global_default = false
     WHERE id <> NEW.id AND is_global_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_qa_sidebar_temas_single_default
  AFTER INSERT OR UPDATE OF is_global_default ON public.qa_sidebar_temas
  FOR EACH ROW
  WHEN (NEW.is_global_default IS TRUE)
  EXECUTE FUNCTION public.qa_sidebar_temas_single_default();

CREATE INDEX qa_sidebar_temas_global_default_idx
  ON public.qa_sidebar_temas (is_global_default) WHERE is_global_default = true;

CREATE POLICY qa_temas_storage_read
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'qa-temas');

CREATE POLICY qa_temas_storage_staff_write
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'qa-temas' AND public.qa_is_active_staff(auth.uid()));

CREATE POLICY qa_temas_storage_staff_update
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'qa-temas' AND public.qa_is_active_staff(auth.uid()))
  WITH CHECK (bucket_id = 'qa-temas' AND public.qa_is_active_staff(auth.uid()));

CREATE POLICY qa_temas_storage_staff_delete
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'qa-temas' AND public.qa_is_active_staff(auth.uid()));
