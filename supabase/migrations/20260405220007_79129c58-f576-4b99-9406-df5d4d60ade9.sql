
CREATE TABLE public.asaas_customer_map (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asaas_customer_id text NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT asaas_customer_map_asaas_id_unique UNIQUE (asaas_customer_id)
);

CREATE INDEX idx_asaas_customer_map_customer ON public.asaas_customer_map(customer_id);

ALTER TABLE public.asaas_customer_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access asaas_customer_map"
  ON public.asaas_customer_map FOR ALL
  TO service_role USING (true) WITH CHECK (true);
