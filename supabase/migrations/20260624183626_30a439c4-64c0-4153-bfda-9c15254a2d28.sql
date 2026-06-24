
-- Extensions for distance search
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;

-- Enum for tipo
DO $$ BEGIN
  CREATE TYPE public.qa_pf_credenciado_tipo AS ENUM ('psicologo', 'instrutor_tiro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Geocode cache
CREATE TABLE IF NOT EXISTS public.qa_endereco_geocache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endereco_normalizado text NOT NULL UNIQUE,
  latitude double precision,
  longitude double precision,
  provider text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.qa_endereco_geocache TO authenticated;
GRANT ALL ON public.qa_endereco_geocache TO service_role;
ALTER TABLE public.qa_endereco_geocache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read geocache"
  ON public.qa_endereco_geocache FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manages geocache"
  ON public.qa_endereco_geocache FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Credenciados table
CREATE TABLE IF NOT EXISTS public.qa_pf_credenciados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.qa_pf_credenciado_tipo NOT NULL,
  uf char(2) NOT NULL,
  cidade text,
  bairro text,
  nome text NOT NULL,
  registro text,
  endereco text,
  telefones text[] NOT NULL DEFAULT '{}',
  emails text[] NOT NULL DEFAULT '{}',
  validade date,
  validade_label text,
  latitude double precision,
  longitude double precision,
  source_url text NOT NULL,
  raw_block text,
  hash_conteudo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tipo, uf, hash_conteudo)
);

GRANT SELECT ON public.qa_pf_credenciados TO authenticated;
GRANT ALL ON public.qa_pf_credenciados TO service_role;

ALTER TABLE public.qa_pf_credenciados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read credenciados"
  ON public.qa_pf_credenciados FOR SELECT TO authenticated USING (ativo = true);
CREATE POLICY "Service role manages credenciados"
  ON public.qa_pf_credenciados FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_qa_pf_credenciados_tipo_uf
  ON public.qa_pf_credenciados (tipo, uf) WHERE ativo;
CREATE INDEX IF NOT EXISTS idx_qa_pf_credenciados_earth
  ON public.qa_pf_credenciados USING gist (ll_to_earth(latitude, longitude))
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL AND ativo;

-- Sync log
CREATE TABLE IF NOT EXISTS public.qa_pf_credenciados_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  total_paginas int DEFAULT 0,
  total_inseridos int DEFAULT 0,
  total_atualizados int DEFAULT 0,
  total_desativados int DEFAULT 0,
  erros jsonb DEFAULT '[]'::jsonb,
  detalhes jsonb DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.qa_pf_credenciados_sync_log TO authenticated;
GRANT ALL ON public.qa_pf_credenciados_sync_log TO service_role;
ALTER TABLE public.qa_pf_credenciados_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read sync log"
  ON public.qa_pf_credenciados_sync_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manages sync log"
  ON public.qa_pf_credenciados_sync_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.qa_pf_credenciados_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_qa_pf_credenciados_touch ON public.qa_pf_credenciados;
CREATE TRIGGER trg_qa_pf_credenciados_touch
  BEFORE UPDATE ON public.qa_pf_credenciados
  FOR EACH ROW EXECUTE FUNCTION public.qa_pf_credenciados_touch_updated_at();

DROP TRIGGER IF EXISTS trg_qa_endereco_geocache_touch ON public.qa_endereco_geocache;
CREATE TRIGGER trg_qa_endereco_geocache_touch
  BEFORE UPDATE ON public.qa_endereco_geocache
  FOR EACH ROW EXECUTE FUNCTION public.qa_pf_credenciados_touch_updated_at();

-- Distance search RPC
CREATE OR REPLACE FUNCTION public.qa_pf_credenciados_proximos(
  p_tipo public.qa_pf_credenciado_tipo,
  p_lat double precision,
  p_lng double precision,
  p_raio_km double precision DEFAULT 50,
  p_limit int DEFAULT 20,
  p_uf char(2) DEFAULT NULL,
  p_incluir_vencidos boolean DEFAULT false
)
RETURNS TABLE (
  id uuid, tipo public.qa_pf_credenciado_tipo, uf char(2), cidade text, bairro text,
  nome text, registro text, endereco text, telefones text[], emails text[],
  validade date, validade_label text, latitude double precision, longitude double precision,
  source_url text, distancia_km double precision
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.tipo, c.uf, c.cidade, c.bairro, c.nome, c.registro, c.endereco,
         c.telefones, c.emails, c.validade, c.validade_label, c.latitude, c.longitude,
         c.source_url,
         CASE WHEN c.latitude IS NULL OR c.longitude IS NULL THEN NULL
              ELSE earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(c.latitude, c.longitude)) / 1000.0
         END AS distancia_km
  FROM public.qa_pf_credenciados c
  WHERE c.tipo = p_tipo
    AND c.ativo = true
    AND (p_uf IS NULL OR c.uf = p_uf)
    AND (p_incluir_vencidos OR c.validade IS NULL OR c.validade >= CURRENT_DATE)
    AND (
      c.latitude IS NULL OR c.longitude IS NULL
      OR earth_box(ll_to_earth(p_lat, p_lng), p_raio_km * 1000) @> ll_to_earth(c.latitude, c.longitude)
    )
  ORDER BY distancia_km NULLS LAST
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.qa_pf_credenciados_proximos(
  public.qa_pf_credenciado_tipo, double precision, double precision, double precision, int, char(2), boolean
) TO authenticated, service_role;
