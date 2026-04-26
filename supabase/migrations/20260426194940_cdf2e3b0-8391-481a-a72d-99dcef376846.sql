-- ============================================
-- ONDA 2: Hardening de Storage Buckets (PII)
-- ============================================

-- 1. qa-documentos: remover acesso anônimo total à pasta clientes/*
DROP POLICY IF EXISTS "Anon can read client photos in qa-documentos" ON storage.objects;
DROP POLICY IF EXISTS "Anon can update client photos in qa-documentos" ON storage.objects;
DROP POLICY IF EXISTS "Anon can upload client photos to qa-documentos" ON storage.objects;

-- 2. qa-cadastro-selfies: remover SELECT/UPDATE anônimo
-- (preserva INSERT anônimo para o fluxo de cadastro público em /qa/cadastro-publico)
DROP POLICY IF EXISTS "Anon can read public-cadastro selfies" ON storage.objects;
DROP POLICY IF EXISTS "Anon can update public-cadastro selfies" ON storage.objects;
-- Mantém: "Anon can upload public-cadastro selfies" (INSERT only) — fluxo legítimo