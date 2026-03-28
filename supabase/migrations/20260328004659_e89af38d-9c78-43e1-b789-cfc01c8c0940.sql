
CREATE TABLE public.blog_posts_ai (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  excerpt text NOT NULL DEFAULT '',
  meta_title text NOT NULL DEFAULT '',
  meta_description text NOT NULL DEFAULT '',
  content_md text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Tecnologia Empresarial',
  tag text NOT NULL DEFAULT '',
  read_time text NOT NULL DEFAULT '5 min',
  image_url text DEFAULT 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80',
  keywords text[] DEFAULT '{}',
  service_slug text DEFAULT NULL,
  city_slug text DEFAULT NULL,
  status text NOT NULL DEFAULT 'draft',
  faq jsonb DEFAULT '[]',
  internal_links jsonb DEFAULT '[]',
  cta text DEFAULT '',
  published_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.blog_posts_ai ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published blog posts"
ON public.blog_posts_ai FOR SELECT TO anon
USING (status = 'published');

CREATE POLICY "Auth can read published blog posts"
ON public.blog_posts_ai FOR SELECT TO authenticated
USING (status = 'published');

CREATE POLICY "Service role full access blog_posts_ai"
ON public.blog_posts_ai FOR ALL TO service_role
USING (true) WITH CHECK (true);
