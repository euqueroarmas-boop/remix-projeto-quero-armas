-- Remove insecure anon/authenticated INSERT policies on logs_sistema (now using Edge Function)
DROP POLICY IF EXISTS "Anon can insert logs" ON public.logs_sistema;
DROP POLICY IF EXISTS "Anyone can insert logs" ON public.logs_sistema;
DROP POLICY IF EXISTS "Authenticated can insert logs_sistema" ON public.logs_sistema;