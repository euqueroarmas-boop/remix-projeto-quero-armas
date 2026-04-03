
-- Voice emotion logs
CREATE TABLE public.voice_emotion_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  day_key date NOT NULL DEFAULT CURRENT_DATE,
  session_id text,
  voice_energy double precision DEFAULT 0,
  pitch_mean double precision DEFAULT 0,
  pitch_variation double precision DEFAULT 0,
  speech_rate_estimate double precision DEFAULT 0,
  tension_score double precision DEFAULT 0,
  anger_probability_estimate double precision DEFAULT 0,
  confidence_score double precision DEFAULT 0,
  source text NOT NULL DEFAULT 'voice_analysis'
);

ALTER TABLE public.voice_emotion_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access voice_emotion_logs"
  ON public.voice_emotion_logs FOR ALL
  TO public
  USING (true) WITH CHECK (true);

CREATE INDEX idx_voice_emotion_logs_day ON public.voice_emotion_logs (day_key);

-- Voice daily stats
CREATE TABLE public.cipa_voice_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_key date NOT NULL UNIQUE,
  average_tension_score double precision DEFAULT 0,
  peak_tension_score double precision DEFAULT 0,
  anger_spikes_count integer DEFAULT 0,
  sustained_high_tension_minutes double precision DEFAULT 0,
  cooldown_voice_recovery_score double precision DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cipa_voice_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access cipa_voice_daily_stats"
  ON public.cipa_voice_daily_stats FOR ALL
  TO public
  USING (true) WITH CHECK (true);
