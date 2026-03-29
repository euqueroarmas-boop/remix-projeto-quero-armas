
ALTER TABLE public.test_runs
ADD COLUMN test_type TEXT NOT NULL DEFAULT 'smoke';

CREATE INDEX idx_test_runs_test_type ON public.test_runs (test_type);
