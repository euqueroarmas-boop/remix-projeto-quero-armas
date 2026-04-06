
-- Create support_tools table
CREATE TABLE public.support_tools (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  tool_type TEXT NOT NULL DEFAULT 'link' CHECK (tool_type IN ('upload', 'link')),
  file_url TEXT,
  external_url TEXT,
  icon_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.support_tools ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read active tools
CREATE POLICY "Authenticated can read active support_tools"
  ON public.support_tools
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Service role full access
CREATE POLICY "Service role full access support_tools"
  ON public.support_tools
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create storage bucket for tool files
INSERT INTO storage.buckets (id, name, public)
VALUES ('support-tools', 'support-tools', true);

-- Public can download files from the bucket
CREATE POLICY "Public can read support-tools files"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'support-tools');

-- Only service role can upload
CREATE POLICY "Service role can upload support-tools"
  ON storage.objects
  FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'support-tools');

CREATE POLICY "Service role can update support-tools"
  ON storage.objects
  FOR UPDATE
  TO service_role
  USING (bucket_id = 'support-tools');

CREATE POLICY "Service role can delete support-tools"
  ON storage.objects
  FOR DELETE
  TO service_role
  USING (bucket_id = 'support-tools');
