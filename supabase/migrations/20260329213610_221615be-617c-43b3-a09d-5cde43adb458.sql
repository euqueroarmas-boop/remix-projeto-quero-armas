INSERT INTO storage.buckets (id, name, public) VALUES ('test-artifacts', 'test-artifacts', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can read test artifacts" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'test-artifacts');

CREATE POLICY "Service role full access test artifacts" ON storage.objects FOR ALL TO service_role USING (bucket_id = 'test-artifacts') WITH CHECK (bucket_id = 'test-artifacts');