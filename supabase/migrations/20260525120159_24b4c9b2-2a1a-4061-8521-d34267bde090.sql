
-- 1. Repeats enum + column on events
DO $$ BEGIN
  CREATE TYPE public.event_repeat AS ENUM ('none', 'weekly', 'biweekly', 'monthly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS repeats public.event_repeat NOT NULL DEFAULT 'none';

-- 2. user_preferences table
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  reminder_hours integer NOT NULL DEFAULT 24 CHECK (reminder_hours IN (2, 6, 24, 48)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view their own preferences" ON public.user_preferences;
CREATE POLICY "Users view their own preferences"
  ON public.user_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert their own preferences" ON public.user_preferences;
CREATE POLICY "Users insert their own preferences"
  ON public.user_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update their own preferences" ON public.user_preferences;
CREATE POLICY "Users update their own preferences"
  ON public.user_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS user_preferences_touch ON public.user_preferences;
CREATE TRIGGER user_preferences_touch
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Dedup column for reminders
ALTER TABLE public.event_saves
  ADD COLUMN IF NOT EXISTS reminded_at timestamptz;
