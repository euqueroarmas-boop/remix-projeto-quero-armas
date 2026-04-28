CREATE OR REPLACE VIEW public.qa_incident_reconciliation_plan
WITH (security_invoker = on) AS
WITH fonte AS (
  SELECT a.cadastro_cr_id, a.cliente_id, a.created_at,
         ROW_NUMBER() OVER (PARTITION BY a.cadastro_cr_id ORDER BY a.created_at ASC) AS rn
  FROM public.qa_senha_gov_acessos a
  WHERE a.acao = 'migrate'
)
SELECT
  cr.id                       AS cadastro_cr_id,
  cr.numero_cr,
  cr.cliente_id               AS cliente_atual_id,
  c_atual.nome_completo       AS cliente_atual_nome,
  c_atual.cpf                 AS cliente_atual_cpf,
  fonte.cliente_id            AS cliente_correto_id,
  c_correto.nome_completo     AS cliente_correto_nome,
  c_correto.cpf               AS cliente_correto_cpf,
  fonte.created_at            AS cifrado_em,
  cr.senha_gov_updated_at     AS senha_alterada_em,
  CASE
    WHEN fonte.cliente_id IS NULL THEN 'sem_fonte_verdade'
    WHEN fonte.cliente_id = cr.cliente_id THEN 'ja_correto'
    ELSE 'a_reconciliar'
  END AS status_reconciliacao
FROM public.qa_cadastro_cr cr
LEFT JOIN fonte ON fonte.cadastro_cr_id = cr.id AND fonte.rn = 1
LEFT JOIN public.qa_clientes c_atual   ON c_atual.id   = cr.cliente_id
LEFT JOIN public.qa_clientes c_correto ON c_correto.id = fonte.cliente_id;

COMMENT ON VIEW public.qa_incident_reconciliation_plan IS
  'P0 — Plano de reconciliação dos vínculos cadastro_cr ↔ cliente. Apenas leitura. Fonte da verdade: log acao=migrate em qa_senha_gov_acessos.';