INSERT INTO public.qa_status_servico
  (codigo, nome, ordem, ativo, finalizador, exige_data_protocolo, exige_numero_protocolo, visivel_cliente, visivel_equipe)
VALUES
  ('a_iniciar', 'À INICIAR', 5, true, false, false, false, true, true)
ON CONFLICT (codigo) DO UPDATE SET
  nome = EXCLUDED.nome,
  ativo = true,
  finalizador = false,
  exige_data_protocolo = false,
  exige_numero_protocolo = false,
  visivel_cliente = true,
  visivel_equipe = true;