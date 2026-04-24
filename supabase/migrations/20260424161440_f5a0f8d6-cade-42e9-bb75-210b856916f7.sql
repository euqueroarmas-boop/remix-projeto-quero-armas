ALTER TABLE public.qa_clientes
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_qa_clientes_user_id
  ON public.qa_clientes (user_id);

CREATE INDEX IF NOT EXISTS idx_qa_clientes_customer_id
  ON public.qa_clientes (customer_id);