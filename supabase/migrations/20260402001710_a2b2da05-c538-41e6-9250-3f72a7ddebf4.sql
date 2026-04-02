INSERT INTO storage.buckets (id, name, public) VALUES ('contract-assets', 'contract-assets', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read contract assets" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'contract-assets');

CREATE POLICY "Service role can upload contract assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'contract-assets');