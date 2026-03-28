ALTER TABLE public.blog_posts_ai
  ADD COLUMN IF NOT EXISTS image_prompt text,
  ADD COLUMN IF NOT EXISTS image_alt_pt text,
  ADD COLUMN IF NOT EXISTS image_alt_en text;