-- Adiciona campo para armazenar a finalidade da arma declarada no wizard de entrada.
-- Usado quando o cliente escolhe "Mexer numa arma que já tenho" para determinar
-- se deve ver serviços SIGMA (tiro/caça/colecionamento) ou PF (defesa pessoal).

ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS entrada_finalidade_arma TEXT NULL
    CHECK (entrada_finalidade_arma IS NULL OR entrada_finalidade_arma IN (
      'caca', 'tiro_esportivo', 'colecionamento', 'defesa_pessoal'
    ));

COMMENT ON COLUMN public.qa_clientes.entrada_finalidade_arma IS
  'Finalidade declarada no wizard quando objetivo=continuidade: caca | tiro_esportivo | colecionamento | defesa_pessoal.';
