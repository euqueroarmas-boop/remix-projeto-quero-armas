CREATE TABLE IF NOT EXISTS public.qa_page_engagement_counters (
  page_key TEXT PRIMARY KEY,
  page_type TEXT NOT NULL DEFAULT 'service',
  title TEXT NULL,
  view_count BIGINT NOT NULL DEFAULT 0,
  share_count BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qa_page_engagement_counters TO authenticated;
GRANT ALL ON public.qa_page_engagement_counters TO service_role;
GRANT SELECT ON public.qa_page_engagement_counters TO anon;

ALTER TABLE public.qa_page_engagement_counters ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'qa_page_engagement_counters'
      AND policyname = 'qa_page_engagement_counters_select_public'
  ) THEN
    CREATE POLICY qa_page_engagement_counters_select_public
      ON public.qa_page_engagement_counters
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.qa_increment_page_engagement(
  p_page_key TEXT,
  p_metric TEXT,
  p_page_type TEXT DEFAULT 'service',
  p_title TEXT DEFAULT NULL
)
RETURNS TABLE(view_count BIGINT, share_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_metric NOT IN ('view', 'share') THEN
    RAISE EXCEPTION 'Invalid metric: %', p_metric;
  END IF;

  INSERT INTO public.qa_page_engagement_counters (
    page_key,
    page_type,
    title,
    view_count,
    share_count,
    created_at,
    updated_at
  )
  VALUES (
    p_page_key,
    COALESCE(p_page_type, 'service'),
    p_title,
    CASE WHEN p_metric = 'view' THEN 1 ELSE 0 END,
    CASE WHEN p_metric = 'share' THEN 1 ELSE 0 END,
    now(),
    now()
  )
  ON CONFLICT (page_key) DO UPDATE
  SET
    page_type = COALESCE(EXCLUDED.page_type, public.qa_page_engagement_counters.page_type),
    title = COALESCE(EXCLUDED.title, public.qa_page_engagement_counters.title),
    view_count = public.qa_page_engagement_counters.view_count + CASE WHEN p_metric = 'view' THEN 1 ELSE 0 END,
    share_count = public.qa_page_engagement_counters.share_count + CASE WHEN p_metric = 'share' THEN 1 ELSE 0 END,
    updated_at = now();

  RETURN QUERY
  SELECT
    q.view_count,
    q.share_count
  FROM public.qa_page_engagement_counters q
  WHERE q.page_key = p_page_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.qa_increment_page_engagement(TEXT, TEXT, TEXT, TEXT)
TO anon, authenticated, service_role;