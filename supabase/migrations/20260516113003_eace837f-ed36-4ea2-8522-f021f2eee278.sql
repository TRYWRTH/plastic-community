
-- Enums
CREATE TYPE public.event_type AS ENUM ('music', 'theater', 'food', 'art', 'sports', 'film', 'workshop', 'community', 'nightlife', 'other');
CREATE TYPE public.neighborhood AS ENUM ('downtown', 'old_town', 'north', 'south', 'east', 'west', 'riverside', 'university', 'industrial', 'suburbs');

-- Events table
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  place TEXT NOT NULL,
  neighborhood public.neighborhood NOT NULL,
  event_type public.event_type NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  link TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX events_date_idx ON public.events (event_date);
CREATE INDEX events_neighborhood_idx ON public.events (neighborhood);
CREATE INDEX events_type_idx ON public.events (event_type);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous) can read events
CREATE POLICY "Events are viewable by everyone"
  ON public.events FOR SELECT
  USING (true);

-- Authenticated users can create events
CREATE POLICY "Authenticated users can create events"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Only creators can update their own events
CREATE POLICY "Users can update their own events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Only creators can delete their own events
CREATE POLICY "Users can delete their own events"
  ON public.events FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER events_touch_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
