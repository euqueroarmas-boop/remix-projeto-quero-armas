
-- CMS Pages (services + segments)
CREATE TABLE public.cms_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_type TEXT NOT NULL DEFAULT 'service' CHECK (page_type IN ('service', 'segment')),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  
  -- SEO
  meta_title TEXT,
  meta_description TEXT,
  canonical_url TEXT,
  og_image TEXT,
  noindex BOOLEAN NOT NULL DEFAULT false,
  sitemap_priority TEXT DEFAULT '0.7',
  sitemap_changefreq TEXT DEFAULT 'monthly',
  
  -- Content (structured JSON)
  hero_data JSONB DEFAULT '{}'::jsonb,
  pain_data JSONB DEFAULT '[]'::jsonb,
  solution_data JSONB DEFAULT '{}'::jsonb,
  benefits_data JSONB DEFAULT '[]'::jsonb,
  faq_data JSONB DEFAULT '[]'::jsonb,
  cta_data JSONB DEFAULT '{}'::jsonb,
  scope_data JSONB DEFAULT '{}'::jsonb,
  proof_data JSONB DEFAULT '[]'::jsonb,
  
  -- Segment-specific
  compliance_data JSONB DEFAULT '{}'::jsonb,
  niche_data JSONB DEFAULT '{}'::jsonb,
  
  -- Calculator/pricing config
  calculator_config JSONB DEFAULT '{}'::jsonb,
  pricing_config JSONB DEFAULT '{}'::jsonb,
  
  -- Relations
  related_services TEXT[] DEFAULT '{}',
  related_segments TEXT[] DEFAULT '{}',
  
  -- Block composition
  blocks_order JSONB DEFAULT '[]'::jsonb,
  
  -- Template
  template TEXT NOT NULL DEFAULT 'default',
  
  -- Legacy mapping
  legacy_component TEXT,
  
  -- Timestamps
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CMS Blocks (reusable block library)
CREATE TABLE public.cms_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  block_type TEXT NOT NULL,
  variant TEXT DEFAULT 'default',
  label TEXT NOT NULL,
  default_data JSONB DEFAULT '{}'::jsonb,
  is_global BOOLEAN NOT NULL DEFAULT false,
  page_id UUID REFERENCES public.cms_pages(id) ON DELETE CASCADE,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CMS Pricing Rules
CREATE TABLE public.cms_pricing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('host', 'vm', 'workstation')),
  os_type TEXT NOT NULL DEFAULT 'windows_server',
  base_price NUMERIC NOT NULL DEFAULT 0,
  sla_standard_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  sla_24h_multiplier NUMERIC NOT NULL DEFAULT 1.35,
  criticality_low NUMERIC NOT NULL DEFAULT 1.0,
  criticality_medium NUMERIC NOT NULL DEFAULT 1.2,
  criticality_high NUMERIC NOT NULL DEFAULT 1.5,
  progressive_discount JSONB DEFAULT '[]'::jsonb,
  min_value NUMERIC DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(resource_type, os_type)
);

-- CMS Redirects (301)
CREATE TABLE public.cms_redirects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_slug TEXT NOT NULL UNIQUE,
  to_slug TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_pricing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_redirects ENABLE ROW LEVEL SECURITY;

-- CMS Pages policies
CREATE POLICY "Public can read published cms_pages"
  ON public.cms_pages FOR SELECT TO anon
  USING (status = 'published' AND noindex = false);

CREATE POLICY "Authenticated can read published cms_pages"
  ON public.cms_pages FOR SELECT TO authenticated
  USING (status = 'published');

CREATE POLICY "Service role full access cms_pages"
  ON public.cms_pages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- CMS Blocks policies
CREATE POLICY "Public can read active cms_blocks"
  ON public.cms_blocks FOR SELECT TO anon
  USING (active = true);

CREATE POLICY "Authenticated can read active cms_blocks"
  ON public.cms_blocks FOR SELECT TO authenticated
  USING (active = true);

CREATE POLICY "Service role full access cms_blocks"
  ON public.cms_blocks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- CMS Pricing Rules policies
CREATE POLICY "Public can read active cms_pricing_rules"
  ON public.cms_pricing_rules FOR SELECT TO anon
  USING (active = true);

CREATE POLICY "Authenticated can read active cms_pricing_rules"
  ON public.cms_pricing_rules FOR SELECT TO authenticated
  USING (active = true);

CREATE POLICY "Service role full access cms_pricing_rules"
  ON public.cms_pricing_rules FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- CMS Redirects policies
CREATE POLICY "Public can read active cms_redirects"
  ON public.cms_redirects FOR SELECT TO anon
  USING (active = true);

CREATE POLICY "Service role full access cms_redirects"
  ON public.cms_redirects FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_cms_pages_slug ON public.cms_pages(slug);
CREATE INDEX idx_cms_pages_status ON public.cms_pages(status);
CREATE INDEX idx_cms_pages_type ON public.cms_pages(page_type);
CREATE INDEX idx_cms_blocks_page ON public.cms_blocks(page_id);
CREATE INDEX idx_cms_blocks_type ON public.cms_blocks(block_type);
CREATE INDEX idx_cms_redirects_from ON public.cms_redirects(from_slug);

-- Seed pricing rules with current values
INSERT INTO public.cms_pricing_rules (resource_type, os_type, base_price, progressive_discount) VALUES
  ('host', 'windows_server', 350, '[]'),
  ('host', 'linux', 500, '[]'),
  ('vm', 'windows_server', 200, '[]'),
  ('vm', 'linux', 350, '[]'),
  ('workstation', 'windows', 150, '[{"min":1,"max":5,"discount":0},{"min":6,"max":10,"discount":0.1},{"min":11,"max":15,"discount":0.15},{"min":16,"max":20,"discount":0.2},{"min":21,"max":25,"discount":0.25},{"min":26,"max":30,"discount":0.275}]'),
  ('workstation', 'linux', 150, '[{"min":1,"max":5,"discount":0},{"min":6,"max":10,"discount":0.1},{"min":11,"max":15,"discount":0.15},{"min":16,"max":20,"discount":0.2},{"min":21,"max":25,"discount":0.25},{"min":26,"max":30,"discount":0.275}]'),
  ('workstation', 'mac', 150, '[{"min":1,"max":5,"discount":0},{"min":6,"max":10,"discount":0.1},{"min":11,"max":15,"discount":0.15},{"min":16,"max":20,"discount":0.2},{"min":21,"max":25,"discount":0.25},{"min":26,"max":30,"discount":0.275}]');
