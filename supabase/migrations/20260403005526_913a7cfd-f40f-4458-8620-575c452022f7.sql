
-- Stress logs (manual touch input)
CREATE TABLE public.cipa_stress_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  day_key date NOT NULL DEFAULT CURRENT_DATE,
  value integer NOT NULL CHECK (value >= 0 AND value <= 100),
  source text NOT NULL DEFAULT 'manual_touch',
  session_id text,
  delta_from_previous integer DEFAULT 0,
  minutes_since_previous double precision DEFAULT 0
);

ALTER TABLE public.cipa_stress_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access cipa_stress_logs"
  ON public.cipa_stress_logs FOR ALL
  TO public
  USING (true) WITH CHECK (true);

CREATE INDEX idx_cipa_stress_logs_day ON public.cipa_stress_logs (day_key);

-- Daily aggregated stats
CREATE TABLE public.cipa_stress_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_key date NOT NULL UNIQUE,
  min_value integer DEFAULT 0,
  max_value integer DEFAULT 0,
  weighted_average double precision DEFAULT 0,
  critical_exposure_minutes double precision DEFAULT 0,
  rapid_escalation_count integer DEFAULT 0,
  near_fight_events_count integer DEFAULT 0,
  fight_events_count integer DEFAULT 0,
  cooldown_efficiency_score double precision DEFAULT 0,
  daily_conflict_risk double precision DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cipa_stress_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access cipa_stress_daily_stats"
  ON public.cipa_stress_daily_stats FOR ALL
  TO public
  USING (true) WITH CHECK (true);
