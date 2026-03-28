ALTER TABLE public.blog_posts_ai
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS excerpt_en text,
  ADD COLUMN IF NOT EXISTS content_md_en text,
  ADD COLUMN IF NOT EXISTS meta_title_en text,
  ADD COLUMN IF NOT EXISTS meta_description_en text,
  ADD COLUMN IF NOT EXISTS cta_en text,
  ADD COLUMN IF NOT EXISTS faq_en jsonb DEFAULT '[]'::jsonb;