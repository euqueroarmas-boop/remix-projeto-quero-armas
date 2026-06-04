INSERT INTO public.qa_status_servico (nome, ordem, ativo)
VALUES ('NOTIFICADO', 85, true)
ON CONFLICT DO NOTHING;