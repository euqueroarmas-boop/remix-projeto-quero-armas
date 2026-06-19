-- Adiciona 'defesa_pessoal' ao CHECK constraint de entrada_objetivo.
-- Necessário para salvar a nova opção do wizard de entrada.

ALTER TABLE public.qa_clientes
  DROP CONSTRAINT IF EXISTS qa_clientes_entrada_objetivo_check;

ALTER TABLE public.qa_clientes
  ADD CONSTRAINT qa_clientes_entrada_objetivo_check
    CHECK (entrada_objetivo IS NULL OR entrada_objetivo IN (
      'inicial', 'defesa_pessoal', 'continuidade', 'indefinido'
    ));

COMMENT ON COLUMN public.qa_clientes.entrada_objetivo IS
  'Resposta do wizard de entrada — objetivo do cliente ao acessar o portal (inicial | defesa_pessoal | continuidade | indefinido).';
