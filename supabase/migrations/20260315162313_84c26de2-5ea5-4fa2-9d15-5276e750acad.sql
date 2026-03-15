
-- Customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj_ou_cpf TEXT NOT NULL,
  responsavel TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  endereco TEXT,
  cidade TEXT,
  cep TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert customer" ON public.customers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can read customers" ON public.customers FOR SELECT TO anon USING (true);
CREATE POLICY "Service role full access customers" ON public.customers FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Contract equipment config
CREATE TABLE public.contract_equipment (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE,
  computer_model TEXT NOT NULL DEFAULT 'Dell OptiPlex',
  cpu TEXT NOT NULL,
  cpu_generation TEXT NOT NULL,
  ram TEXT NOT NULL DEFAULT '16GB',
  ssd TEXT NOT NULL DEFAULT '240GB',
  network TEXT NOT NULL DEFAULT 'Placa de rede Gigabit',
  monitor_brand TEXT NOT NULL DEFAULT 'Dell',
  monitor_size TEXT NOT NULL DEFAULT '18.5"',
  keyboard_model TEXT NOT NULL DEFAULT 'Teclado USB ABNT2',
  mouse_model TEXT NOT NULL DEFAULT 'Mouse óptico USB',
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  monthly_total NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert equipment" ON public.contract_equipment FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can read equipment" ON public.contract_equipment FOR SELECT TO anon USING (true);
CREATE POLICY "Service role full access equipment" ON public.contract_equipment FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Contract signatures
CREATE TABLE public.contract_signatures (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contract_id UUID REFERENCES public.contracts(id) ON DELETE CASCADE NOT NULL,
  signer_name TEXT NOT NULL,
  signature_data TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  contract_hash TEXT,
  signed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert signature" ON public.contract_signatures FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can read signatures" ON public.contract_signatures FOR SELECT TO anon USING (true);
CREATE POLICY "Service role full access signatures" ON public.contract_signatures FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Asaas webhooks log
CREATE TABLE public.asaas_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.asaas_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access webhooks" ON public.asaas_webhooks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Add customer_id and contract_type to contracts
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id);
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS contract_type TEXT DEFAULT 'locacao';
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS monthly_value NUMERIC;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS contract_hash TEXT;
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

-- Add asaas fields to payments
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS billing_type TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS asaas_invoice_url TEXT;
