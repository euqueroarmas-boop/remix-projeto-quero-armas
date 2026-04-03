
-- intervention_logs table
CREATE TABLE public.intervention_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'anonymous',
  trigger_event_id UUID REFERENCES public.emotion_events(id) ON DELETE SET NULL,
  intervention_type TEXT NOT NULL DEFAULT 'suggestion',
  intervention_text TEXT,
  accepted BOOLEAN DEFAULT NULL,
  effectiveness_score INTEGER DEFAULT NULL,
  notes TEXT,
  relationship_id UUID DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.intervention_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access intervention_logs"
  ON public.intervention_logs FOR ALL TO public
  USING (true) WITH CHECK (true);

-- relationships table
CREATE TABLE public.relationships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by TEXT NOT NULL DEFAULT 'anonymous',
  partner_id TEXT DEFAULT NULL,
  invite_code TEXT NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access relationships"
  ON public.relationships FOR ALL TO public
  USING (true) WITH CHECK (true);

-- relationship_members table
CREATE TABLE public.relationship_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  relationship_id UUID NOT NULL REFERENCES public.relationships(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL DEFAULT 'anonymous',
  role TEXT NOT NULL DEFAULT 'member',
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.relationship_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access relationship_members"
  ON public.relationship_members FOR ALL TO public
  USING (true) WITH CHECK (true);

-- Add columns to emotion_logs
ALTER TABLE public.emotion_logs
  ADD COLUMN IF NOT EXISTS device_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS partner_user_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS relationship_id UUID DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS data_mode TEXT DEFAULT 'real';

-- Add columns to emotion_events
ALTER TABLE public.emotion_events
  ADD COLUMN IF NOT EXISTS device_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS relationship_id UUID DEFAULT NULL;
