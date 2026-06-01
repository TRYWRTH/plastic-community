-- Helper to derive a safe default username from an email address.
-- Lowercases, keeps only letters/numbers/_.- , trims to 30 chars.
CREATE OR REPLACE FUNCTION public.default_username_from_email(email text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(
    substring(
      regexp_replace(lower(split_part(coalesce(email, ''), '@', 1)), '[^a-z0-9_.\-]', '', 'g'),
      1, 30
    ),
    ''
  );
$$;

-- Backfill: create a profile row for every auth.users entry missing one.
INSERT INTO public.profiles (user_id, username)
SELECT u.id, public.default_username_from_email(u.email)
FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;

-- Auto-create a profile on new signups.
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username)
  VALUES (NEW.id, public.default_username_from_email(NEW.email))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_profile();