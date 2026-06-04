BEGIN;

-- Views legadas (kpis depende de dry_run; remover kpis primeiro)
DROP VIEW IF EXISTS public.qa_gov_password_reconciliation_view;
DROP VIEW IF EXISTS public.qa_gov_password_reconciliation_by_cpf;
DROP VIEW IF EXISTS public.qa_clientes_homologacao_kpis;
DROP VIEW IF EXISTS public.qa_clientes_homologacao_dry_run;
DROP VIEW IF EXISTS public.qa_incident_reconciliation_plan;

-- Tabelas legadas (staging de migração Access)
DROP TABLE IF EXISTS public.staging_access_clientes;
DROP TABLE IF EXISTS public.staging_access_armas;
DROP TABLE IF EXISTS public.staging_access_crafs;
DROP TABLE IF EXISTS public.staging_access_crs;
DROP TABLE IF EXISTS public.staging_access_senhas_gov;

-- Tabelas legadas (snapshots/backup/incident)
DROP TABLE IF EXISTS public.qa_cadastro_cr_backup_p0;
DROP TABLE IF EXISTS public.qa_cadastro_cr_consolidacao_snapshot;
DROP TABLE IF EXISTS public.qa_cliente_homologacao_eventos;
DROP TABLE IF EXISTS public.qa_incident_reconciliation_snapshot;
DROP TABLE IF EXISTS public.qa_gov_reconciliation_audit;

COMMIT;