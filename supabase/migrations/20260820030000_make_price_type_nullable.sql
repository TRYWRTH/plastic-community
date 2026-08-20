-- price_type previously defaulted to 'free' on every insert, so events
-- whose creator never actually set a price silently read as "Free" instead
-- of showing nothing. Make the column nullable with no default so "not set"
-- is representable — the app now only writes a value once the creator picks
-- one.
ALTER TABLE public.events
  ALTER COLUMN price_type DROP NOT NULL,
  ALTER COLUMN price_type DROP DEFAULT;
