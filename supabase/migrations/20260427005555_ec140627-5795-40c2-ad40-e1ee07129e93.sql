CREATE TABLE IF NOT EXISTS public.qa_remove_bg_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  armamento_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_remove_bg_usage_created_at
  ON public.qa_remove_bg_usage (created_at DESC);

ALTER TABLE public.qa_remove_bg_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qa_remove_bg_usage_select_staff" ON public.qa_remove_bg_usage;
CREATE POLICY "qa_remove_bg_usage_select_staff"
ON public.qa_remove_bg_usage
FOR SELECT
TO authenticated
USING (public.qa_is_active_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.qa_remove_bg_usage_mes()
RETURNS TABLE(total bigint, mes_referencia date)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::bigint AS total,
    date_trunc('month', now())::date AS mes_referencia
  FROM public.qa_remove_bg_usage
  WHERE created_at >= date_trunc('month', now())
    AND created_at <  date_trunc('month', now()) + INTERVAL '1 month';
$$;

GRANT EXECUTE ON FUNCTION public.qa_remove_bg_usage_mes() TO authenticated;