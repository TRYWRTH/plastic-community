DO $$ BEGIN
  CREATE TYPE public.event_price_type AS ENUM ('free', 'donation', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS price_type public.event_price_type NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS ticket_url text NULL;
