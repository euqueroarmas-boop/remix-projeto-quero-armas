-- ============================================================
-- P0 INCIDENTE: Senha GOV / cadastro_cr cruzados entre clientes
-- ============================================================

-- 1. Permitir registrar tentativas bloqueadas no log de auditoria
ALTER TABLE public.qa_senha_gov_acessos
  DROP CONSTRAINT IF EXISTS qa_senha_gov_acessos_acao_check;

ALTER TABLE public.qa_senha_gov_acessos
  ADD CONSTRAINT qa_senha_gov_acessos_acao_check
  CHECK (acao = ANY (ARRAY['read'::text, 'write'::text, 'migrate'::text, 'denied_mismatch'::text, 'reconcile'::text]));

-- 2. Índices para acelerar diagnóstico e queries por cliente
CREATE INDEX IF NOT EXISTS idx_qa_cadastro_cr_cliente_id
  ON public.qa_cadastro_cr (cliente_id);

CREATE INDEX IF NOT EXISTS idx_qa_senha_gov_acessos_cliente_id
  ON public.qa_senha_gov_acessos (cliente_id);

CREATE INDEX IF NOT EXISTS idx_qa_senha_gov_acessos_cadastro_cr_id
  ON public.qa_senha_gov_acessos (cadastro_cr_id);

-- 3. View de auditoria do incidente: cruzamento entre cliente_id atual no CR
--    e o cliente_id registrado no log de migração (fonte da verdade da época
--    em que a senha foi cifrada).
CREATE OR REPLACE VIEW public.qa_senha_gov_incident_audit
WITH (security_invoker = on) AS
SELECT
  cr.id                 AS cadastro_cr_id,
  cr.numero_cr,
  cr.cliente_id         AS cliente_id_atual,
  c_atual.nome_completo AS cliente_atual,
  mig.cliente_id        AS cliente_id_migracao,
  c_mig.nome_completo   AS cliente_migracao,
  mig.created_at        AS migrado_em
FROM public.qa_cadastro_cr cr
LEFT JOIN LATERAL (
  SELECT a.cliente_id, a.created_at
  FROM public.qa_senha_gov_acessos a
  WHERE a.cadastro_cr_id = cr.id AND a.acao = 'migrate'
  ORDER BY a.created_at ASC
  LIMIT 1
) mig ON true
LEFT JOIN public.qa_clientes c_atual ON c_atual.id = cr.cliente_id
LEFT JOIN public.qa_clientes c_mig   ON c_mig.id   = mig.cliente_id
WHERE mig.cliente_id IS DISTINCT FROM cr.cliente_id;

COMMENT ON VIEW public.qa_senha_gov_incident_audit IS
  'P0 — Lista CRs cujo cliente_id foi reescrito após a cifragem inicial. Use para reconciliar.';