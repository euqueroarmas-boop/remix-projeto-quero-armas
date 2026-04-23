
-- ============== ENUMS ==============
DO $$ BEGIN CREATE TYPE public.lp_app_role AS ENUM ('admin','client'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.lp_order_status AS ENUM ('pending','paid','in_progress','completed','cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.lp_payment_status AS ENUM ('pending','authorized','paid','failed','refunded'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.lp_contract_status AS ENUM ('draft','awaiting_signature','signed','cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.lp_acceptance_type AS ENUM ('checkout_terms','contract_signature'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.lp_provider_environment AS ENUM ('sandbox','live'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE public.lp_webhook_event_status AS ENUM ('received','processing','processed','failed','ignored'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============== PROFILES ==============
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text,
  cpf text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "profiles_self_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- ============== USER ROLES ==============
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.lp_app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.lp_app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "roles_self_read" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles_admin_write" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============== updated_at trigger ==============
CREATE OR REPLACE FUNCTION public.lp_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============== CATEGORIES ==============
CREATE TABLE IF NOT EXISTS public.lp_service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lp_service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cat_public_read" ON public.lp_service_categories FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "cat_admin_all" ON public.lp_service_categories FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_lp_cat_upd BEFORE UPDATE ON public.lp_service_categories FOR EACH ROW EXECUTE FUNCTION public.lp_set_updated_at();

-- ============== SERVICES ==============
CREATE TABLE IF NOT EXISTS public.lp_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.lp_service_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  short_description text,
  long_description text,
  base_price_cents int NOT NULL DEFAULT 0,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lp_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "svc_public_read" ON public.lp_services FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "svc_admin_all" ON public.lp_services FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_lp_svc_upd BEFORE UPDATE ON public.lp_services FOR EACH ROW EXECUTE FUNCTION public.lp_set_updated_at();

-- ============== LANDING PAGES ==============
CREATE TABLE IF NOT EXISTS public.lp_service_landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL UNIQUE REFERENCES public.lp_services(id) ON DELETE CASCADE,
  hero_title text,
  hero_subtitle text,
  hero_image_url text,
  seo_title text,
  seo_description text,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lp_service_landing_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lp_public_read" ON public.lp_service_landing_pages FOR SELECT USING (is_published OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "lp_admin_all" ON public.lp_service_landing_pages FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_lp_lp_upd BEFORE UPDATE ON public.lp_service_landing_pages FOR EACH ROW EXECUTE FUNCTION public.lp_set_updated_at();

-- ============== ORDERS ==============
CREATE SEQUENCE IF NOT EXISTS public.lp_order_number_seq START 1000;
CREATE TABLE IF NOT EXISTS public.lp_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_number text NOT NULL UNIQUE DEFAULT ('EQA-' || lpad(nextval('public.lp_order_number_seq')::text, 6, '0')),
  status public.lp_order_status NOT NULL DEFAULT 'pending',
  subtotal_cents int NOT NULL DEFAULT 0,
  total_cents int NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lp_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ord_owner_read" ON public.lp_orders FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ord_owner_insert" ON public.lp_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ord_owner_update" ON public.lp_orders FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ord_admin_delete" ON public.lp_orders FOR DELETE USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_lp_ord_upd BEFORE UPDATE ON public.lp_orders FOR EACH ROW EXECUTE FUNCTION public.lp_set_updated_at();

-- ============== ORDER ITEMS ==============
CREATE TABLE IF NOT EXISTS public.lp_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.lp_orders(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.lp_services(id) ON DELETE SET NULL,
  service_name_snapshot text NOT NULL,
  service_slug_snapshot text NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  unit_price_cents int NOT NULL,
  subtotal_cents int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lp_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oi_owner_read" ON public.lp_order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.lp_orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
);
CREATE POLICY "oi_owner_insert" ON public.lp_order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.lp_orders o WHERE o.id = order_id AND o.user_id = auth.uid())
);
CREATE POLICY "oi_admin_all" ON public.lp_order_items FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============== PAYMENT PROVIDERS ==============
CREATE TABLE IF NOT EXISTS public.lp_payment_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  environment public.lp_provider_environment NOT NULL DEFAULT 'sandbox',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lp_payment_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pp_admin_all" ON public.lp_payment_providers FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_lp_pp_upd BEFORE UPDATE ON public.lp_payment_providers FOR EACH ROW EXECUTE FUNCTION public.lp_set_updated_at();

-- ============== PAYMENTS ==============
CREATE TABLE IF NOT EXISTS public.lp_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.lp_orders(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_id uuid REFERENCES public.lp_payment_providers(id) ON DELETE SET NULL,
  external_id text,
  amount_cents int NOT NULL,
  status public.lp_payment_status NOT NULL DEFAULT 'pending',
  payment_method text,
  paid_at timestamptz,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lp_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pay_owner_read" ON public.lp_payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.lp_orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
);
CREATE POLICY "pay_admin_all" ON public.lp_payments FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_lp_pay_upd BEFORE UPDATE ON public.lp_payments FOR EACH ROW EXECUTE FUNCTION public.lp_set_updated_at();

-- ============== CONTRACT TEMPLATES ==============
CREATE TABLE IF NOT EXISTS public.lp_contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  body text NOT NULL,
  variables_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  version int NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lp_contract_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ct_auth_read" ON public.lp_contract_templates FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "ct_admin_all" ON public.lp_contract_templates FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_lp_ct_upd BEFORE UPDATE ON public.lp_contract_templates FOR EACH ROW EXECUTE FUNCTION public.lp_set_updated_at();

-- ============== CONTRACTS ==============
CREATE SEQUENCE IF NOT EXISTS public.lp_contract_number_seq START 1000;
CREATE TABLE IF NOT EXISTS public.lp_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid NOT NULL REFERENCES public.lp_orders(id) ON DELETE CASCADE,
  contract_number text NOT NULL UNIQUE DEFAULT ('CTR-' || lpad(nextval('public.lp_contract_number_seq')::text, 6, '0')),
  template_id uuid REFERENCES public.lp_contract_templates(id) ON DELETE SET NULL,
  template_version int,
  template_snapshot text,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  rendered_content text,
  status public.lp_contract_status NOT NULL DEFAULT 'draft',
  signature_metadata jsonb,
  checkout_accepted_at timestamptz,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lp_contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ctr_owner_read" ON public.lp_contracts FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ctr_owner_update" ON public.lp_contracts FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ctr_admin_all" ON public.lp_contracts FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_lp_ctr_upd BEFORE UPDATE ON public.lp_contracts FOR EACH ROW EXECUTE FUNCTION public.lp_set_updated_at();

-- ============== CONTRACT ACCEPTANCES ==============
CREATE TABLE IF NOT EXISTS public.lp_contract_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL REFERENCES public.lp_contracts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  acceptance_type public.lp_acceptance_type NOT NULL DEFAULT 'checkout_terms',
  acceptance_method text NOT NULL DEFAULT 'web',
  content_hash text NOT NULL,
  ip_address text,
  user_agent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.lp_contract_acceptances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ca_owner_read" ON public.lp_contract_acceptances FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "ca_owner_insert" ON public.lp_contract_acceptances FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============== WEBHOOK EVENTS ==============
CREATE TABLE IF NOT EXISTS public.lp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL,
  event_type text NOT NULL,
  external_event_id text NOT NULL,
  signature text,
  raw_payload jsonb NOT NULL,
  status public.lp_webhook_event_status NOT NULL DEFAULT 'received',
  order_id uuid REFERENCES public.lp_orders(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.lp_payments(id) ON DELETE SET NULL,
  processing_error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (provider_key, external_event_id)
);
ALTER TABLE public.lp_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wh_admin_all" ON public.lp_webhook_events FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============== AUTO PROFILE ON SIGNUP ==============
CREATE OR REPLACE FUNCTION public.handle_new_user_lp() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'client') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created_lp ON auth.users;
CREATE TRIGGER on_auth_user_created_lp AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_lp();
