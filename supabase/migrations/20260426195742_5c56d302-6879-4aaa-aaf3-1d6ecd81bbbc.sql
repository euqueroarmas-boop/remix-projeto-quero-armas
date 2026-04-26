-- Corrigir search_path mutable em lp_set_updated_at
CREATE OR REPLACE FUNCTION public.lp_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END
$function$;