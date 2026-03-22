
-- Add user_id to customers to link with Supabase Auth
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);

-- Update RLS: authenticated users can only read their own customer record
CREATE POLICY "Authenticated users read own customer"
ON public.customers FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- Authenticated users can update their own customer
CREATE POLICY "Authenticated users update own customer"
ON public.customers FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS for related tables: authenticated users access only their data
-- contracts
CREATE POLICY "Auth users read own contracts"
ON public.contracts FOR SELECT TO authenticated
USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

-- service_requests
CREATE POLICY "Auth users read own service_requests"
ON public.service_requests FOR SELECT TO authenticated
USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

CREATE POLICY "Auth users insert own service_requests"
ON public.service_requests FOR INSERT TO authenticated
WITH CHECK (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

-- client_events
CREATE POLICY "Auth users read own client_events"
ON public.client_events FOR SELECT TO authenticated
USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

CREATE POLICY "Auth users insert own client_events"
ON public.client_events FOR INSERT TO authenticated
WITH CHECK (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

-- fiscal_documents
CREATE POLICY "Auth users read own fiscal_documents"
ON public.fiscal_documents FOR SELECT TO authenticated
USING (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));

-- payments (through contracts->quotes)
CREATE POLICY "Auth users read own payments"
ON public.payments FOR SELECT TO authenticated
USING (
  quote_id IN (
    SELECT quote_id FROM public.contracts 
    WHERE customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  )
);
