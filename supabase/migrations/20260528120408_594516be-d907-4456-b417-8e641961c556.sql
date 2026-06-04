ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS entrada_objetivo TEXT NULL
    CHECK (entrada_objetivo IS NULL OR entrada_objetivo IN ('inicial','continuidade','indefinido')),
  ADD COLUMN IF NOT EXISTS entrada_possui_arma TEXT NULL
    CHECK (entrada_possui_arma IS NULL OR entrada_possui_arma IN ('sim','nao','nao_sei')),
  ADD COLUMN IF NOT EXISTS entrada_respondida_em TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.qa_clientes.entrada_objetivo IS
  'Resposta do wizard de entrada — objetivo do cliente ao acessar o portal (inicial | continuidade | indefinido).';
COMMENT ON COLUMN public.qa_clientes.entrada_possui_arma IS
  'Resposta do wizard de entrada — declarou possuir arma registrada (sim | nao | nao_sei). Sugere cadastro no Meu Arsenal; NÃO filtra trilha.';
COMMENT ON COLUMN public.qa_clientes.entrada_respondida_em IS
  'Data/hora em que o cliente respondeu o wizard de entrada. NULL = ainda não respondeu (mostra o wizard automaticamente no próximo acesso).';

-- Backfill defensivo: clientes legados NÃO vêem o wizard de surpresa.
UPDATE public.qa_clientes
   SET entrada_objetivo = 'indefinido',
       entrada_respondida_em = now()
 WHERE entrada_respondida_em IS NULL;