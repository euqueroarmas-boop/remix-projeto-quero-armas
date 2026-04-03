
ALTER TABLE public.emotion_logs
  ADD COLUMN heart_rate INTEGER,
  ADD COLUMN hrv DOUBLE PRECISION,
  ADD COLUMN sleep_score INTEGER,
  ADD COLUMN bio_source TEXT DEFAULT 'none';
