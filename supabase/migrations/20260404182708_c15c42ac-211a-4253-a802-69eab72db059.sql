
ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS status_cliente text NOT NULL DEFAULT 'ativo';

ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS suspended_at timestamp with time zone;
