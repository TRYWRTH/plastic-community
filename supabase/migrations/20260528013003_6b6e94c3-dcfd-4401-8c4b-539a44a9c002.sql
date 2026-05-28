CREATE OR REPLACE FUNCTION public.get_event_going_initials()
RETURNS TABLE(event_id uuid, initials text[], going_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH ranked AS (
    SELECT
      es.event_id,
      upper(split_part(regexp_replace(split_part(coalesce(u.email, ''), '@', 1), '[0-9].*$', ''), '.', 1)) AS initial,
      es.created_at,
      row_number() OVER (PARTITION BY es.event_id ORDER BY es.created_at ASC) AS rn,
      count(*) OVER (PARTITION BY es.event_id) AS total
    FROM public.event_saves es
    LEFT JOIN auth.users u ON u.id = es.user_id
    WHERE es.status = 'going'
  )
  SELECT
    event_id,
    array_agg(initial ORDER BY created_at ASC) FILTER (WHERE rn <= 3) AS initials,
    max(total)::bigint AS going_count
  FROM ranked
  GROUP BY event_id;
$function$;