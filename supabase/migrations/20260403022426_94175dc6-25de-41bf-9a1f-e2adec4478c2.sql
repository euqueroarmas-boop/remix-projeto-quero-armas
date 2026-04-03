
-- Emotion Statistics: monthly aggregation
CREATE TABLE public.emotion_statistics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'anonymous',
  month_key TEXT NOT NULL,
  average_score DOUBLE PRECISION DEFAULT 0,
  max_score INTEGER DEFAULT 0,
  critical_events INTEGER DEFAULT 0,
  conflict_events INTEGER DEFAULT 0,
  cooldown_avg_minutes DOUBLE PRECISION DEFAULT 0,
  total_readings INTEGER DEFAULT 0,
  stability_score DOUBLE PRECISION DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, month_key)
);

ALTER TABLE public.emotion_statistics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access emotion_statistics"
  ON public.emotion_statistics FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Emotion Triggers: detected patterns
CREATE TABLE public.emotion_triggers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'anonymous',
  trigger_name TEXT NOT NULL,
  frequency INTEGER DEFAULT 1,
  avg_intensity DOUBLE PRECISION DEFAULT 0,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, trigger_name)
);

ALTER TABLE public.emotion_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access emotion_triggers"
  ON public.emotion_triggers FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
