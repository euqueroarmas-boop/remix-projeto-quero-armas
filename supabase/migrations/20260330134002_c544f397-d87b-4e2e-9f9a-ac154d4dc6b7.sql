
INSERT INTO storage.buckets (id, name, public) VALUES ('certificates', 'certificates', false)
ON CONFLICT (id) DO NOTHING;
