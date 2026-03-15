
-- Budget leads table (separate from existing leads)
CREATE TABLE public.budget_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  city text,
  observations text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Quotes table
CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.budget_leads(id) ON DELETE CASCADE,
  selected_plan text,
  computers_qty integer,
  users_qty integer,
  needs_server_migration boolean DEFAULT false,
  needs_remote_access boolean DEFAULT false,
  needs_backup boolean DEFAULT false,
  monthly_value numeric,
  status text DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Network diagnostics table
CREATE TABLE public.network_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE,
  computers_current integer,
  average_pc_age text,
  maintenance_frequency text,
  has_server boolean DEFAULT false,
  has_backup boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Contracts table
CREATE TABLE public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE,
  contract_text text,
  signed boolean DEFAULT false,
  signed_at timestamptz,
  client_ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Payments table
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE,
  asaas_payment_id text,
  payment_method text,
  payment_status text DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.budget_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Anonymous insert policies (public form)
CREATE POLICY "Anyone can submit budget lead" ON public.budget_leads FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can read budget leads" ON public.budget_leads FOR SELECT TO anon USING (true);

CREATE POLICY "Anyone can insert quote" ON public.quotes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can read quotes" ON public.quotes FOR SELECT TO anon USING (true);

CREATE POLICY "Anyone can insert diagnostic" ON public.network_diagnostics FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can read diagnostics" ON public.network_diagnostics FOR SELECT TO anon USING (true);

CREATE POLICY "Anyone can insert contract" ON public.contracts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can read contracts" ON public.contracts FOR SELECT TO anon USING (true);
CREATE POLICY "Anyone can update contracts" ON public.contracts FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can insert payment" ON public.payments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can read payments" ON public.payments FOR SELECT TO anon USING (true);

-- Service role full access
CREATE POLICY "Service role full access budget_leads" ON public.budget_leads FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access quotes" ON public.quotes FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access diagnostics" ON public.network_diagnostics FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access contracts" ON public.contracts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access payments" ON public.payments FOR ALL TO service_role USING (true) WITH CHECK (true);
