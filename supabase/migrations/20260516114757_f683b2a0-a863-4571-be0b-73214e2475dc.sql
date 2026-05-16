
CREATE TYPE public.save_status AS ENUM ('going', 'interested');

CREATE TABLE public.event_saves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status public.save_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX idx_event_saves_user ON public.event_saves(user_id);
CREATE INDEX idx_event_saves_event ON public.event_saves(event_id);

ALTER TABLE public.event_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saves"
  ON public.event_saves FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own saves"
  ON public.event_saves FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saves"
  ON public.event_saves FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saves"
  ON public.event_saves FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER touch_event_saves_updated_at
  BEFORE UPDATE ON public.event_saves
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();
