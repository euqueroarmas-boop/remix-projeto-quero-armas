
ALTER TABLE public.emotion_logs
ADD COLUMN IF NOT EXISTS device_type text DEFAULT 'web';

ALTER TABLE public.emotion_events
ADD COLUMN IF NOT EXISTS device_type text DEFAULT 'web';
