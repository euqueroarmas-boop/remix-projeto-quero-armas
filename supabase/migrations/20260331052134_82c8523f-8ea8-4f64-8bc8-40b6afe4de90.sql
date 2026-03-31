
CREATE TABLE public.cipa_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_label text NOT NULL DEFAULT '',
  device_name text NOT NULL DEFAULT '',
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  captured_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_priority boolean NOT NULL DEFAULT false,
  priority_order integer DEFAULT 0
);

ALTER TABLE public.cipa_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access cipa_locations" ON public.cipa_locations FOR ALL TO public USING (true) WITH CHECK (true);
