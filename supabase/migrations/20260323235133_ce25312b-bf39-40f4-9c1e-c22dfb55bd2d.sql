
-- proposals table for versioned commercial proposals
CREATE TABLE IF NOT EXISTS public.proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  plan text NOT NULL DEFAULT 'essencial',
  computers_qty integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 249,
  total_value numeric NOT NULL DEFAULT 249,
  contract_months integer NOT NULL DEFAULT 36,
  valid_until date NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '15 days'),
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'proposta_gerada',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert proposals" ON public.proposals FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can read proposals" ON public.proposals FOR SELECT TO anon USING (true);
CREATE POLICY "Auth users read own proposals" ON public.proposals FOR SELECT TO authenticated USING (
  customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
);
CREATE POLICY "Service role full access proposals" ON public.proposals FOR ALL TO service_role USING (true) WITH CHECK (true);

-- security_events table for security monitoring
CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  description text NOT NULL,
  user_id text,
  customer_id uuid,
  ip_address text,
  user_agent text,
  route text,
  request_id text,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert security_events" ON public.security_events FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can read security_events" ON public.security_events FOR SELECT TO anon USING (true);
CREATE POLICY "Service role full access security_events" ON public.security_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- admin_audit_logs table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id text,
  action text NOT NULL,
  target_type text,
  target_id text,
  before_state jsonb,
  after_state jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert admin_audit_logs" ON public.admin_audit_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anyone can read admin_audit_logs" ON public.admin_audit_logs FOR SELECT TO anon USING (true);
CREATE POLICY "Service role full access admin_audit_logs" ON public.admin_audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Add whatsapp and lead_source to leads table if not exist
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS whatsapp text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lead_status text DEFAULT 'lead_capturado';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add status tracking columns to contracts
ALTER TABLE public.contracts ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add amount column to payments for storing actual value
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount numeric;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
