ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_secret boolean NOT NULL DEFAULT false;
