ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS entrada_finalidade_arma TEXT NULL
    CHECK (entrada_finalidade_arma IS NULL OR entrada_finalidade_arma IN (
      'caca', 'tiro_esportivo', 'colecionamento', 'defesa_pessoal'
    ));

COMMENT ON COLUMN public.qa_clientes.entrada_finalidade_arma IS
  'Finalidade da arma informada pelo cliente no wizard de entrada (caca | tiro_esportivo | colecionamento | defesa_pessoal).';
