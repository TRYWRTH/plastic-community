-- Drop RPCs that were getting corrupted by redeployments
DROP FUNCTION IF EXISTS public.get_event_save_counts();
DROP FUNCTION IF EXISTS public.get_event_going_initials(uuid[]);

-- Allow public SELECT on event_saves so the client can compute aggregate
-- counts and going-lists directly. Sensitive fields are limited to
-- event_id, user_id, status; no PII is stored on this table.
CREATE POLICY "Event saves are viewable by everyone"
ON public.event_saves
FOR SELECT
TO anon, authenticated
USING (true);

GRANT SELECT ON public.event_saves TO anon;