ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS location_tba boolean NOT NULL DEFAULT false;
