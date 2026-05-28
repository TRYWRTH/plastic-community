
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT username_length CHECK (username IS NULL OR (char_length(username) BETWEEN 1 AND 30)),
  CONSTRAINT username_format CHECK (username IS NULL OR username ~ '^[A-Za-z0-9_.-]+$')
);

GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own profile" ON public.profiles;
CREATE POLICY "Users delete own profile"
  ON public.profiles FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Replace get_event_going_initials with the parameterized version
DROP FUNCTION IF EXISTS public.get_event_going_initials();
DROP FUNCTION IF EXISTS public.get_event_going_initials(uuid[]);

CREATE FUNCTION public.get_event_going_initials(event_ids uuid[])
RETURNS TABLE(event_id uuid, initials text[])
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH names AS (
    SELECT
      es.event_id,
      COALESCE(
        NULLIF(btrim(p.username), ''),
        NULLIF(regexp_replace(split_part(coalesce(u.email, ''), '@', 1), '[0-9].*$', ''), '')
      ) AS display_name,
      es.created_at
    FROM public.event_saves es
    LEFT JOIN auth.users u ON u.id = es.user_id
    LEFT JOIN public.profiles p ON p.user_id = es.user_id
    WHERE es.status = 'going'
      AND es.event_id = ANY(event_ids)
  )
  SELECT
    n.event_id,
    array_agg(n.display_name ORDER BY n.created_at ASC)
      FILTER (WHERE n.display_name IS NOT NULL) AS initials
  FROM names n
  GROUP BY n.event_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_going_initials(uuid[])
  TO anon, authenticated, service_role;
