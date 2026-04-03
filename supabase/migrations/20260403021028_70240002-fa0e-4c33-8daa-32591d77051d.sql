
-- Emotion logs table
CREATE TABLE public.emotion_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'anonymous',
  manual_level INTEGER NOT NULL CHECK (manual_level >= 0 AND manual_level <= 100),
  status_label TEXT NOT NULL DEFAULT 'calmo',
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.emotion_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access emotion_logs"
  ON public.emotion_logs FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_emotion_logs_user_created ON public.emotion_logs (user_id, created_at DESC);
CREATE INDEX idx_emotion_logs_created ON public.emotion_logs (created_at DESC);

-- Emotion events table
CREATE TABLE public.emotion_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'anonymous',
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  peak_level INTEGER NOT NULL DEFAULT 0,
  ended_at TIMESTAMP WITH TIME ZONE,
  duration_minutes DOUBLE PRECISION,
  conflict_flag BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.emotion_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access emotion_events"
  ON public.emotion_events FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_emotion_events_user ON public.emotion_events (user_id, started_at DESC);
