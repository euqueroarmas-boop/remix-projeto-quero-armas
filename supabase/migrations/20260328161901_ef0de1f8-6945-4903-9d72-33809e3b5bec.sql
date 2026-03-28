
-- Create public storage bucket for blog images
INSERT INTO storage.buckets (id, name, public) VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read blog images (public bucket)
CREATE POLICY "Public read blog-images" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'blog-images');

-- Allow authenticated users to upload blog images
CREATE POLICY "Auth upload blog-images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'blog-images');

-- Allow service role full access
CREATE POLICY "Service role blog-images" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'blog-images')
  WITH CHECK (bucket_id = 'blog-images');

-- Add image_source column to track origin of cover image
ALTER TABLE public.blog_posts_ai
  ADD COLUMN IF NOT EXISTS image_source text DEFAULT 'fallback';
