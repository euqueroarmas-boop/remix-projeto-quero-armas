
CREATE TABLE public.cipa_stress_monthly_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_key text NOT NULL UNIQUE,
  monthly_average double precision DEFAULT 0,
  max_peak integer DEFAULT 0,
  high_risk_days integer DEFAULT 0,
  near_fight_events integer DEFAULT 0,
  fight_events integer DEFAULT 0,
  stable_days_percent double precision DEFAULT 0,
  average_cooldown_time double precision DEFAULT 0,
  monthly_stability_score double precision DEFAULT 100,
  month_over_month_variation double precision DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cipa_stress_monthly_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access cipa_stress_monthly_stats"
  ON public.cipa_stress_monthly_stats FOR ALL
  TO public
  USING (true) WITH CHECK (true);
