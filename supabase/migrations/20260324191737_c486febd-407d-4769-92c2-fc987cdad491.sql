
-- Remove the open anon INSERT policy on leads (frontend now uses Edge Function)
DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.leads;
DROP POLICY IF EXISTS "Authenticated can insert leads" ON public.leads;

-- Keep service_role full access (already exists)
-- Keep "Service role can read leads" (already exists)
