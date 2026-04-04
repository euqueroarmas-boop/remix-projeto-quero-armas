-- Add service_status and activated_at to contracts
ALTER TABLE public.contracts
ADD COLUMN IF NOT EXISTS service_status text NOT NULL DEFAULT 'contract_generated',
ADD COLUMN IF NOT EXISTS activated_at timestamp with time zone;

-- Update existing active contracts to have correct service_status
UPDATE public.contracts SET service_status = 'active', activated_at = signed_at WHERE status = 'ATIVO';
UPDATE public.contracts SET service_status = 'overdue' WHERE status = 'INADIMPLENTE';
UPDATE public.contracts SET service_status = 'payment_pending' WHERE status = 'draft' AND signed = true;
UPDATE public.contracts SET service_status = 'contract_generated' WHERE status = 'draft' AND (signed = false OR signed IS NULL);